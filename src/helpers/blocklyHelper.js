import { inject, serialization, setParentContainer, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { div } from 'ellipsi'
import { injectMods } from '../mods/mods.js'

let modsInjected = false

/**
 * Creates a Blockly workspace instance and returns the DOM canvas plus the
 * workspace handle used by the helper functions in this module.
 * @param {object} toolbox Blockly toolbox configuration.
 * @param {object} options Workspace display options.
 * @param {string} [options.id='block-canvas'] Canvas element ID.
 * @param {boolean} [options.readonly=false] Disables workspace editing.
 * @param {boolean} [options.hideToolbox=false] Omits the toolbox UI.
 * @param {boolean} [options.showGrid=true] Shows the Blockly grid.
 * @param {number} [options.startScale=0.8] Initial workspace zoom level.
 * @returns {object} Canvas, workspace slot, options, and cleanup handles.
 */
export const createBlocklyInstance = (
    toolbox,
    {
        id = 'block-canvas',
        readonly = false,
        hideToolbox = false,
        showGrid = true,
        startScale = 0.8,
    } = {},
) => {
    const canvas = div({ id })

    if (!modsInjected) {
        injectMods()
        modsInjected = true
    }

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
        toolbox: hideToolbox ? undefined : toolbox,
    }

    return {
        canvas,
        workspace: null,
        workspaceOptions,
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

    if (!blocklyInstance.workspace) {
        blocklyInstance.workspace = inject(
            blocklyInstance.canvas,
            blocklyInstance.workspaceOptions,
        )
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
        onReady,
        resizeImmediately,
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
const resizeBlocklyInstance = (blocklyInstance) => {
    svgResize(blocklyInstance.workspace)
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
