/*
 * The block editor: the Blockly canvas with its toolbox, the code drawer
 * showing the generated Python, and the controls over the canvas. The
 * workspace is rebuilt in place when the window enters or leaves the phone
 * layout, since Blockly fixes the toolbox's side when it is created.
 */

import { Events } from 'blockly'
import { button, on, tag } from 'ellipsi'
import { shadowBlockConversionChangeListener } from '@blockly/shadow-block-converter'
import { backpackChange } from '@blockly/workspace-backpack'

import { EditorMode } from '../classes/editorMode'
import { createBlockCapacity } from '../helpers/blockCapacityHelper'
import {
    addBlocklyChangeListener,
    createBlocklyInstance,
    destroyBlocklyInstance,
    getBlocklyCode,
    getBlocklyState,
    mountBlocklyWorkspace,
    resizeBlocklyInstance,
    setBlocklyState,
    startMultiselect,
} from '../helpers/blocklyHelper'
import {
    createCodeMirrorView,
    getCodeMirrorText,
    PROGRAM_PREAMBLE,
    setCodeMirrorText,
} from '../helpers/codeMirrorHelper'
import { createDrawer } from '../helpers/drawerHelper'
import { createMinimapController } from '../helpers/minimapHelper'
import { onPhoneLayoutChange } from '../helpers/phoneLayoutHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import { createToolboxDrawer } from '../helpers/toolboxDrawerHelper'
import { saveFilesInZip } from '../helpers/zipHelper'

/** The workspace events after which the program is regenerated and saved. */
const programChangeEvents = new Set([
    Events.BLOCK_CHANGE,
    Events.BLOCK_CREATE,
    Events.BLOCK_DELETE,
    Events.BLOCK_MOVE,
    backpackChange, // the backpack is saved with the workspace
])

/**
 * Builds the block editor mode.
 * @param {object} toolbox Blockly toolbox configuration.
 * @param {object} [options] Embedding options (see BuildEmbedContent).
 * @param {boolean} [options.persist=true] Keep workspace state in local
 *     storage. An embedding page owns the state instead and passes false.
 * @param {boolean} [options.lineEditorButton=true] Show "Open in Line Editor"
 *     at the foot of the code drawer.
 * @param {(detail: {code: string, state: object}) => void} [options.onChange]
 *     Called after every change with the generated code and workspace state.
 * @param {number} [options.maxBlocks] Cap on blocks in the workspace; shows
 *     a "blocks left" counter.
 * @param {Record<string, number>} [options.maxInstances] Per-type caps.
 * @param {boolean} [options.codePreview=true] Show the code drawer beside
 *     the blocks. Code is still generated for saving and for the host.
 * @returns {EditorMode} The block editor mode, with `setMinimap`.
 */
