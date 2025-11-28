import { a, button, footer, header, img, on, span, tag } from 'ellipsi'

import buildBlockMode from './buildBlockMode'
import buildLineMode from './buildLineMode'
import { EditorMode } from '../classes/editorMode'
import tooltipHelper from '../helpers/tooltipHelper'

export default (toolbox, vocab) => {
    const blockMode = buildBlockMode(toolbox)
    const lineMode = buildLineMode(vocab)

    /** @type {EditorMode} The current editor mode. */
    let currentMode = null
    // Contains the current editor element.
    const EditorContainer = span({ id: 'editor-container' })

    /**
     * Swaps the current editor.
     * @param {EditorMode?} targetMode The target editor mode.  If null, toggles between
     * editors.
     */
    const switchEditor = (targetMode = null) => {
        if (targetMode !== null) {
            currentMode = targetMode
        } else if (currentMode === blockMode) {
            currentMode = lineMode
        } else {
            currentMode = blockMode
        }

        // Move the editor element onto the page.
        EditorContainer.replaceChildren(currentMode.EditorElement)

        // Store the current choice in local storage.
        localStorage.setItem('editorMode', currentMode.name)

        // Load the previous state for the new editor.
        if (currentMode.loadState) {
            currentMode.loadState()
        }
    }

    EditorContainer.addEventListener('switch-editor', () => {
        switchEditor()
    })

    // Set the initial editor.
    const previousModeName = localStorage.getItem('editorMode')
    if (previousModeName === lineMode.name) {
        switchEditor(lineMode)
    } else {
        switchEditor(blockMode)
    }

    const ProjectNameInput = tag(
        'input',
        { type: 'text', placeholder: 'Project name...' },
        on('change', () =>
            localStorage.setItem('projectName', ProjectNameInput.value),
        ),
    )

    // Set initial project name.
    const previousProjectName = localStorage.getItem('projectName')
    if (previousProjectName) {
        ProjectNameInput.value = previousProjectName
    }

    const Toolbar = tag(
        'tool-bar',
        ProjectNameInput,
        button(
            'Save',
            on('click', () => currentMode.saveCode(ProjectNameInput)),
        ),
        button(
            'Load',
            on('click', () => currentMode.loadCode(ProjectNameInput)),
        ),
        button(
            'Switch editor',
            on('click', () => switchEditor()),
        ),
        button(
            'Load example',
            on('click', () => {}),
        ),
    )

    const Navbar = tag(
        'nav',
        a(
            { href: 'https://protorobotics.org' },
            img({
                src: '/images/proto-logo.png',
                alt: 'The PROTO logo',
                height: '32',
            }),
        ),
        a({ href: '/cheatsheet' }, 'Cheatsheet'),
    )

    const CustomTooltip = tooltipHelper() // TODO: rename to initTooltip?

    const PageContent = [
        header(Navbar, Toolbar),
        EditorContainer,
        CustomTooltip,
        footer(
            'PROTO Robotics | ',
            a('Contact us', { href: 'mailto:outreach@protorobotics.org' }),
            ' | ',
            a('View page source', {
                href: 'https://github.com/proto-robotics/proto-robotics.github.io',
            }),
        ),
    ]

    return PageContent
}
