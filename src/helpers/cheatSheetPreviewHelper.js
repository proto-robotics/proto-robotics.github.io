/*
 * Renders and sizes one read-only Blockly and/or Python preview. It does not
 * decide which cheatsheet sections or entries exist.
 */

import { tag } from 'ellipsi'

import {
    createBlocklyInstance,
    getBlocklyCode,
    mountBlocklyWorkspace,
    setBlocklyState,
} from './blocklyHelper'
import { createCodeMirrorView, setCodeMirrorText } from './codeMirrorHelper'

let previewId = 0
const previewScale = 0.75
const minPreviewScale = 0.3
const previewRefitCallbacks = new WeakMap()

/** Display combinations supported by cheat sheet previews. */
export const CheatSheetPreviewMode = Object.freeze({
    BLOCKS: 'blocks',
    CODE: 'code',
    BLOCKS_AND_CODE: 'blocks-and-code',
})

/**
 * Creates a readonly CodeMirror view for displaying generated Python code in
 * cheat sheet entries.
 * @param {string} pythonCode Generated Python source to display.
 * @returns {EditorView} Readonly CodeMirror view sized by its caller.
 */
function createCodeFormatter(pythonCode) {
    const codeFormatter = createCodeMirrorView({
        readonly: true,
        noGutter: true,
    })
    codeFormatter.scrollDOM.style.height = 'auto'
    codeFormatter.scrollDOM.style.overflow = 'visible'
    codeFormatter.dom.style.height = 'auto'
    setCodeMirrorText(codeFormatter, pythonCode.trimEnd())

    return codeFormatter
}

/**
 * Normalizes saved Blockly JSON for small preview workspaces.
 * Each top-level block receives a predictable position so examples do not
 * overlap when their saved coordinates are absent.
 * @param {object} workspaceState Serialized Blockly workspace state.
 * @returns {object} Preview-safe workspace state.
 */
function normalizeWorkspaceState(workspaceState) {
    return {
        ...workspaceState,
        blocks: {
            ...workspaceState.blocks,
            blocks: workspaceState.blocks.blocks.map((blockState, index) => ({
                ...blockState,
                x: 12,
                y: blockState.y ?? 12 + index * 48,
            })),
        },
    }
}

/**
 * Forces every block in a preview workspace to render before measuring it.
 * @param {object} blocklyInstance Readonly Blockly preview instance.
 */
function renderPreviewBlocks(blocklyInstance) {
    for (const block of blocklyInstance.workspace.getAllBlocks(false)) {
        block.render()
    }
}

/**
 * Sizes the preview element to tightly fit the visible Blockly blocks.
 * The scale is reduced only when the available column is narrower than the
 * preview's natural width, then blocks are repositioned into padded bounds.
 * @param {object} blocklyInstance Readonly Blockly preview instance.
 * @param {HTMLElement} preview Preview container element.
 */
function fitPreviewToBlocks(blocklyInstance, preview) {
    renderPreviewBlocks(blocklyInstance)

    const blockBounds = blocklyInstance.workspace.getBlocksBoundingBox()
    const width = Math.max(1, blockBounds.right - blockBounds.left)
    const height = Math.max(1, blockBounds.bottom - blockBounds.top)
    const maxPreviewWidth = getMaxPreviewWidth(preview)
    const naturalWidth = Math.ceil((width + 24 / previewScale) * previewScale)
    const targetScale = Math.max(
        minPreviewScale,
        Math.min(previewScale, previewScale * (maxPreviewWidth / naturalWidth)),
    )

    if (Math.abs(blocklyInstance.workspace.scale - targetScale) > 0.001) {
        blocklyInstance.workspace.setScale(targetScale)
        renderPreviewBlocks(blocklyInstance)
    }

    const scale = blocklyInstance.workspace.scale
    const padding = 12 / scale
    const previewWidth = Math.ceil((width + padding * 2) * scale)
    const previewHeight = Math.ceil((height + padding * 2) * scale)

    for (const block of blocklyInstance.workspace.getTopBlocks(false)) {
        block.moveBy(padding - blockBounds.left, padding - blockBounds.top)
    }

    preview.style.width = `${previewWidth}px`
    preview.style.height = `${previewHeight}px`
    blocklyInstance.canvas.style.width = `${previewWidth}px`
    blocklyInstance.canvas.style.height = `${previewHeight}px`
}

