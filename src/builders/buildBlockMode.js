/*
 * The block editor: the Blockly canvas with its toolbox (with the Devices
 * section when asked for), the code drawer showing the generated Python,
 * and the controls over the canvas. The
 * workspace is rebuilt in place when the window enters or leaves the phone
 * layout, since Blockly fixes the toolbox's side when it is created.
 */

import { Events } from 'blockly'
import { button, on, tag } from 'ellipsi'
import { shadowBlockConversionChangeListener } from '@blockly/shadow-block-converter'
import { pythonGenerator } from 'blockly/python'

import { announceHistoryChange, EditorMode } from '../classes/editorMode'
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
import {
    adoptDeviceBlocks,
    devicesCode,
    getDevices,
    watchDevices,
} from '../helpers/devicesHelper'
import { createDrawer, openDrawer } from '../helpers/drawerHelper'
import { createMinimapController } from '../helpers/minimapHelper'
import { onPhoneLayoutChange } from '../helpers/phoneLayoutHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import { createToolboxDrawer } from '../helpers/toolboxDrawerHelper'
import { saveFilesInZip } from '../helpers/zipHelper'
import { getRoot } from '../helpers/rootHelper'
import { devicesButton } from '../mods/devicesDialog'
import { lintBlocks } from '../mods/blockLinter'
import { createIssuesDrawer } from '../helpers/issuesDrawerHelper'

