import { Events, inject } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { code, div, pre, tag } from 'ellipsi'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'

export default (toolbox) => {
    const BlocklyCanvas = div()
    const CodePreview = code()

    const workspace = inject(BlocklyCanvas, {
        toolbox: toolbox,
    })

    const supportedEvents = new Set([
        Events.BLOCK_CHANGE,
        Events.BLOCK_CREATE,
        Events.BLOCK_DELETE,
        Events.BLOCK_MOVE,
    ])

    workspace.addChangeListener((event) => {
        if (workspace.isDragging() || !supportedEvents.has(event.type)) {
            return
        }

        const code = pythonGenerator.workspaceToCode(workspace)
        CodePreview.innerHTML = highlight(
            'import make\n\n' + code,
            languages.python,
            'python',
        )
    })

    const BlockEditor = tag('block-editor',
        BlocklyCanvas,
        pre(CodePreview),
    )

    return BlockEditor
}
