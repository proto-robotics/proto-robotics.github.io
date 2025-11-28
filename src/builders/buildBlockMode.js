import { Events, getFocusManager, inject, serialization, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { button, code, div, on, pre, tag } from 'ellipsi'

import { EditorMode } from '../classes/editorMode'
import { saveFilesInZip } from '../helpers/zipHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'

import { claimTooltip, releaseTooltip } from '../helpers/tooltipHelper'
import blocks from '../data/blocks'
import { getViewText, newView, setViewText } from '../helpers/codeMirrorHelper'

export default (toolbox) => {
    const codePreview = newView({ readonly: true, noGutter: true })
    const BlocklyCanvas = div({ id: 'block-canvas' })
    const CopyToLineEditorButton = button(
        'Open in Line Editor',
        { id: 'copy-to-line-editor-button' },
        on('click', async () => {
            localStorage.setItem('codeMirrorState', getViewText(codePreview))
            const switchEvent = new CustomEvent('switch-editor')
            document.dispatchEvent(switchEvent)
        }),
    )

    const BlockEditor = tag(
      'block-editor',
      BlocklyCanvas,
      codePreview.dom,
      CopyToLineEditorButton
    )

    codePreview.dom.id = 'code-preview'

    const workspace = inject(BlocklyCanvas, {
        toolbox: toolbox,
    })

    const supportedEvents = new Set([
        Events.BLOCK_CHANGE,
        Events.BLOCK_CREATE,
        Events.BLOCK_DELETE,
        Events.BLOCK_MOVE,
    ])

    const saveState = () => {
        const state = serialization.workspaces.save(workspace)
        localStorage.setItem('blocklyState', JSON.stringify(state))
    }

    const loadState = () => {
        const previousState = localStorage.getItem('blocklyState')
        if (previousState) {
            // Timeout prevents styles from breaking
            setTimeout(() => {
                serialization.workspaces.load(
                    JSON.parse(previousState),
                    workspace,
                )
            })
        }
    }

    workspace.addChangeListener((event) => {
        if (workspace.isDragging() || !supportedEvents.has(event.type)) {
            return
        }

        const code = pythonGenerator.workspaceToCode(workspace)
        setViewText(codePreview, 'import make\n\n' + code)
        saveState()
    })

    // Redraw the canvas when it is rendered, and load the previous code the
    // first time it is rendered
    let hasRendered = false
    const resizeObserver = new ResizeObserver(() => {
        svgResize(workspace)

        if (hasRendered || !BlockEditor.parentElement) {
            return
        }

        // Only executed the first time the blockly editor is rendered
        hasRendered = true

        // Load previous state if one exists
        loadState()
    })
    resizeObserver.observe(BlockEditor)

    // TODO: for debug only
    const focusManager = getFocusManager()
    BlocklyCanvas.addEventListener("click", () => {
        const node = focusManager.getFocusedNode()
        console.log(node)
    })

    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'

        // Save the blockly state.
        const blocklyState = serialization.workspaces.save(workspace)

        saveFilesInZip(projectName, [
            {
                name: 'main.py',
                text: getViewText(codePreview),
            },
            {
                name: projectName + '.json',
                text: JSON.stringify(blocklyState),
            },
        ])
    }

    let blockDescriptionDictionary = getBlockDescriptionDictionary(blocks)
    let hoverTimer = null
    let currentHoveredBlock = null

    function attachCustomTooltipHandlers(workspace) {
        workspace.addChangeListener(() => {
            for (const block of workspace.getAllBlocks(false)) {
                const svgRoot = block.getSvgRoot()
                if (svgRoot.customTooltipAttached) continue
                svgRoot.customTooltipAttached = true

                svgRoot.addEventListener('mouseenter', (e) => {
                    currentHoveredBlock = block
                    hoverTimer = setTimeout(() => {
                        if (currentHoveredBlock === block) {
                            claimTooltip(
                                'Block',
                                { x: e.pageX, y: e.pageY },
                                blockDescriptionDictionary[block.type],
                            )
                        }
                    }, 1000)
                })

                svgRoot.addEventListener('mouseleave', () => {
                    clearTimeout(hoverTimer)
                    currentHoveredBlock = null
                    releaseTooltip('Block')
                })
            }
        })
    }

    attachCustomTooltipHandlers(workspace)

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

function getBlockDescriptionDictionary(categories) {
    const dictionary = {}
    for (const category of categories) {
        for (const entry of category.entries) {
            dictionary[entry.name] = entry.description
        }
    }
    return dictionary
}
