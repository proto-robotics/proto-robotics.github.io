/*
 * Building programs for the tests: the real blocks from the library on a
 * headless workspace, loaded from a saved state (devices, then blocks) the
 * way a project file has them.
 */
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { numbersToSlots, setBlockSet, splice } from '../src/libraries/engine'
import { core } from '../src/libraries/core/index'
import { make } from '../src/libraries/make/index'

let defined = false
/** Splices the IDE's own libraries (core and make), which defines their blocks, once. */
export const defineBlocks = () => {
    if (!defined) {
        setBlockSet(splice([core, make]))
        defined = true
    }
}

export const motor = (name = 'arm', port = '0', direction = '1') => ({
    kind: 'drive_motor',
    name,
    port,
    direction,
})
/** A drivetrain of these motors, in order (left and right by default). */
export const drivetrain = (name = 'robot', ...motors) => ({
    kind: 'drivetrain',
    name,
    motors: motors.length ? motors : ['left', 'right'],
})
/** Two drive motors and a drivetrain made from them. */
export const robot = () => [
    motor('left', '1'),
    motor('right', '2', '-1'),
    drivetrain(),
]

/** A block with its fields, what is in its slots, and the block under it. */
export const block = (type, fields = {}, inputs) => ({
    type,
    fields,
    ...(inputs ? { inputs } : {}),
})

/** Puts blocks one under another. */
export const stack = (...blocks) =>
    blocks.reduceRight((below, top) =>
        below ? { ...top, next: { block: below } } : top,
    )

/** A block in a slot. */
export const slot = (child) => ({ block: child })
/** A number in a slot, as the toolbox's shadow. */
export const num = (n) => ({
    shadow: { type: 'numberInput', fields: { operation: n } },
})

/**
 * A workspace with these top blocks and devices.
 * @returns {object} The workspace; dispose it when done.
 */
export const workspaceOf = (blocks, devices = []) => {
    defineBlocks()
    const workspace = new Blockly.Workspace(new Blockly.Options({}))
    Blockly.serialization.workspaces.load(
        {
            devices,
            // numbers are written as fields; the blocks take them in slots
            blocks: { languageVersion: 0, blocks: blocks.map(numbersToSlots) },
        },
        workspace,
    )
    return workspace
}

/** The Python the blocks write (without the devices' lines). */
export const python = (blocks, devices = []) => {
    const workspace = workspaceOf(blocks, devices)
    const code = pythonGenerator.workspaceToCode(workspace)
    workspace.dispose()
    return code.trim()
}