export default (
    toolbox,
    {
        persist = true,
        lineEditorButton = true,
        onChange = null,
        maxBlocks = undefined,
        maxInstances = undefined,
        codePreview: showCodePreview = true,
    } = {},
) => {
    const codePreview = createCodeMirrorView({ readonly: true, noGutter: true })
    codePreview.dom.id = 'code-preview'

    const blocklyInstance = createBlocklyInstance(toolbox, {
        maxBlocks,
        maxInstances,
    })

    // ---- the elements ------------------------------------------------------

    const OpenInLineEditorButton = button(
        'Open in Line Editor',
        { id: 'open-in-line-editor-button' },
        on('click', () => {
            localStorage.setItem(
                'codeMirrorState',
                getCodeMirrorText(codePreview),
            )
            document.dispatchEvent(new CustomEvent('switch-editor'))
        }),
    )

    // The generated Python lives in a drawer on the right, like the
    // cheatsheet, with the line-editor button at its foot.
    const { drawer: CodeDrawer } = createDrawer({
        elementName: 'code-drawer',
        tabId: 'code-drawer-tab',
        panelId: 'code-drawer-panel',
        tabLabel: 'Code',
        panelContent: [
            codePreview.dom,
            ...(lineEditorButton ? [OpenInLineEditorButton] : []),
        ],
    })

    const capacity = createBlockCapacity(blocklyInstance, maxBlocks)

    // The canvas gets a positioned wrapper for the things pinned over it;
    // the editor itself must stay unpositioned (see block-editor in
    // styles.css).
    const CanvasWrap = tag('div', { class: 'block-canvas-wrap' })
    const BlockEditor = tag(
        'block-editor',
        CanvasWrap,
        ...(showCodePreview ? [CodeDrawer] : []),
    )
    const toolboxDrawer = createToolboxDrawer(blocklyInstance, BlockEditor)
    CanvasWrap.append(
        blocklyInstance.canvas,
        toolboxDrawer.Tab,
        ...(capacity ? [capacity.element] : []),
    )

    const minimap = createMinimapController(blocklyInstance, BlockEditor)

    // ---- state ---------------------------------------------------------------

    /** Saves the workspace to local storage and reports the change. */
    const saveState = () => {
        const state = getBlocklyState(blocklyInstance)
        if (persist) {
            localStorage.setItem('blocklyState', JSON.stringify(state))
        }
        onChange?.({ code: getCodeMirrorText(codePreview), state })
    }

    /**
     * Restores the workspace after it has mounted.
     * @param {object|null} [state] The state to restore; otherwise the saved
     *     one, when the mode persists.
     */
    const loadState = (state = null) => {
        // the editor may just have been put on screen (switching editors)
        setTimeout(minimap.apply)
        const saved = persist ? localStorage.getItem('blocklyState') : null
        const previousState = state ?? (saved ? JSON.parse(saved) : null)
        if (previousState) {
            // Defer loading until Blockly has completed its initial layout.
            setTimeout(() => {
                setBlocklyState(blocklyInstance, previousState)
            })
        }
    }

    /**
     * Regenerates the program and saves after every change to the blocks.
     * @param {object} event A workspace change event.
     */
    const onWorkspaceChange = (event) => {
        if (event.type === Events.TOOLBOX_ITEM_SELECT) {
            // the flyout opens or closes after this event
            setTimeout(toolboxDrawer.place)
        }
        capacity?.onEvent(event)

        if (
            blocklyInstance.workspace.isDragging() ||
            !programChangeEvents.has(event.type)
        ) {
            return
        }
        const code = getBlocklyCode(blocklyInstance)
        setCodeMirrorText(codePreview, PROGRAM_PREAMBLE + code)
        saveState()
        capacity?.update()
    }

    // ---- the workspace -------------------------------------------------------

    /**
     * Puts the workspace on the page and wires it up. Run once at the
     * start, and again for each rebuilt workspace.
     * @param {object|null} [restoredState] The program for a rebuilt workspace.
     */
    const mount = (restoredState = null) => {
        mountBlocklyWorkspace(blocklyInstance, BlockEditor, {
            onReady: () => {
                if (!BlockEditor.parentElement) {
                    return false
                }
                startMultiselect(blocklyInstance)
                loadState(restoredState)
                capacity?.update()
                minimap.apply()
                toolboxDrawer.apply()
            },
        })

        // Editing a shadow block (a default value slot) turns it into a
        // real block, so it can be moved or deleted; the shadow comes back
        // when it is removed. Standard Blockly would keep the edit in the
        // shadow.
        addBlocklyChangeListener(
            blocklyInstance,
            shadowBlockConversionChangeListener,
        )
        addBlocklyChangeListener(blocklyInstance, onWorkspaceChange)

        // The editor watches its own size, but the code drawer changes only
        // the canvas's share of it, so the canvas is watched too.
        const canvasObserver = new ResizeObserver(() => {
            resizeBlocklyInstance(blocklyInstance)
            toolboxDrawer.place()
        })
        canvasObserver.observe(blocklyInstance.canvas)
        blocklyInstance.resizeObservers.push(canvasObserver)
    }
    mount()

    /**
     * Builds the workspace afresh for the other layout, with the same
     * program. The undo history goes with the old workspace.
     */
    const rebuildWorkspace = () => {
        if (!blocklyInstance.workspace) {
            return
        }
        const state = getBlocklyState(blocklyInstance)
        const oldCanvas = blocklyInstance.canvas
        destroyBlocklyInstance(blocklyInstance)
        Object.assign(
            blocklyInstance,
            createBlocklyInstance(toolbox, { maxBlocks, maxInstances }),
        )
        oldCanvas.replaceWith(blocklyInstance.canvas)
        mount(state)
    }
    onPhoneLayoutChange(rebuildWorkspace)

    // ---- the project ---------------------------------------------------------

    /**
     * The project's files: the generated Python and the blocks.
     * @param {string} projectName Names the blocks file.
     * @returns {{name: string, text: string}[]} The files.
     */
    const getProjectFiles = (projectName) => [
        {
            name: 'main.py',
            text: getCodeMirrorText(codePreview),
        },
        {
            name: projectName + '.json',
            text: JSON.stringify(getBlocklyState(blocklyInstance)),
        },
    ]

    /**
     * Downloads the generated Python and the blocks as a project archive.
     * @param {HTMLInputElement} ProjectNameInput Project-name field.
     */
    const saveCode = (ProjectNameInput) => {
        const projectName = ProjectNameInput?.value || 'proto'
        saveFilesInZip(projectName, getProjectFiles(projectName))
    }

    /**
     * Opens a dialog that imports a blocks file.
     * @param {HTMLInputElement} ProjectNameInput Project-name field.
     */
    const loadCode = (ProjectNameInput) => {
        const FileInput = tag('input', {
            type: 'file',
            accept: 'application/json',
        })

        const LoadButton = button(
            'Load Project',
            on('click', () => {
                if (FileInput.files.length < 1) {
                    return // wait for a file
                }
                const file = FileInput.files[0]

                const projectName = file.name.replaceAll('.json', '')
                ProjectNameInput.value = projectName
                localStorage.setItem('projectName', projectName)

                const reader = new FileReader()
                reader.readAsText(file, 'utf-8')
                reader.onload = (event) => {
                    setBlocklyState(
                        blocklyInstance,
                        JSON.parse(event.target.result),
                    )
                }

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

    const mode = new EditorMode({
        name: 'block',
        EditorElement: BlockEditor,
        saveCode,
        loadCode,
        saveState,
        loadState,
        getProjectFiles,
        setState: (state) => {
            if (state) {
                setBlocklyState(blocklyInstance, state)
            } else {
                blocklyInstance.workspace.clear()
            }
            capacity?.update()
        },
    })

    /**
     * Shows or hides the minimap over the canvas.
     * @param {boolean} wanted Whether the minimap should be shown.
     */
    mode.setMinimap = minimap.setWanted

    return mode
}
