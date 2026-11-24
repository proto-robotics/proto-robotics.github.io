/*
 * The kit a block library is written with: the parts a block is made of
 * (text, fields, number slots), what blocks commonly write (make calls on a
 * device, the Python inside a loop), and the block() and example() entries.
 * The IDE's own library (make/) uses it, and so can a host's:
 * the library build exports it as `kit`.
 *
 * Every number on a block is a slot holding a hidden number block, one type
 * per default value (num_50, num_0_2...); the kit keeps the list, and the
 * engine (engine.js) makes those blocks for the libraries it splices.
 */
import { FieldNumber, FieldTextInput } from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'
import { FieldGridDropdown } from '@blockly/field-grid-dropdown'
import { deviceField } from '../mods/deviceField'

export { Order, pythonGenerator }

/**
 * A dropdown whose choices open as a grid of buttons rather than a list
 * (@blockly/field-grid-dropdown), easier to hit on a touch screen. Short
 * lists sit in one row; longer ones wrap at four.
 * @param {Array<[string, string]>} options The choices, as [label, value].
 * @returns {FieldGridDropdown} The field.
 */
export const gridDropdown = (options) =>
    new FieldGridDropdown(options, undefined, {
        columns: Math.min(options.length, 4),
    })

// ---- the parts blocks are made of ------------------------------------------

export const text = (words) => ({ text: words })
export const field = (name, make) => ({ name, field: make })
export const slot = (name, type, shadow) => ({
    blocklyInput: { name, type, ...(shadow ? { shadow } : {}) },
})

/** forward or backward, for Spin, Drive and Curve. */
export const ways = () =>
    gridDropdown([
        ['forward', 'forward'],
        ['backward', 'backward'],
    ])
/**
 * forward or backward for one wheel of a Curve, starting on `start`.
 * @param {'forward'|'backward'} start
 */
export const wheelWays = (start) => () => {
    const dropdown = ways()
    dropdown.setValue(start)
    return dropdown
}
/** right or left, for Turn: make's turn has the left wheels go forward. */
export const turns = () =>
    gridDropdown([
        ['right', 'right'],
        ['left', 'left'],
    ])
/** How a timed block measures how long it runs. */
export const units = () =>
    gridDropdown([
        ['seconds', 'seconds'],
        ['degrees', 'degrees'],
    ])
/** How a Stop block stops. */
export const stops = () =>
    gridDropdown([
        ['brake', 'brake'],
        ['coast', 'coast'],
    ])

/**
 * Every number on a block is a slot holding a number (a shadow block), so a
 * variable or a sum can be dropped over it. Each default value has its own
 * hidden number block type (num_50, num_0_2...), since a slot's shadow is
 * named by type alone; they all write their number, and take the colour of
 * the block they sit in (mods/stepBlocks.js).
 */
/** Every hidden number block type the kit has made, to its default value. */
export const numberShadows = new Map()
const numberShadow = (value) => {
    const type = `num_${String(value).replace('-', 'm').replace('.', '_')}`
    numberShadows.set(type, value)
    return type
}
/** A number slot with its default. */
export const num = (name, value) => slot(name, 'Number', numberShadow(value))
/** The Python of a number slot: what is in it, or 0 if it is empty. */
export const val = (block, name) =>
    pythonGenerator.valueToCode(block, name, Order.NONE) || '0'

// the board's buttons and lights; the value is the port in lower case
export const buttons = [
    ['A', 'a'],
    ['B', 'b'],
    ['C', 'c'],
    ['D', 'd'],
]
export const lights = [
    ['L1', 'l1'],
    ['L2', 'l2'],
]

// ---- what blocks write -------------------------------------------------------

/**
 * Converts learner-entered names into valid Python identifiers.
 * @param {string} str Name entered in a Blockly text field.
 * @returns {string} Name with whitespace replaced by underscores.
 */
export const spacesToUnderscores = (str) => String(str ?? '').replace(/\s+/g, '_')

/** @returns {string} The device a block uses, as Python names it. */
export const deviceOf = (block) => spacesToUnderscores(block.getFieldValue('name'))

/** Backward, or left for a Turn: make's _back version of the call. */
export const isBack = (block) =>
    ['backward', 'left'].includes(block.getFieldValue('way'))

/**
 * A make call for a timed motion block: the seconds version, or the
 * degrees version when the block is set to degrees.
 * @param {object} block
 * @param {string} verb spin, drive or turn.
 * @returns {string} One line of Python.
 */
export const timedCall = (block, verb) => {
    const method = isBack(block) ? `${verb}_back` : verb
    const p = val(block, 'power')
    const n = val(block, 'amount')
    return block.getFieldValue('unit') === 'degrees'
        ? `${deviceOf(block)}.${method}_degrees(degrees=${n}, power=${p})\n`
        : `${deviceOf(block)}.${method}(power=${p}, seconds=${n})\n`
}

/** A step: make's call with no time, so its 0.05 second default. */
export const stepCall = (block, verb) => {
    const method = isBack(block) ? `${verb}_back` : verb
    return `${deviceOf(block)}.${method}(power=${val(block, 'power')})\n`
}

/** Curve's two powers, left then right, as make's curve takes them. */
export const curvePowers = (block) =>
    `left_power=${val(block, 'left')}, right_power=${val(block, 'right')}`