/** The workspace events after which the program is regenerated and saved. */
const programChangeEvents = new Set([
    Events.BLOCK_CHANGE,
    Events.BLOCK_CREATE,
    Events.BLOCK_DELETE,
    Events.BLOCK_MOVE,
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
 * @param {boolean} [options.sounds=true] Blockly's click sounds. The embed
 *     turns them off: opening an AudioContext in an iframe is slow.
 * @param {boolean} [options.codeOpen=false] Start with the code drawer open.
 * @param {boolean} [options.view=false] Show a program without editing it:
 *     no toolbox, trashcan, zoom controls or selection, and the code
 *     drawer starts open. The host still loads a program with setState.
 * @param {boolean} [options.devices=false] Pin a Devices button to the
 *     bottom of the toolbox column; it opens the motors and drivetrains a
 *     program sets up in a pop-up (devicesHelper.js, mods/devicesDialog.js).
 *     Devices saved in a program are honoured either way.
 * @param {boolean} [options.issues=true] An Issues tab on the right, like
 *     the line editor's, listing what the block linter finds
 *     (mods/blockLinter.js). The blocks are marked either way.
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
        codeOpen = false,
        view = false,
        sounds = true,
        devices: showDevices = false,
        issues: showIssues = true,
    } = {},
) => {
    const codePreview = createCodeMirrorView({ readonly: true, noGutter: true })
    codePreview.dom.id = 'code-preview'

    const instanceOptions = view
        ? { readonly: true, hideToolbox: true, startScale: 1, sounds }
        : { maxBlocks, maxInstances, sounds }
    const blocklyInstance = createBlocklyInstance(toolbox, instanceOptions)

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

    if ((view || codeOpen) && showCodePreview) {
        openDrawer(CodeDrawer)
    }

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
    // the program's devices, in a pop-up from a button at the bottom of the toolbox
    const devices =
        showDevices && !view
            ? devicesButton(() => blocklyInstance.workspace ?? null)
            : null
    // what the linter finds, listed in a drawer like the line editor's
    const issues = showIssues && !view ? createIssuesDrawer() : null
    CanvasWrap.append(
        blocklyInstance.canvas,
        toolboxDrawer.Tab,
        ...(capacity ? [capacity.element] : []),
        ...(devices ? [devices.element] : []),
        ...(issues ? [issues.drawer] : []),
    )

    /**
     * Shows a block that has a problem: scrolls to it and selects it.
     * @param {object} block
     */
    const showBlock = (block) => {
        const workspace = blocklyInstance.workspace
        if (!workspace || block.isDisposed() || block.workspace !== workspace) {
            return
        }
        workspace.centerOnBlock(block.id)
        block.select()
    }

    /** Checks the program, marks its blocks and lists what is wrong. */
    const lint = () => {
        const found = lintBlocks(blocklyInstance.workspace)
        issues?.show(
            found.map(({ block, ...issue }) => ({
                ...issue,
                onClick: block
                    ? () => showBlock(block)
                    : devices
                      ? () => devices.show()
                      : undefined,
            })),
        )
    }

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
     * Regenerates the program (the imports, the devices, then the blocks'
     * code) and saves it.
     */
    const refreshProgram = () => {
        if (!blocklyInstance.workspace) {
            return
        }
        const code = getBlocklyCode(blocklyInstance)
        const setup = devicesCode(getDevices(blocklyInstance.workspace))
        setCodeMirrorText(codePreview, PROGRAM_PREAMBLE + setup + code)
        // the viewer only shows a program, so it marks nothing
        if (!view) {
            lint()
        }
        saveState()
        capacity?.update()
    }
    // the devices are part of the program: a change to them, by the
    // learner or by a program loading, regenerates it
    const stopWatchingDevices = watchDevices((workspace) => {
        if (workspace === blocklyInstance.workspace) {
            refreshProgram()
        }
    })

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
        // any change may add to the undo history, or be an undo itself
        if (!event.isUiEvent) {
            announceHistoryChange()
        }

        if (
            blocklyInstance.workspace.isDragging() ||
            !programChangeEvents.has(event.type)
        ) {
            return
        }
        refreshProgram()
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
                if (!view) {
                    startMultiselect(blocklyInstance)
                }
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
        // a motor block from an old program or a cheatsheet copy, pasted
        // in, becomes a device; a viewer has no Devices section, so it
        // keeps showing the block
        if (!view) {
            addBlocklyChangeListener(blocklyInstance, adoptDeviceBlocks)
        }

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
            createBlocklyInstance(editorToolbox, instanceOptions),
        )
        oldCanvas.replaceWith(blocklyInstance.canvas)
        mount(state)
    }
    const stopPhoneLayout = onPhoneLayoutChange(rebuildWorkspace)

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
        getRoot().appendChild(LoadPopUp)
    }

    const mode = new EditorMode({
        name: 'block',
        EditorElement: BlockEditor,
        saveCode,
        loadCode,
        saveState,
        loadState,
        getProjectFiles,
        // the workspace's own undo stack, as Ctrl+Z and Ctrl+Y use it
        history: {
            undo: () => blocklyInstance.workspace?.undo(false),
            redo: () => blocklyInstance.workspace?.undo(true),
            canUndo: () =>
                (blocklyInstance.workspace?.getUndoStack().length ?? 0) > 0,
            canRedo: () =>
                (blocklyInstance.workspace?.getRedoStack().length ?? 0) > 0,
        },
        setState: (state) => {
            if (state) {
                // a viewer has no Devices section, so it shows a saved
                // motor block as a block rather than lifting it out
                setBlocklyState(blocklyInstance, state, { liftDevices: !view })
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

    /**
     * The program with a `make._block('<block id>')` line before every
     * block's code, for a host that runs it somewhere that can report which
     * block is running (a simulator; the real make library has no
     * `_block`). Pass each id it reports to `highlight`.
     * @returns {string} The whole program: imports, devices, then the blocks.
     */
    mode.getTracedCode = () => {
        const workspace = blocklyInstance.workspace
        const before = pythonGenerator.STATEMENT_PREFIX
        pythonGenerator.STATEMENT_PREFIX = 'make._block(%1)\n'
        try {
            return (
                PROGRAM_PREAMBLE +
                devicesCode(getDevices(workspace)) +
                getBlocklyCode(blocklyInstance)
            )
        } finally {
            pythonGenerator.STATEMENT_PREFIX = before
        }
    }

    /**
     * Lights up the block that is running, and the blocks it sits inside
     * (a loop, an if), so they read as running too. A null id, or one that is
     * not in the workspace, turns every light off.
     * @param {string|null} id The running block's id.
     */
    mode.highlight = (id) => {
        const workspace = blocklyInstance.workspace
        if (!workspace) {
            return
        }
        workspace.highlightBlock(null)
        for (
            let block = id ? workspace.getBlockById(id) : null;
            block;
            block = block.getSurroundParent()
        ) {
            workspace.highlightBlock(block.id, true)
        }
    }

    /** Disposes of the workspace, for a host that removes the editor. */
    mode.dispose = () => {
        stopPhoneLayout()
        stopWatchingDevices()
        devices?.destroy()
        destroyBlocklyInstance(blocklyInstance)
    }

    return mode
}
