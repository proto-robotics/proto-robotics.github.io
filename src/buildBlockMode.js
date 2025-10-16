import { Events, inject, serialization, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { button, code, div, on, pre, tag } from 'ellipsi'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'

import { EditorMode } from './editorMode'
import { saveFilesInZip } from './zipHelper'
import { closePopUpEvent, PopUp } from './popUpHelper'

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

        const state = serialization.workspaces.save(workspace)
        localStorage.setItem('blocklyState', JSON.stringify(state))
    })

    // Load previous state if one exists
    // TODO: delay until block editor is shown
    // const previousState = localStorage.getItem('blocklyState')
    // if (previousState) {
    //     serialization.workspaces.load(JSON.parse(previousState), workspace)
    // }

    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'

        // Save the blockly state.
        const blocklyState = serialization.workspaces.save(workspace)

        saveFilesInZip(projectName, [
            {
                name: 'main.py',
                text: CodePreview.innerText,
            },
            {
                name: projectName + '.json',
                text: JSON.stringify(blocklyState),
            },
        ])
    }

    const loadCode = (ProjectNameInput) => {
        const FileInput = tag('input', {
            type: 'file',
            accept: 'application/json',
        })

        const LoadButton = button(
            'Load project',
            on('click', () => {
                if (FileInput.files.length < 1) {
                    // Wait for them to add a file
                    return
                }

                const file = FileInput.files[0]

                // Set project name to the file name
                ProjectNameInput.value = file.name.replaceAll('.json', '')

                // Load the contents of the file
                const reader = new FileReader()
                reader.readAsText(file, 'utf-8')
                reader.onload = (event) => {
                    const state = JSON.parse(event.target.result)
                    serialization.workspaces.load(state, workspace)
                }

                // Close the pop up
                LoadPopUp.dispatchEvent(new Event(closePopUpEvent))
            }),
        )

        const LoadPopUp = PopUp(
            'Find the zip file for the project in your downloads folder, and ',
            'choose the file named "blocks.json"',
            FileInput,
            LoadButton,
        )

        document.body.appendChild(LoadPopUp)
    }

    return new EditorMode('block', BlockEditor, saveCode, loadCode)
}
