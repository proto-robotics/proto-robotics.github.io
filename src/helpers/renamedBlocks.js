/*
 * Old saved programs, brought up to date as they load (setBlocklyState in
 * blocklyHelper.js): every library's own migration first (its
 * `renames.migrate`), then the block types the libraries renamed. Kept
 * apart from blocklyHelper so tests can use it without a page.
 */

import { blockRenames, deviceRenames, migrations } from '../libraries/engine'
import { mapBlocks } from '../libraries/kit'

/**
 * A block type or device kind a host names (a task's required blocks), as
 * it is called now.
 * @param {string} type
 * @returns {string}
 */
export const currentBlockType = (type) => blockRenames[type] ?? deviceRenames[type] ?? type

/**
 * A saved program with every library's changes since it was saved.
 * @param {object} state A serialized workspace.
 * @returns {object}
 */
export const renameOldBlocks = (state) => {
    const migrated = migrations.reduce((current, migrate) => migrate(current), state)
    return mapBlocks(migrated, (blockState) =>
        blockRenames[blockState.type] ? { ...blockState, type: blockRenames[blockState.type] } : blockState,
    )
}
