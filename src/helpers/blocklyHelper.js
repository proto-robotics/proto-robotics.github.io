import { inject, serialization, setParentContainer, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { div } from 'ellipsi'
import { injectMods } from '../mods/mods.js'

let modsInjected = false

/**
 * Creates a Blockly workspace instance and returns the DOM canvas plus the
 * workspace handle used by the helper functions in this module.
 */
export const newBlocklyInstance = (
    toolbox,
    { id = 'block-canvas', readonly = false, hideToolbox = false } = {},
) => {
    const canvas = div({ id })

    if (!modsInjected) {
        injectMods()
        modsInjected = true
    }

    const workspace = inject(canvas, {
        readOnly: readonly,
        renderer: 'proto_renderer',
        grid: {
            spacing: 20,
            length: 3,
            colour: '#e4e4e4ff',
            snap: true,
        },
        zoom: {
            controls: false,
            wheel: false,
            startScale: 0.8,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: false,
        },
        trashcan: !readonly,
        toolbox: hideToolbox ? undefined : toolbox,
    })

    return {
        canvas,
        workspace,
        resizeObservers: [],
    }
}

/**
 * Mounts a Blockly workspace into a container, registers that container with
 * Blockly, and keeps the workspace resized as the container changes.
 */
export const mountBlocklyInstance = (
    blocklyInstance,
    container,
    { onReady = null, resizeImmediately = false } = {},
) => {
    setBlocklyParentContainer(container)
    return watchContainerSize(blocklyInstance, container, {
        onReady,
        resizeImmediately,
    })
}

/**
 * Adds a workspace change listener to the provided Blockly instance.
 */
export const addChangeListener = (blocklyInstance, callback) => {
    blocklyInstance.workspace.addChangeListener(callback)
}

/**
 * Serializes the current Blockly workspace state into Blockly's JSON format.
 */
export const getState = (blocklyInstance) => {
    return serialization.workspaces.save(blocklyInstance.workspace)
}

/**
 * Loads a previously serialized Blockly JSON state into the workspace.
 */
export const setState = (blocklyInstance, state) => {
    serialization.workspaces.load(state, blocklyInstance.workspace)
}

/**
 * Generates Python code for the current Blockly workspace.
 */
export const getCode = (blocklyInstance) => {
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
    blocklyInstance.workspace.dispose()
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
