/*
 * Blockly workspaces: creating them with our options and plugins, mounting
 * them in the page, and the small operations the editors need on them.
 * Our Blockly modifications themselves live in src/mods.
 */

import { inject, serialization, setParentContainer, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { ScrollOptions } from '@blockly/plugin-scroll-options'
import { Backpack } from '@blockly/workspace-backpack'
import { ZoomToFitControl } from '@blockly/zoom-to-fit'
import { Multiselect } from '@mit-app-inventor/blockly-plugin-workspace-multiselect'
import { div } from 'ellipsi'

import { multiselectOffIcon, multiselectOnIcon } from '../assets'
import { injectMods, SEARCH_CATEGORY_KIND } from '../mods/mods.js'
import { isPhoneLayout } from './phoneLayoutHelper'

let modsInjected = false

/**
 * The plugin classes for an editable workspace (registered in mods.js):
 * the continuous toolbox, whose flyout stays open and scrolls through every
 * category, and scroll options, which make the wheel scroll the canvas
 * (also mid-drag) and scroll it along when a block is dragged to an edge,
 * except over the trash and backpack (ProtoBlockDragger in mods.js).
 * The cheatsheet previews have no toolbox and get none of this.
 */
const editorPlugins = {
    flyoutsVerticalToolbox: 'ProtoColumnFlyout',
    metricsManager: 'ProtoMetrics',
    toolbox: 'ContinuousToolbox',
    blockDragger: 'ProtoBlockDragger',
}

/**
 * The phone layout's plugins (see phoneLayoutHelper.js): the same
 * continuous toolbox across the top of the canvas, with its always-open
 * flyout as a row under it (ContinuousRowFlyout in src/mods/flyouts.js).
 */
const phoneEditorPlugins = {
    ...editorPlugins,
    flyoutsHorizontalToolbox: 'ProtoRowFlyout',
}

/**
 * The @blockly/toolbox-search category, placed after the last category. Its
 * tab looks like the others, and its search field is the first item of its
 * section in the flyout, where it scrolls with the blocks (categories.js
 * and searchField.js in src/mods). Tapping the tab, or Ctrl+B, scrolls there
 * and puts the cursor in the field; the matching blocks list under it.
 */
const searchCategory = {
    kind: SEARCH_CATEGORY_KIND,
    name: 'Search',
    contents: [],
}

/**
 * Creates a Blockly workspace instance and returns the DOM canvas plus the
 * workspace handle used by the helper functions in this module.
 * @param {object} toolbox Blockly toolbox configuration.
 * @param {object} options Workspace display options.
 * @param {string} [options.id='block-canvas'] Canvas element ID.
 * @param {boolean} [options.readonly=false] Disables workspace editing.
 * @param {boolean} [options.hideToolbox=false] Omits the toolbox UI.
 * @param {boolean} [options.showGrid=true] Shows the Blockly grid.
 * @param {number} [options.startScale=0.65] Initial workspace zoom level. The
 *     flyout follows it, so this sets the block size in the toolbox too.
 * @param {number} [options.maxBlocks] Cap on blocks in the workspace.
 * @param {Record<string, number>} [options.maxInstances] Per-type caps.
 * @returns {object} Canvas, workspace slot, options, and cleanup handles.
 *     `editor` says whether this is the full editor (toolbox and plugins),
 *     `phone` whether it was built for the phone layout, `multiselect`
 *     holds the selection plugin once started.
 */
export const createBlocklyInstance = (
    toolbox,
    {
        id = 'block-canvas',
        readonly = false,
        hideToolbox = false,
        showGrid = true,
        startScale = 0.65,
        maxBlocks = undefined,
        maxInstances = undefined,
    } = {},
) => {
    const canvas = div({ id })

    if (!modsInjected) {
        injectMods()
        modsInjected = true
    }

    const editor = Boolean(toolbox) && !hideToolbox && !readonly
    // the phone layout is decided when the workspace is built; the block
    // mode rebuilds it when the layout changes (buildBlockMode.js)
    const phone = editor && isPhoneLayout()

    const workspaceOptions = {
        readOnly: readonly,
        renderer: 'proto_renderer',
        grid: showGrid
            ? {
                  spacing: 20,
                  length: 3,
                  colour: '#e4e4e4ff',
                  snap: true,
              }
            : undefined,
        zoom: {
            controls: !readonly,
            wheel: !readonly,
            startScale,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: !readonly,
        },
        trashcan: !readonly,
        toolbox: hideToolbox
            ? undefined
            : editor
              ? { ...toolbox, contents: [...toolbox.contents, searchCategory] }
              : toolbox,
        plugins: !editor
            ? undefined
            : phone
              ? phoneEditorPlugins
              : editorPlugins,
        horizontalLayout: phone,
        toolboxPosition: 'start',
        // the wheel scrolls (Ctrl+wheel zooms); scroll options need this
        move: readonly
            ? undefined
            : { scrollbars: true, drag: true, wheel: true },
        maxBlocks,
        maxInstances,
    }

    return {
        canvas,
        workspace: null,
        workspaceOptions,
        editor,
        phone,
        multiselect: null,
        resizeObservers: [],
        cleanupCallbacks: [],
    }
}

/**
 * Mounts a Blockly workspace into a container, registers that container with
 * Blockly, and keeps the workspace resized as the container changes.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @param {HTMLElement} container Element that owns the workspace.
 * @param {object} options Mount behavior options.
 * @param {() => (boolean|void)} [options.onReady] Called after the first resize.
 * @param {boolean} [options.resizeImmediately=false] Resizes before observation.
 * @param {boolean} [options.manageWidgets=true] Routes Blockly dropdowns and inputs here.
 * @returns {ResizeObserver} Observer that tracks the container size.
 */
export const mountBlocklyWorkspace = (
    blocklyInstance,
    container,
    { onReady = null, resizeImmediately = false, manageWidgets = true } = {},
) => {
    if (manageWidgets) {
        setBlocklyParentContainer(container)
    }

    // The editor is built before it is attached to the page, so Blockly
    // measures the flyout's text while detached and gets the widths wrong.
    // The continuous toolbox fills its flyout at inject time (the default
    // toolbox waited for a click, after attachment), so it is rebuilt once
    // the container has a size. Recycling is off so the blocks are really
    // re-created rather than repositioned.
    const injectedDetached = !container.isConnected
    let userOnReady = onReady
    if (!blocklyInstance.workspace) {
        blocklyInstance.workspace = inject(
            blocklyInstance.canvas,
            blocklyInstance.workspaceOptions,
        )
        if (injectedDetached && blocklyInstance.workspaceOptions.toolbox) {
            const workspace = blocklyInstance.workspace
            workspace.getFlyout()?.setRecyclingEnabled?.(false)
            userOnReady = () => {
                workspace.getToolbox()?.refreshSelection()
                return onReady?.()
            }
        }
        if (blocklyInstance.editor) {
            new ScrollOptions(blocklyInstance.workspace).init()
            // a button above the zoom controls that fits every block on screen
            new ZoomToFitControl(blocklyInstance.workspace).init()
            // A backpack to carry blocks between projects: "Copy to
            // Backpack" in a block's menu, click the backpack to take them
            // out. Its contents are saved with the workspace. Started
            // before the multiselect plugin so that one can extend its menu
            // entry to a whole selection.
            new Backpack(blocklyInstance.workspace, {
                useFilledBackpackImage: true,
            }).init()
        }
    }

    if (manageWidgets) {
        const activateWidgets = () => setBlocklyParentContainer(container)
        blocklyInstance.canvas.addEventListener(
            'pointerdown',
            activateWidgets,
            true,
        )
        blocklyInstance.canvas.addEventListener(
            'mousedown',
            activateWidgets,
            true,
        )
        blocklyInstance.canvas.addEventListener(
            'focusin',
            activateWidgets,
            true,
        )
        blocklyInstance.cleanupCallbacks.push(() => {
            blocklyInstance.canvas.removeEventListener(
                'pointerdown',
                activateWidgets,
                true,
            )
            blocklyInstance.canvas.removeEventListener(
                'mousedown',
                activateWidgets,
                true,
            )
            blocklyInstance.canvas.removeEventListener(
                'focusin',
                activateWidgets,
                true,
            )
        })
    }

    return watchContainerSize(blocklyInstance, container, {
        onReady: userOnReady,
        resizeImmediately,
    })
}

/**
 * Starts multi-block selection (workspace-multiselect): Shift-drag a box or
 * Shift-click to select several blocks and move, copy, or delete them
 * together; the button above the trash toggles the mode. Built from the
 * plugin's Blockly 12 branch, see vendor/. It looks Blockly's widgets up in
 * the document, so it can only start once the editor is attached; it is
 * disposed with the workspace.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance,
 *     mounted and attached to the page.
 */
export const startMultiselect = (blocklyInstance) => {
    if (blocklyInstance.multiselect) {
        return
    }
    const multiselect = new Multiselect(blocklyInstance.workspace)
    multiselect.init({
        useDoubleClick: false,
        bumpNeighbours: false,
        // jenga blocks have fields that depend on each other, so a field
        // edit is not copied to the other selected blocks
        multiFieldUpdate: false,
        workspaceAutoFocus: true,
        multiselectIcon: {
            hideIcon: false,
            weight: 3,
            enabledIcon: multiselectOnIcon,
            disabledIcon: multiselectOffIcon,
        },
        multiSelectKeys: ['Shift'],
        multiselectCopyPaste: { crossTab: true, menu: true },
    })
    blocklyInstance.multiselect = multiselect
    blocklyInstance.cleanupCallbacks.push(() => {
        multiselect.dispose()
        blocklyInstance.multiselect = null
    })
}

/**
 * Adds a workspace change listener to the provided Blockly instance.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @param {(event: object) => void} callback Receives Blockly change events.
 */
export const addBlocklyChangeListener = (blocklyInstance, callback) => {
    blocklyInstance.workspace.addChangeListener(callback)
}

/**
 * Serializes the current Blockly workspace state into Blockly's JSON format.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @returns {object} Blockly serialization state.
 */
export const getBlocklyState = (blocklyInstance) => {
    return serialization.workspaces.save(blocklyInstance.workspace)
}

/**
 * Loads a previously serialized Blockly JSON state into the workspace.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @param {object} state Blockly serialization state to load.
 */
export const setBlocklyState = (blocklyInstance, state) => {
    serialization.workspaces.load(state, blocklyInstance.workspace)
}

/**
 * Generates Python code for the current Blockly workspace.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @returns {string} Generated Python source.
 */
export const getBlocklyCode = (blocklyInstance) => {
    return pythonGenerator.workspaceToCode(blocklyInstance.workspace)
}

/**
 * Disconnects any resize observers created for the instance and disposes the
 * underlying Blockly workspace.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 */
export const destroyBlocklyInstance = (blocklyInstance) => {
    for (const resizeObserver of blocklyInstance.resizeObservers ?? []) {
        resizeObserver.disconnect()
    }

    blocklyInstance.resizeObservers = []
    for (const cleanup of blocklyInstance.cleanupCallbacks ?? []) {
        cleanup()
    }
    blocklyInstance.cleanupCallbacks = []
    blocklyInstance.workspace?.dispose()
    blocklyInstance.workspace = null
}

/**
 * Sets the shared Blockly widget parent so dropdowns and text inputs appear in
 * the active editor rather than a readonly preview.
 * @param {HTMLElement} container Active workspace container.
 */
const setBlocklyParentContainer = (container) => {
    if (container) {
        // Fixes Blockly blocks stealing focus from text inputs and context menus.
        setParentContainer(container)
    }
}

/**
 * Forces Blockly to recalculate the workspace SVG size for its current
 * container dimensions.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 */
export const resizeBlocklyInstance = (blocklyInstance) => {
    if (blocklyInstance.workspace) {
        svgResize(blocklyInstance.workspace)
    }
}

/**
 * Observes a mounted Blockly container and keeps the workspace sized to match
 * it. The optional `onReady` callback runs once after the first successful
 * resize, unless it explicitly returns `false`.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @param {HTMLElement} element Observed workspace container.
 * @param {object} options Observation options.
 * @param {() => (boolean|void)} [options.onReady] Initial layout callback.
 * @param {boolean} [options.resizeImmediately=false] Resizes before observation.
 * @returns {ResizeObserver} Observer attached to the container.
 */
const watchContainerSize = (
    blocklyInstance,
    element,
    { onReady = null, resizeImmediately = false } = {},
) => {
    let isReady = false

    const resizeObserver = new ResizeObserver(() => {
        resizeBlocklyInstance(blocklyInstance)

        if (!isReady) {
            const callbackResult = onReady?.()
            if (callbackResult !== false) {
                isReady = true
            }
        }
    })

    resizeObserver.observe(element)
    blocklyInstance.resizeObservers?.push(resizeObserver)

    if (resizeImmediately) {
        resizeBlocklyInstance(blocklyInstance)
    }

    return resizeObserver
}
