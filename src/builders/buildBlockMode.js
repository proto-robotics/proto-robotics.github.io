import {
    Events,
} from 'blockly'

import { button, on, tag } from 'ellipsi'

import { EditorMode } from '../classes/editorMode'
import { saveFilesInZip } from '../helpers/zipHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import {
    addBlocklyChangeListener,
    createBlocklyInstance,
    getBlocklyCode,
    getBlocklyState,
    mountBlocklyWorkspace,
    setBlocklyState,
} from '../helpers/blocklyHelper'

import {
    createCodeMirrorView,
    getCodeMirrorText,
    setCodeMirrorText,
} from '../helpers/codeMirrorHelper'

export default (toolbox) => {
    const codePreview = createCodeMirrorView({ readonly: true, noGutter: true })
    codePreview.dom.id = 'code-preview'

    const blocklyInstance = createBlocklyInstance(toolbox)
    const CopyToLineEditorButton = button(
        'Open in Line Editor',
        { id: 'copy-to-line-editor-button' },
        on('click', async () => {
            localStorage.setItem('codeMirrorState', getCodeMirrorText(codePreview))
            const switchEvent = new CustomEvent('switch-editor')
            document.dispatchEvent(switchEvent)
        }),
    )

    const BlockEditor = tag(
        'block-editor',
        blocklyInstance.canvas,
        codePreview.dom,
        CopyToLineEditorButton,
    )
    mountBlocklyWorkspace(blocklyInstance, BlockEditor, {
        onReady: () => {
            if (!BlockEditor.parentElement) {
                return false
            }
            loadState()
        },
    })

    const supportedEvents = new Set([
        Events.BLOCK_CHANGE,
        Events.BLOCK_CREATE,
        Events.BLOCK_DELETE,
        Events.BLOCK_MOVE,
    ])

    const saveState = () => {
        const state = getBlocklyState(blocklyInstance)
        localStorage.setItem('blocklyState', JSON.stringify(state))
    }

    const loadState = () => {
        const previousState = localStorage.getItem('blocklyState')
        if (previousState) {
            // Timeout prevents styles from breaking
            setTimeout(() => {
                setBlocklyState(blocklyInstance, JSON.parse(previousState))
            })
        }
    }

    addBlocklyChangeListener(blocklyInstance, (event) => {
        if (
            blocklyInstance.workspace.isDragging() ||
            !supportedEvents.has(event.type)
        ) {
            return
        }

        const code = getBlocklyCode(blocklyInstance)
        setCodeMirrorText(codePreview, 'import make\n\n' + code)
        saveState()
    })

    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'

        // Save the blockly state.
        const blocklyState = getBlocklyState(blocklyInstance)

        saveFilesInZip(projectName, [
            {
                name: 'main.py',
                text: getCodeMirrorText(codePreview),
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
                    setBlocklyState(blocklyInstance, state)
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

    return new EditorMode(
        'block',
        BlockEditor,
        saveCode,
        loadCode,
        saveState,
        loadState,
    )
}
