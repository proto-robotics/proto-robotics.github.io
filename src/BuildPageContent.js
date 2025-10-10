import { a, button, footer, header, img, on, span, tag } from "ellipsi"
import buildBlockMode from "./buildBlockMode"
import buildLineMode from "./buildLineMode"
import { EditMode } from "./editMode"

export default (toolbox, vocab) => {
    const blockMode = buildBlockMode(toolbox)
    const lineMode = buildLineMode(vocab)

    /** @type {EditMode} The current editor mode. */
    let currentMode = null

    // Contains the current editor element.
    const EditorContainer = span()

    const switchEditor = () => {
        // Only moves references around, neither editor is removed from memory.
        if (currentMode === blockMode) {
            currentMode = lineMode
        } else {
            currentMode = blockMode
        }

        EditorContainer.replaceChildren(currentMode.EditorElement)
    }
    switchEditor()  // Set initial state.

    const Navbar = tag('nav',
        a({ href: 'https://protorobotics.org' }, img({ src: '/images/proto-logo.png', alt: 'The PROTO logo', height: '32' })),
        a({ href: '/cheatsheet' }, 'Cheatsheet'),
    )

    const Toolbar = tag('tool-bar',
        button('Save', on('click', () => currentMode.saveCode())),
        button('Load', on('click', () => currentMode.loadCode())),
        button('Switch editor', on('click', switchEditor)),
    )

    const PageContent = [
        header(
            Navbar,
            Toolbar,
        ),
        EditorContainer,
        footer(
            'PROTO Robotics | ',
            a('Contact us', { href: 'mailto:outreach@protorobotics.org' }),
            ' | ',
            a('Page source', { href: 'https://github.com/proto-robotics/proto-robotics.github.io' }),
        ),
    ]

    return PageContent
}