/**
 * Returns the usable preview width, preferring the parent column's width.
 * @param {HTMLElement} preview Preview container element.
 * @returns {number} Positive available width in pixels.
 */
function getMaxPreviewWidth(preview) {
    return Math.max(
        1,
        preview.parentElement?.clientWidth ?? preview.clientWidth,
    )
}

/**
 * Creates a readonly Blockly preview from serialized Blockly workspace JSON
 * and returns both the preview element and its generated Python code.
 * @param {object} workspaceState Serialized Blockly workspace state.
 * @returns {{element: HTMLElement, code: string}} Preview element and code.
 */
function createBlocklyPreview(workspaceState) {
    const normalizedWorkspaceState = normalizeWorkspaceState(workspaceState)
    const blocklyInstance = createBlocklyInstance(undefined, {
        id: `cheatsheet-blockly-preview-${previewId++}`,
        readonly: true,
        hideToolbox: true,
        showGrid: false,
        startScale: previewScale,
    })
    const preview = tag('blockly-preview', blocklyInstance.canvas)
    previewRefitCallbacks.set(preview, () => {
        if (preview.isConnected) {
            fitPreviewToBlocks(blocklyInstance, preview)
        }
    })
    preview.style.width = '280px'
    preview.style.height = '96px'

    mountBlocklyWorkspace(blocklyInstance, preview, {
        resizeImmediately: true,
        manageWidgets: false,
        onReady: () => {
            if (!preview.isConnected) {
                return false
            }

            document.fonts?.ready.then(() => {
                if (!preview.isConnected) {
                    return
                }

                setBlocklyState(blocklyInstance, normalizedWorkspaceState)
                requestAnimationFrame(() => {
                    fitPreviewToBlocks(blocklyInstance, preview)
                })
            })
        },
    })

    setBlocklyState(blocklyInstance, normalizedWorkspaceState)
    const code = getBlocklyCode(blocklyInstance)

    return {
        element: preview,
        code,
    }
}

/**
 * Refits all Blockly previews inside a container after the container's column
 * width changes, such as when the browser enters print layout.
 * @param {HTMLElement} container Element containing preview elements.
 */
export function fitCheatSheetBlockPreviews(container) {
    for (const preview of container.querySelectorAll('blockly-preview')) {
        previewRefitCallbacks.get(preview)?.()
    }
}

/**
 * Creates the rendered cheat sheet preview for the requested display mode.
 * @param {object} workspaceState Serialized Blockly workspace state.
 * @param {object} options Preview display options.
 * @param {string} [options.mode='blocks-and-code'] Requested display mode.
 * @returns {HTMLElement} Combined Blockly and/or code preview element.
 */
export function createCheatSheetPreview(
    workspaceState,
    { mode = CheatSheetPreviewMode.BLOCKS_AND_CODE } = {},
) {
    const preview = createBlocklyPreview(workspaceState)
    const previewContent = tag('cheatsheet-preview')

    if (
        mode === CheatSheetPreviewMode.BLOCKS ||
        mode === CheatSheetPreviewMode.BLOCKS_AND_CODE
    ) {
        previewContent.appendChild(preview.element)
    }

    if (
        mode === CheatSheetPreviewMode.CODE ||
        mode === CheatSheetPreviewMode.BLOCKS_AND_CODE
    ) {
        previewContent.appendChild(createCodeFormatter(preview.code).dom)
    }

    return previewContent
}
