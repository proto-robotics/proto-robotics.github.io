import {
    inject,
    serialization,
    setParentContainer,
    svgResize,
} from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { div } from 'ellipsi'

import { injectMods } from '../mods/mods.js'

let modsInjected = false
const workspaces = new WeakMap()

const getWorkspace = (view) => {
    const workspace = workspaces.get(view)
    if (!workspace) {
        throw new Error('Blockly workspace not found for view')
    }
    return workspace
}

export const newView = (toolbox, { id = 'block-canvas' } = {}) => {
    const view = div({ id })

    if (!modsInjected) {
        injectMods()
        modsInjected = true
    }

    const workspace = inject(view, {
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
        trashcan: true,
        toolbox: toolbox,
    })

    workspaces.set(view, workspace)
    return view
}

export const setViewParentContainer = (view, ParentContainer) => {
    if (ParentContainer) {
        // Fixes Blockly blocks stealing focus from text inputs and context menus.
        setParentContainer(ParentContainer)
    }
}

export const draw = (view) => {
    svgResize(getWorkspace(view))
}

export const addChangeListener = (view, callback) => {
    getWorkspace(view).addChangeListener(callback)
}

export const isDragging = (view) => {
    return getWorkspace(view).isDragging()
}

export const getState = (view) => {
    return serialization.workspaces.save(getWorkspace(view))
}

export const setState = (view, state) => {
    serialization.workspaces.load(state, getWorkspace(view))
}

export const getCode = (view) => {
    return pythonGenerator.workspaceToCode(getWorkspace(view))
}
