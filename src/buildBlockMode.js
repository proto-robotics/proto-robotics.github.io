import { Events, inject } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { code, div, pre, tag } from 'ellipsi'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'

import { EditMode } from './editMode'

export default (toolbox) => {
    const BlocklyCanvas = div({ id: 'block-canvas' })
    const CodePreview = code({ id: 'block-code'})
    const BlockEditor = tag('block-editor',
        BlocklyCanvas,
        pre(CodePreview),
    )

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

    const saveCode = () => {
        console.debug(CodePreview.innerText)
    }

    const loadCode = () => {
        console.error('not implemented')
    }

    return new EditMode(BlockEditor, saveCode, loadCode)
}
