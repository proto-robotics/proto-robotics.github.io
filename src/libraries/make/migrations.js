/*
 * How the make library brings older programs up to date as they load (its
 * `renames.migrate`, run by the engine before the simple renames).
 *
 * For a while make's drivetrain was a motor group (motor_group(motors,
 * ratios)) with Spin blocks; now it is a drivetrain again, and they are its
 * Drive blocks. A motor group whose ratios turned the robot (1, -1, 1...)
 * was used to turn, so its Spin blocks become Turn blocks, right for a
 * positive first ratio, left for a negative one.
 */

import { mapBlocks } from '../kit'

/** The blocks that become a Turn block for a motor group that turned. */
const TURNED_BLOCKS = {
    groupSpin: 'turnFor',
    groupSpinStep: 'turnStep',
}

/** Which way a motor group turned, or null if its ratios did not turn it. */
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
 * The Spin blocks of a motor group that turned, as Turn blocks.
 * @param {object} state A saved program.
 * @returns {object}
 */
export const turnMotorGroups = (state) => {
    const turns = new Map(
        (Array.isArray(state?.devices) ? state.devices : [])
            .filter((device) => device?.kind === 'motor_group')
            .map((device) => [device.name, turnOf(device)]),
    )
    if (![...turns.values()].some(Boolean)) {
        return state
    }
    return mapBlocks(state, (blockState) => {
        const turn = turns.get(blockState.fields?.name)
        if (!turn || !TURNED_BLOCKS[blockState.type]) {
            return blockState
        }
        const back = blockState.fields?.way === 'backward'
        const other = { right: 'left', left: 'right' }
        return {
            ...blockState,
            type: TURNED_BLOCKS[blockState.type],
            fields: { ...blockState.fields, way: back ? other[turn] : turn },
        }
    })
}
