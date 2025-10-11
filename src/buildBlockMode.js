import { Events, inject, serialization, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { code, div, pre, tag } from 'ellipsi'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'

import { EditorMode } from './editorMode'
import { saveFilesInZip } from './zipHelper'

export default (toolbox) => {
    const BlocklyCanvas = div({ id: 'block-canvas' })
    const CodePreview = code({ id: 'block-code' })
    const BlockEditor = tag('block-editor', BlocklyCanvas, pre(CodePreview))

    const workspace = inject(BlocklyCanvas, {
        toolbox: toolbox,
    })
    // Render the workspace once the page loads.
    document.addEventListener('DOMContentLoaded', () => svgResize(workspace))
    // TODO: fix

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

    const saveCode = (ProjectNameInput) => {
        const zipName = ProjectNameInput?.value || 'proto.zip'

        // Save the blockly state.
        const blocklyState = serialization.workspaces.save(workspace)

        saveFilesInZip(zipName, [
            {
                name: 'main.py',
                text: CodePreview.innerText,
            },
            {
                name: 'blocks.json',
                text: JSON.stringify(blocklyState),
            },
        ])
    }

    const loadCode = (ProjectNameInput) => {
        console.error('not implemented')
    }

    return new EditorMode('block', BlockEditor, saveCode, loadCode)
}
