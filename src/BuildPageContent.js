import { a, button, footer, header, on, span, tag } from "ellipsi"
import BuildBlockEditor from "./BuildBlockEditor"
import BuildLineEditor from "./BuildLineEditor"

export default (toolbox, vocab) => {
    const BlockEditor = BuildBlockEditor(toolbox)
    const LineEditor = BuildLineEditor(vocab)

    /** Contains the current editor. */
    const EditorContainer = span(BlockEditor)

    const switchEditor = () => {
        // Only moves references around, neither editor is removed from memory.
        if (EditorContainer.contains(BlockEditor)) {
            EditorContainer.replaceChildren(LineEditor)
        } else {
            EditorContainer.replaceChildren(BlockEditor)
        }
    }

    const Navbar = tag('nav',
        a({ href: 'https://protorobotics.org' }, 'PROTO'),
        a({ href: '/cheatsheet' }, 'Cheatsheet'),
    )

    const Toolbar = tag('tool-bar',
        button('Save', on('click', console.log)),
        button('Load', on('click', console.log)),
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
