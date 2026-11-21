/*
 * Old saved programs, brought up to date as they load (setBlocklyState in
 * blocklyHelper.js). Kept apart from blocklyHelper so tests can use it
 * without a page.
 */

/**
 * Block types that were renamed, old to new. For a while make's
 * drivetrain was a motor group (motor_group(motors, ratios)) with Spin
 * blocks; now it is a drivetrain again, and they are its Drive blocks.
 * Same fields, so only the type changes.
 */
const RENAMED_BLOCKS = {
    groupSpin: 'driveFor',
    groupSpinStep: 'driveStep',
    groupStop: 'drivetrainStop',
}

/** Of those, the ones that become a Turn block for a motor group that turned. */
const TURNED_BLOCKS = {
    groupSpin: 'turnFor',
    groupSpinStep: 'turnStep',
}

/**
 * A block type or device kind a host names (a task's required blocks), as
 * it is called now.
 * @param {string} type
 * @returns {string}
 */
export const currentBlockType = (type) =>
    ({ ...RENAMED_BLOCKS, motor_group: 'drivetrain' })[type] ?? type

/**
 * Whether a saved motor group turned on the spot: its ratios the same size,
 * every other one the other way, as [1, -1]. Make's drivetrain turns that
 * way. Its first ratio says which way: above 0 is right (the left wheels
 * forward).
 * @param {object} device A saved device.
 * @returns {'right'|'left'|null} The way it turned, or null if it did not.
 */
const turnOf = (device) => {
    const ratios = Array.isArray(device?.motors)
        ? device.motors.map((motor) => Number(motor?.ratio ?? 1))
        : []
    if (ratios.length < 2 || !ratios.every(Number.isFinite) || !ratios[0]) {
        return null
    }
    const alternates = ratios.every(
        (ratio, i) => ratio === (i % 2 ? -ratios[0] : ratios[0]),
    )
    if (!alternates) {
        return null
    }
    return ratios[0] > 0 ? 'right' : 'left'
}

/**
 * A saved workspace with renamed block types brought up to date, so it
 * loads instead of being set aside as an old program. A Spin block of a
 * motor group that turned on the spot (ratios [1, -1]) becomes a Turn
 * block; any other becomes a Drive block, its ratios lost.
 * @param {object} state A serialized workspace.
 * @returns {object} The same state, renamed where needed.
 */
export const renameOldBlocks = (state) => {
    const turns = new Map(
        (Array.isArray(state?.devices) ? state.devices : [])
            .filter((device) => device?.kind === 'motor_group')
            .map((device) => [device.name, turnOf(device)]),
    )
    const renamed = (blockState) => {
        const turn = turns.get(blockState.fields?.name)
        if (turn && TURNED_BLOCKS[blockState.type]) {
            const back = blockState.fields?.way === 'backward'
            const other = { right: 'left', left: 'right' }
            return {
                type: TURNED_BLOCKS[blockState.type],
                fields: {
                    ...blockState.fields,
                    way: back ? other[turn] : turn,
                },
            }
        }
        return { type: RENAMED_BLOCKS[blockState.type] ?? blockState.type }
    }
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
            ...renamed(blockState),
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