/**
 * One wheel's power for make's curve: the slot's number, made negative when
 * that wheel's dropdown says backward, so a learner never types a minus.
 * @param {object} block
 * @param {string} wayField The wheel's forward/backward field.
 * @param {string} slotName The wheel's power slot.
 * @returns {string} Python: 50, -50 or -(x).
 */
export const signedPower = (block, wayField, slotName) => {
    const power = val(block, slotName)
    if (block.getFieldValue(wayField) !== 'backward' || power === '0') return power
    return /^\d+(\.\d+)?$/.test(power) ? `-${power}` : `-(${power})`
}

/** Curve, with a direction for each wheel: one make curve call. */
export const curveForCall = (block) =>
    `${deviceOf(block)}.curve(left_power=${signedPower(block, 'leftWay', 'left')}, right_power=${signedPower(block, 'rightWay', 'right')}, seconds=${val(block, 'time')})\n`

export const stopCall = (block) =>
    `${deviceOf(block)}.${block.getFieldValue('mode') === 'coast' ? 'stop' : 'brake'}()\n`

/** The Python inside a loop or If; pass when it is empty. */
export const inside = (block, generator, name = 'input') =>
    generator.statementToCode(block, name) || `${generator.INDENT}pass\n`

export const condition = (block, generator, name = 'function') =>
    generator.valueToCode(block, name, Order.NONE) || 'False'

export const number = (block, generator, name, order = Order.NONE) =>
    generator.valueToCode(block, name, order) || '0'

/**
 * A board button or light. make has the board's own ready under their
 * port's name, so a block uses that name: A, L1.
 * @param {object} block A block with a `button` or `light` field.
 * @param {'button'|'light'} kind
 * @returns {string}
 */
export const boardPart = (block, kind) => block.getFieldValue(kind).toUpperCase()

// ---- the blocks --------------------------------------------------------------

/**
 * A block entry.
 * @param {string} name The block's type.
 * @param {string} description What it does, for the cheatsheet and tooltip.
 * @param {object[]} blocklyTemplate Its parts, in order.
 * @param {Function} codeGenerator What it writes.
 * @param {object} [more] blocklyOutput, inputsInline, step, toolbox.
 * @returns {object}
 */
export const block = (
    name,
    description,
    blocklyTemplate,
    codeGenerator,
    more = {},
) => ({
    entryType: 'block',
    name,
    description,
    blocklyTemplate,
    codeGenerator,
    inputsInline: true,
    ...more,
})

/** A cheatsheet example: a saved workspace with its devices. */
export const example = (name, preamble, devices, blocks) => ({
    entryType: 'example',
    name,
    preamble,
    workspace: {
        devices,
        blocks: { languageVersion: 0, blocks },
    },
})

export const boolOut = { blocklyOutput: { type: 'Boolean', name: 'value' } }
export const numberOut = { blocklyOutput: { type: 'Number', name: 'value' } }

// example devices
export const ARM = { kind: 'drive_motor', name: 'arm', port: '0', direction: '1' }
export const LEFT = { kind: 'drive_motor', name: 'left', port: '1', direction: '1' }
export const RIGHT = { kind: 'drive_motor', name: 'right', port: '2', direction: '-1' }
// a drivetrain of the two wheels, left then right (make's drivetrain(left, right))
export const ROBOT = { kind: 'drivetrain', name: 'robot', motors: ['left', 'right'] }

/** Field factories for a block's `blocklyTemplate`, for a library that does not want Blockly's own. */
export const fields = {
    /**
     * @param {number} value Starting value.
     * @param {number} [min] Smallest allowed.
     * @param {number} [max] Largest allowed.
     * @param {number} [precision] Step, 1 for whole numbers.
     */
    number: (value, min, max, precision) => () =>
        new FieldNumber(value, min, max, precision),
    /** @param {string} value Starting text. */
    text: (value) => () => new FieldTextInput(value),
    /** @param {Array<[string, string]>} options Choices as [label, value]. */
    dropdown: (options) => () => gridDropdown(options),
    /**
     * A choice of the program's devices of a kind, by name.
     * @param {string} kind A device kind of the editor's libraries.
     * @param {{nth?: number}} [options] Blank while there are none.
     */
    device: deviceField,
}

// ---- for a library's migrations (`renames.migrate`) ---------------------------

/** Every block in a saved program, inside and under the others, changed by `change`. */
export const mapBlocks = (state, change) => {
    const visit = (blockState) => {
        if (!blockState || typeof blockState !== 'object') {
            return blockState
        }
        const inputs = Object.fromEntries(
            Object.entries(blockState.inputs ?? {}).map(([name, input]) => [
                name,
                {
                    ...input,
                    ...(input?.block ? { block: visit(input.block) } : {}),
                    ...(input?.shadow ? { shadow: visit(input.shadow) } : {}),
                },
            ]),
        )
        return change({
            ...blockState,
            ...(blockState.inputs ? { inputs } : {}),
            ...(blockState.next?.block ? { next: { ...blockState.next, block: visit(blockState.next.block) } } : {}),
        })
    }
    if (!state?.blocks?.blocks) {
        return state
    }
    return { ...state, blocks: { ...state.blocks, blocks: state.blocks.blocks.map(visit) } }
}
