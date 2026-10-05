/*
 * Puts blocks on the editor's clipboard from outside a workspace, so the
 * cheatsheet can offer "Copy" on every entry and Ctrl+V pastes it into the
 * editor. The clipboard is the one the workspace-multiselect plugin keeps in
 * localStorage for its cross-tab copy and paste (see global.js in the
 * plugin), so this also works from the full cheatsheet page in another tab.
 */

/** Keys the workspace-multiselect plugin reads its clipboard from. */
const STORAGE_KEYS = {
    blocks: 'blocklyStashMulti',
    connections: 'blocklyStashConnection',
    time: 'blocklyStashTime',
}

/**
 * Counts the blocks of each type in a serialized block and everything
 * attached to it, the way Blockly does for capacity checks.
 * @param {object} blockState One entry of Blockly's serialized `blocks.blocks`.
 * @param {Record<string, number>} [counts] Running totals.
 * @returns {Record<string, number>} Block type to count.
 */
const countBlockTypes = (blockState, counts = {}) => {
    counts[blockState.type] = (counts[blockState.type] ?? 0) + 1
    for (const input of Object.values(blockState.inputs ?? {})) {
        if (input.shadow) countBlockTypes(input.shadow, counts)
        if (input.block) countBlockTypes(input.block, counts)
    }
    if (blockState.next?.block) {
        countBlockTypes(blockState.next.block, counts)
    }
    return counts
}

/**
 * Copies every top block of a serialized workspace to the clipboard, each
 * stack as one item.
 * @param {object} workspaceState Blockly workspace serialization state.
 */
export const copyWorkspaceStateToClipboard = (workspaceState) => {
    const items = (workspaceState.blocks?.blocks ?? []).map((blockState) =>
        JSON.stringify({
            paster: 'block',
            blockState,
            typeCounts: countBlockTypes(blockState),
        }),
    )
    localStorage.setItem(STORAGE_KEYS.blocks, JSON.stringify(items))
    localStorage.setItem(STORAGE_KEYS.connections, '[]')
    localStorage.setItem(STORAGE_KEYS.time, String(Date.now()))
}
