import { tag, button, on } from 'ellipsi'
import { EditorMode } from '../classes/editorMode'
import { saveFilesInZip } from '../helpers/zipHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import {
    createCodeMirrorView,
    getCodeMirrorText,
    setCodeMirrorText,
} from '../helpers/codeMirrorHelper'
import { checkWithPyrefly } from '../helpers/pyreflyHelper'

export default () => {
    const view = createCodeMirrorView()
    view.dom.id = 'line-editor-canvas'

    const loadState = () => {
        const savedState = localStorage.getItem('codeMirrorState')
        if (savedState) {
            setCodeMirrorText(view, savedState)
        }
    }
    loadState()

    const saveState = () => {
        localStorage.setItem('codeMirrorState', getCodeMirrorText(view))
    }
    view.dom.addEventListener('keydown', saveState)
    view.dom.addEventListener('input', saveState)
    view.dom.addEventListener('focus', saveState)
    view.dom.addEventListener('blur', saveState)

    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'

        saveFilesInZip(projectName, [
            {
                name: 'main.py',
                text: view.state.doc.toString(),
            },
        ])
    }

    const loadCode = (ProjectNameInput) => {
        const FileInput = tag('input', {
            type: 'file',
            accept: '.py',
        })

        const LoadButton = button(
            'Load project',
            on('click', () => {
                if (FileInput.files.length < 1) {
                    // Wait for them to add a file
                    return
                }

                const file = FileInput.files[0]

                // TODO: find some way to retreive proj name from .PY file.
                // // Set project name to the file name
                // const projectName = file.name.replaceAll('.py', '')
                // ProjectNameInput.value = projectName
                // localStorage.setItem('projectName', projectName)

                // Load the contents of the file
                const reader = new FileReader()
                reader.readAsText(file, 'utf-8')
                reader.onload = (event) => {
                    setCodeMirrorText(view, event.target.result)
                    saveState()
                    scheduleVerify(0)
                }

                // Close the pop up
                LoadPopUp.dispatchEvent(new Event(closePopUpEvent))
            }),
        )

        const LoadPopUp = PopUp(
            'Find the zip file for the project in your downloads folder, and ',
            'choose the file inside it named main.py.',
            FileInput,
            LoadButton,
        )

        document.body.appendChild(LoadPopUp)
    }

    const VerifyStatus = tag(
        'span',
        {
            id: 'verify-status',
            role: 'status',
            'aria-live': 'polite',
        },
        'Not checked',
    )
    const VerifyIssues = tag('div', { id: 'verify-issues' })
    const IssuesDrawerTab = button(
        { type: 'button', id: 'issues-drawer-tab' },
        'Issues',
    )
    const IssuesDrawer = tag(
        'issues-drawer',
        { 'aria-expanded': 'false' },
        IssuesDrawerTab,
        tag(
            'aside',
            { id: 'issues-drawer-panel' },
            tag('h2', 'Issues'),
            VerifyStatus,
            VerifyIssues,
        ),
    )

    IssuesDrawerTab.addEventListener('click', () => {
        const isOpen = IssuesDrawer.classList.toggle('open')
        IssuesDrawer.setAttribute('aria-expanded', String(isOpen))
    })
    IssuesDrawer.addEventListener('click', (event) => {
        event.stopPropagation()
    })

    const setVerifyStatus = (status, message) => {
        VerifyStatus.textContent = message
        VerifyStatus.dataset.status = status
        IssuesDrawer.dataset.status = status
    }

    const countBySeverity = (diagnostics = []) => {
        const counts = { error: 0, warning: 0, info: 0 }

        for (const diagnostic of diagnostics) {
            if (diagnostic.severity === 'warning') {
                counts.warning += 1
            } else if (diagnostic.severity === 'info') {
                counts.info += 1
            } else {
                counts.error += 1
            }
        }

        return counts
    }

    const issueStatusText = (diagnostics = []) => {
        const { error, warning, info } = countBySeverity(diagnostics)
        const parts = []

        if (error) {
            parts.push(`${error} error${error === 1 ? '' : 's'}`)
        }

        if (warning) {
            parts.push(`${warning} warning${warning === 1 ? '' : 's'}`)
        }

        if (info) {
            parts.push(`${info} info${info === 1 ? '' : 's'}`)
        }

        return parts.length ? `${parts.join(', ')} found` : 'No issues'
    }

    const issueSeverityClass = (severity) => {
        if (severity === 'warning') return 'warning'
        if (severity === 'info') return 'info'
        return 'error'
    }

    const setVerifyIssues = (diagnostics) => {
        VerifyIssues.replaceChildren()

        if (!diagnostics?.length) {
            return
        }

        VerifyIssues.append(
            ...diagnostics.slice(0, 5).map((diagnostic) =>
                tag(
                    'div',
                    {
                        class: `verify-issue verify-issue-${issueSeverityClass(diagnostic.severity)}`,
                    },
                    `Line ${diagnostic.line ?? 1}: ${diagnostic.message}`,
                ),
            ),
        )

        if (diagnostics.length > 5) {
            VerifyIssues.append(
                tag(
                    'div',
                    { class: 'verify-issue verify-issue-more' },
                    `${diagnostics.length - 5} more issue${diagnostics.length - 5 === 1 ? '' : 's'}`,
                ),
            )
        }
    }

    let verifyTimeout = null
    let verifyRunId = 0
    let lastVerifiedCode = null

    const runVerify = async () => {
        if (!view.dom.isConnected) {
            return
        }

        const code = getCodeMirrorText(view)
        if (code === lastVerifiedCode) {
            return
        }

        const runId = ++verifyRunId

        try {
            setVerifyStatus('checking', 'Checking...')
            IssuesDrawerTab.textContent = 'Checking'
            setVerifyIssues([])

            const result = await checkWithPyrefly(code)

            if (runId !== verifyRunId) {
                return
            }

            lastVerifiedCode = code
            const issueCount =
                result?.diagnostics?.length || (result?.error ? 1 : 0)
            IssuesDrawerTab.textContent = issueCount
                ? `Issues (${issueCount})`
                : 'Issues'

            const lintingEvent = new CustomEvent('perform-linting', {
                detail: result,
            })
            view.dom.dispatchEvent(lintingEvent)
            setVerifyIssues(result?.diagnostics)

            const { error: errorCount, warning: warningCount } = countBySeverity(
                result?.diagnostics ?? [],
            )
            setVerifyStatus(
                issueCount
                    ? errorCount
                        ? 'error'
                        : warningCount
                          ? 'warning'
                          : 'info'
                    : 'success',
                issueStatusText(result?.diagnostics ?? []),
            )
        } catch (error) {
            if (runId !== verifyRunId) {
                return
            }

            const result = {
                error: `Pyrefly verification failed: ${error.message}`,
                diagnostics: [
                    {
                        message: `Pyrefly verification failed: ${error.message}`,
                        line: 1,
                        column: 1,
                        severity: 'error',
                    },
                ],
            }

            view.dom.dispatchEvent(
                new CustomEvent('perform-linting', { detail: result }),
            )
            setVerifyIssues(result.diagnostics)
            setVerifyStatus('error', '1 issue found')
            IssuesDrawerTab.textContent = 'Issues (1)'
        }
    }

    const scheduleVerify = (delay = 700) => {
        clearTimeout(verifyTimeout)
        verifyTimeout = setTimeout(runVerify, delay)
    }

    view.dom.addEventListener('input', () => scheduleVerify())
    view.dom.addEventListener('keyup', () => scheduleVerify())
    view.dom.addEventListener('focus', () => scheduleVerify(0))
    setInterval(runVerify, 3000)

    const LineEditor = tag(
        'line-editor',
        IssuesDrawer,
        view.dom,
        on('click', () => view.focus()),
    )
    scheduleVerify(0)

    return new EditorMode(
        'line',
        LineEditor,
        saveCode,
        loadCode,
        saveState,
        loadState,
    )
}
