import { tag, button, on } from 'ellipsi'
import { announceHistoryChange, EditorMode } from '../classes/editorMode'
import { redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { saveFilesInZip } from '../helpers/zipHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import {
    createCodeMirrorView,
    getCodeMirrorText,
    programPreamble,
    setCodeMirrorText,
} from '../helpers/codeMirrorHelper'
import { createIssuesDrawer } from '../helpers/issuesDrawerHelper'
import { checkWithPyrefly } from '../helpers/pyreflyHelper'
import { getRoot } from '../helpers/rootHelper'

/**
 * @param {object} [options] Embedding options (see BuildEmbedContent).
 * @param {boolean} [options.persist=true] Keep the source in local storage.
 *     An embedding page owns the state instead and passes false.
 * @param {(detail: {code: string, state: string}) => void} [options.onChange]
 *     Called after every edit with the source (as both code and state).
 * @returns {EditorMode} Configured Python line-editor mode.
 */
export default ({ persist = true, onChange = null } = {}) => {
    const view = createCodeMirrorView()
    view.dom.id = 'line-editor-canvas'
    // every change may add to the undo history, or be an undo itself
    view.dispatch({
        effects: StateEffect.appendConfig.of(
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    announceHistoryChange()
                }
            }),
        ),
    })

    /** Restores line-editor source from local storage. */
    const loadState = () => {
        const savedState = persist
            ? localStorage.getItem('codeMirrorState')
            : null
        if (savedState) {
            setCodeMirrorText(view, savedState)
        }
    }
    loadState()

    let lastReported = null

    /** Saves line-editor source to local storage. */
    const saveState = () => {
        const code = getCodeMirrorText(view)
        if (persist) {
            localStorage.setItem('codeMirrorState', code)
        }
        if (onChange && code !== lastReported) {
            lastReported = code
            onChange({ code, state: code })
        }
    }
    view.dom.addEventListener('keydown', saveState)
    view.dom.addEventListener('input', saveState)
    view.dom.addEventListener('focus', saveState)
    view.dom.addEventListener('blur', saveState)

    /**
     * Downloads the current Python source as a project archive.
     * @param {HTMLInputElement} ProjectNameInput Project-name field.
     */
    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'
        saveFilesInZip(projectName, getProjectFiles())
    }

    /**
     * The project's files: the Python as typed.
     * @returns {{name: string, text: string}[]} The files.
     */
    const getProjectFiles = () => [
        {
            name: 'main.py',
            text: view.state.doc.toString(),
        },
    ]

    /**
     * Opens a dialog that imports a Python source file.
     * @param {HTMLInputElement} ProjectNameInput Project-name field.
     */
    const loadCode = (ProjectNameInput) => {
        const FileInput = tag('input', {
            type: 'file',
            accept: '.py',
        })

        const LoadButton = button(
            'Load Project',
            on('click', () => {
                if (FileInput.files.length < 1) {
                    // Wait for them to add a file
                    return
                }

                const file = FileInput.files[0]

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

        getRoot().appendChild(LoadPopUp)
    }

    // the Issues drawer (issuesDrawerHelper.js), filled from Pyrefly
    const issues = createIssuesDrawer()
    const IssuesDrawer = issues.drawer

    /**
     * @param {object[]} diagnostics Pyrefly's diagnostics.
     * @returns {object[]} The drawer's issues, each at its line.
     */
    const issuesOf = (diagnostics = []) =>
        diagnostics.map((diagnostic) => ({
            severity: diagnostic.severity,
            message: diagnostic.message,
            where: `Line ${diagnostic.line ?? 1}`,
        }))

    let verifyTimeout = null
    let verifyRunId = 0
    let lastVerifiedCode = null

    /**
     * Verifies changed source and ignores results from superseded async runs.
     * @returns {Promise<void>} Resolves after the current verification attempt.
     */
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
            issues.checking()

            const result = await checkWithPyrefly(code)

            if (runId !== verifyRunId) {
                return
            }

            lastVerifiedCode = code
            view.dom.dispatchEvent(
                new CustomEvent('perform-linting', { detail: result }),
            )
            const found = issuesOf(result?.diagnostics)
            if (!found.length && result?.error) {
                found.push({ severity: 'error', message: result.error })
            }
            issues.show(found)
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
            issues.show(issuesOf(result.diagnostics))
        }
    }

    /**
     * Debounces verification after editor activity.
     * @param {number} delay Delay in milliseconds.
     */
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

    return new EditorMode({
        name: 'line',
        EditorElement: LineEditor,
        saveCode,
        loadCode,
        saveState,
        loadState,
        getProjectFiles,
        // CodeMirror's history, as Ctrl+Z and Ctrl+Y use it
        history: {
            undo: () => undo(view),
            redo: () => redo(view),
            canUndo: () => undoDepth(view.state) > 0,
            canRedo: () => redoDepth(view.state) > 0,
        },
        setState: (state) => {
            setCodeMirrorText(
                view,
                typeof state === 'string' ? state : programPreamble(),
            )
            saveState()
            scheduleVerify(0)
        },
    })
}
