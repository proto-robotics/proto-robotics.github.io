/*
 * The block editor: the Blockly canvas with its toolbox (and the Devices
 * button when asked for), the code drawer showing the generated Python,
 * and the controls over the canvas. The
 * workspace is rebuilt in place when the window enters or leaves the phone
 * layout, since Blockly fixes the toolbox's side when it is created.
 */

import { Events, serialization, utils } from 'blockly'
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
    programPreamble,
    setCodeMirrorText,
} from '../helpers/codeMirrorHelper'
import {
    devicesCode,
    getDevices,
    setDevices,
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
import { addNote, startNotes } from '../mods/notes'
import { createClickModes } from '../mods/clickModes'
import { openDevicesEvent, syncToolboxDevices } from '../mods/deviceField'
import { lintBlocks } from '../mods/blockLinter'
import { numberShadowTypes } from '../libraries/engine'
import { UNKNOWN_BLOCK, UNKNOWN_VALUE, unknownMessage } from '../libraries/unknownBlocks'
import { createIssuesDrawer } from '../helpers/issuesDrawerHelper'

/** The workspace events after which the program is regenerated and saved. */
const programChangeEvents = new Set([
    Events.BLOCK_CHANGE,
    Events.BLOCK_CREATE,
    Events.BLOCK_DELETE,
    Events.BLOCK_MOVE,
    // notes (mods/notes.js) are saved with the program, and a linked
    // note's text is part of its Python
    Events.COMMENT_CREATE,
    Events.COMMENT_DELETE,
    Events.COMMENT_CHANGE,
    Events.COMMENT_MOVE,
    Events.COMMENT_RESIZE,
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
        blockTypes = null,
    } = {},
) => {
    const codePreview = createCodeMirrorView({ readonly: true, noGutter: true })
    codePreview.dom.id = 'code-preview'

    const instanceOptions = view
        ? { readonly: true, hideToolbox: true, startScale: 1, sounds, blockTypes }
        : { maxBlocks, maxInstances, sounds, blockTypes }
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
    // the program's devices and variables, in a pop-up from a button at
    // the bottom of the toolbox
    const devices =
        showDevices && !view
            ? devicesButton(() => blocklyInstance.workspace ?? null)
            : null
    // a dropdown's "+ Add a drive motor" opens the Devices pop-up
    const onOpenDevices = () => devices?.show()
    if (devices) {
        document.addEventListener(openDevicesEvent, onOpenDevices)
    }
    // what the linter finds, listed in a drawer like the line editor's
    const issues = showIssues && !view ? createIssuesDrawer() : null
    // a Note button at the bottom right: a sticky note to point at a block
    const NoteButton = view
        ? null
        : button(
              { type: 'button', class: 'note-button', title: 'Add a note' },
              tag('span', { class: 'note-button-icon', 'aria-hidden': 'true' }),
              tag('span', 'Note'),
              on('click', () => {
                  const workspace = blocklyInstance.workspace
                  if (workspace) {
                      addNote(workspace).select?.()
                  }
              }),
          )
    // a Disable button by it: while on, a click turns a block off or on
    const clickModes = view
        ? null
        : createClickModes(() => blocklyInstance, CanvasWrap)
    const CornerButtons = NoteButton
        ? tag(
              'div',
              { class: 'canvas-corner-buttons' },
              clickModes.button,
              NoteButton,
          )
        : null
    CanvasWrap.append(
        blocklyInstance.canvas,
        toolboxDrawer.Tab,
        ...(capacity ? [capacity.element] : []),
        ...(devices ? [devices.element] : []),
        ...(CornerButtons ? [CornerButtons] : []),
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
                    : devices && (() => devices.show()),
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
        setCodeMirrorText(codePreview, programPreamble() + setup + code)
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
            // the toolbox's blocks show the devices there are now
            syncToolboxDevices(workspace)
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
                    blocklyInstance.cleanupCallbacks.push(clickModes.start())
                    // notes: the edge handle, links to blocks, their lines
                    blocklyInstance.cleanupCallbacks.push(
                        startNotes(blocklyInstance.workspace, refreshProgram),
                    )
                }
                loadState(restoredState)
                // the toolbox's device and variable dropdowns, once the
                // program (which loads a moment later) is in
                setTimeout(() =>
                    setTimeout(() =>
                        syncToolboxDevices(blocklyInstance.workspace),
                    ),
                )
                capacity?.update()
                minimap.apply()
                toolboxDrawer.apply()
            },
        })

        // Editing a shadow block (a default value slot) turns it into a
        // real block, so it can be moved or deleted; the shadow comes back
        // when it is removed. Standard Blockly would keep the edit in the
        // shadow. Not for a number in its slot (num_50 and the like): a
        // typed number is just the block's value, and as a real block it
        // counted against the block limit, which took it straight back out
        // (the number snapped back to its default).
        addBlocklyChangeListener(blocklyInstance, (event) => {
            if (event.type === Events.BLOCK_CHANGE) {
                const block = blocklyInstance.workspace?.getBlockById(
                    event.blockId,
                )
                if (block && numberShadowTypes.has(block.type)) {
                    return
                }
            }
            shadowBlockConversionChangeListener(event)
        })
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
            createBlocklyInstance(toolbox, instanceOptions),
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

    /**
     * Puts a saved program's blocks into the workspace beside what is
     * already there, as one undoable step: its stacks keep their places
     * relative to each other, with their top-left corner at the screen
     * point given (where a host's drag let go) or else just under the
     * existing blocks. Its devices that this program has no device of the
     * same name for are added too. Each block gets a new id, so the same
     * program can be put in twice. The block limit still applies.
     * @param {object} state A saved program: `{ devices, blocks }`.
     * @param {number} [clientX] Where on the screen, if dropped.
     * @param {number} [clientY]
     */
    mode.addBlocks = (state, clientX, clientY) => {
        const workspace = blocklyInstance.workspace
        if (!workspace || !state) {
            return
        }
        const have = getDevices(workspace)
        const extra = (state.devices ?? []).filter(
            (device) => !have.some((mine) => mine.name === device.name),
        )
        if (extra.length) {
            setDevices(workspace, [...have, ...extra])
        }
        const stacks = state.blocks?.blocks ?? []
        if (!stacks.length) {
            return
        }
        const minX = Math.min(...stacks.map((b) => b.x ?? 0))
        const minY = Math.min(...stacks.map((b) => b.y ?? 0))
        let at
        if (clientX !== undefined && clientY !== undefined) {
            at = utils.svgMath.screenToWsCoordinates(
                workspace,
                new utils.Coordinate(clientX, clientY),
            )
        } else {
            const box = workspace.getBlocksBoundingBox()
            const empty = !workspace.getTopBlocks(false).length
            at = empty
                ? new utils.Coordinate(20, 20)
                : new utils.Coordinate(box.left, box.bottom + 40)
        }
        // a copy without ids, so Blockly makes new ones
        const withoutIds = (block) => {
            if (!block || typeof block !== 'object') {
                return block
            }
            // eslint-disable-next-line no-unused-vars
            const { id, ...rest } = block
            const out = { ...rest }
            if (rest.inputs) {
                out.inputs = Object.fromEntries(
                    Object.entries(rest.inputs).map(([name, input]) => [
                        name,
                        {
                            ...input,
                            ...(input.block
                                ? { block: withoutIds(input.block) }
                                : {}),
                            ...(input.shadow
                                ? { shadow: withoutIds(input.shadow) }
                                : {}),
                        },
                    ]),
                )
            }
            if (rest.next?.block) {
                out.next = { block: withoutIds(rest.next.block) }
            }
            return out
        }
        Events.setGroup(true)
        try {
            for (const stack of stacks) {
                serialization.blocks.append(
                    {
                        ...withoutIds(stack),
                        x: at.x + (stack.x ?? 0) - minX,
                        y: at.y + (stack.y ?? 0) - minY,
                    },
                    workspace,
                    { recordUndo: true },
                )
            }
        } finally {
            Events.setGroup(false)
        }
    }

    /**
     * The program with a marker line before every block's code, for a host
     * that runs it somewhere that can report which block is running (a
     * simulator). The host says what the line is: `sim.block(%1)`, with %1
     * standing for the block's id in quotes. Pass each id it reports to
     * `highlight`.
     * @param {string} marker The line, with %1 for the id.
     * @returns {string} The whole program: imports, devices, then the blocks.
     */
    mode.getTracedCode = (marker) => {
        const workspace = blocklyInstance.workspace
        const before = pythonGenerator.STATEMENT_PREFIX
        pythonGenerator.STATEMENT_PREFIX = `${marker}\n`
        try {
            return (
                programPreamble() +
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

    /**
     * Where a block's part is on the screen, for a host that points at it
     * (an arrow from a control beside the editor): a number slot by its
     * name, or a field (a dropdown) by its name.
     * @param {string} id The block's id.
     * @param {string} name The slot's or field's name.
     * @returns {DOMRect|null} Its box in page coordinates, or null when
     *     the block or the part is not drawn.
     */
    mode.partBox = (id, name) => {
        const block = blocklyInstance.workspace?.getBlockById(id)
        if (!block) {
            return null
        }
        const field = block.getField(name)
        const inSlot = block.getInput(name)?.connection?.targetBlock()
        const element = field?.getSvgRoot?.() ?? inSlot?.getSvgRoot?.() ?? null
        return element ? element.getBoundingClientRect() : null
    }

    /**
     * What keeps the program off the brain: a block this editor does not
     * have (a stand-in, libraries/unknownBlocks.js), in the Issues list's
     * words, once each.
     * @returns {string[]}
     */
    mode.getSendBlockers = () => {
        const workspace = blocklyInstance.workspace
        if (!workspace) {
            return []
        }
        const messages = workspace
            .getAllBlocks(false)
            .filter((block) => block.type === UNKNOWN_BLOCK || block.type === UNKNOWN_VALUE)
            .map((block) => unknownMessage(block.original_?.type ?? '?'))
        return [...new Set(messages)]
    }

    /** Disposes of the workspace, for a host that removes the editor. */
    mode.dispose = () => {
        stopPhoneLayout()
        stopWatchingDevices()
        devices?.destroy()
        document.removeEventListener(openDevicesEvent, onOpenDevices)
        destroyBlocklyInstance(blocklyInstance)
    }

    return mode
}
