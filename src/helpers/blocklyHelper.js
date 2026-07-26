import { inject, serialization, setParentContainer, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { div } from 'ellipsi'
import { injectMods } from '../mods/mods.js'

let modsInjected = false

/**
 * Creates a Blockly workspace instance and returns the DOM canvas plus the
 * workspace handle used by the helper functions in this module.
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
            controls: false,
            wheel: false,
            startScale,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: false,
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
 */
export const addBlocklyChangeListener = (blocklyInstance, callback) => {
    blocklyInstance.workspace.addChangeListener(callback)
}

/**
 * Serializes the current Blockly workspace state into Blockly's JSON format.
 */
export const getBlocklyState = (blocklyInstance) => {
    return serialization.workspaces.save(blocklyInstance.workspace)
}

/**
 * Loads a previously serialized Blockly JSON state into the workspace.
 */
export const setBlocklyState = (blocklyInstance, state) => {
    serialization.workspaces.load(state, blocklyInstance.workspace)
}

/**
 * Generates Python code for the current Blockly workspace.
 */
export const getBlocklyCode = (blocklyInstance) => {
    return pythonGenerator.workspaceToCode(blocklyInstance.workspace)
}

/**
 * Disconnects any resize observers created for the instance and disposes the
 * underlying Blockly workspace.
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
 * Creates a Blockly workspace instance and returns the DOM canvas plus the
 * workspace handle used by the helper functions in this module.
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
 */
const resizeBlocklyInstance = (blocklyInstance) => {
    svgResize(blocklyInstance.workspace)
}

/**
 * Observes a mounted Blockly container and keeps the workspace sized to match
 * it. The optional `onReady` callback runs once after the first successful
 * resize, unless it explicitly returns `false`.
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
