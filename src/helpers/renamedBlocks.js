/*
 * Old saved programs, brought up to date as they load (setBlocklyState in
 * blocklyHelper.js). Kept apart from blocklyHelper so tests can use it
 * without a page.
 */

/**
 * Block types that were renamed, old to new: make's drivetrain became
 * motor_group, and its blocks with it. Same fields, so only the type changes.
 */
const RENAMED_BLOCKS = {
    driveFor: 'groupSpin',
    driveStep: 'groupSpinStep',
    drivetrainStop: 'groupStop',
}

/**
 * A saved workspace with renamed block types brought up to date, so it
 * loads instead of being set aside as an old program.
 * @param {object} state A serialized workspace.
 * @returns {object} The same state, renamed where needed.
 */
export const renameOldBlocks = (state) => {
    const rename = (blockState) => {
        if (!blockState || typeof blockState !== 'object') {
            return blockState
        }
        const inputs = Object.fromEntries(
            Object.entries(blockState.inputs ?? {}).map(([name, input]) => [
                name,
                {
                    ...input,
                    ...(input?.block ? { block: rename(input.block) } : {}),
                    ...(input?.shadow ? { shadow: rename(input.shadow) } : {}),
                },
            ]),
        )
        return {
            ...blockState,
            type: RENAMED_BLOCKS[blockState.type] ?? blockState.type,
            ...(blockState.inputs ? { inputs } : {}),
            ...(blockState.next?.block
                ? {
                      next: {
                          ...blockState.next,
                          block: rename(blockState.next.block),
                      },
                  }
                : {}),
        }
    }
    if (!state?.blocks?.blocks) {
        return state
    }
    return {
        ...state,
        blocks: { ...state.blocks, blocks: state.blocks.blocks.map(rename) },
    }
}
