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

    let hasRendered = false
    const resizeObserver = new ResizeObserver(() => {
        svgResize(workspace)

        if (hasRendered || !BlockEditor.parentElement) {
            return
        }

        // Only executed the first time the blockly editor is rendered
        hasRendered = true

        // Load previous state if one exists
        const previousState = localStorage.getItem('blocklyState')
        if (previousState) {
            // Timeout prevents styles from breaking
            setTimeout(() => {
                serialization.workspaces.load(JSON.parse(previousState), workspace)
            })
        }
    })
    resizeObserver.observe(BlockEditor)

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
                const projectName = file.name.replaceAll('.json', '')
                ProjectNameInput.value = projectName
                localStorage.setItem('projectName', projectName)

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
            'choose the file inside it with the same name.',
            FileInput,
            LoadButton,
        )

        document.body.appendChild(LoadPopUp)
    }

    return new EditorMode('block', BlockEditor, saveCode, loadCode)
}
