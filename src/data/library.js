/*
 * The blocks, built around the make library (from make import *). Every
 * block writes one make call, and every motion block says how long it
 * runs: some seconds, some degrees, or one short step. A step block (a
 * dashed edge, `step: true`) runs make's 0.05 second default and only
 * belongs inside a loop, where it runs again and again; mods/stepBlocks.js
 * keeps it there.
 *
 * Each category's entries are blocks (`entryType: 'block'`) and examples
 * (`entryType: 'example'`, a saved workspace with its devices) for the
 * cheatsheet. @protorobotics/jenga turns the blocks into Blockly blocks.
 */
import { FieldImage, FieldNumber } from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'
import { FieldGridDropdown } from '@blockly/field-grid-dropdown'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import { deviceField } from '../mods/deviceField'
import { helpIcon } from '../assets'

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

const text = (words) => ({ text: words })
const field = (name, make) => ({ name, field: make })
const slot = (name, type, shadow) => ({
    blocklyInput: { name, type, ...(shadow ? { shadow } : {}) },
})

/** forward or backward, for Spin, Drive and Curve. */
const ways = () =>
    gridDropdown([
        ['forward', 'forward'],
        ['backward', 'backward'],
    ])
/** right or left, for Turn: make's turn has the left wheels go forward. */
const turns = () =>
    gridDropdown([
        ['right', 'right'],
        ['left', 'left'],
    ])
/** How a timed block measures how long it runs. */
const units = () =>
    gridDropdown([
        ['seconds', 'seconds'],
        ['degrees', 'degrees'],
    ])
/** How a Stop block stops. */
const stops = () =>
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
const numberShadows = new Map()
const numberShadow = (value) => {
    const type = `num_${String(value).replace('-', 'm').replace('.', '_')}`
    numberShadows.set(type, value)
    return type
}
/** A number slot with its default. */
const num = (name, value) => slot(name, 'Number', numberShadow(value))
/** The Python of a number slot: what is in it, or 0 if it is empty. */
const val = (block, name) =>
    pythonGenerator.valueToCode(block, name, Order.NONE) || '0'

// the board's buttons and lights; the value is the port in lower case
const buttons = [
    ['A', 'a'],
    ['B', 'b'],
    ['C', 'c'],
    ['D', 'd'],
]
const lights = [
    ['L1', 'l1'],
    ['L2', 'l2'],
]

// ---- what blocks write -------------------------------------------------------

/**
 * Converts learner-entered names into valid Python identifiers.
 * @param {string} str Name entered in a Blockly text field.
 * @returns {string} Name with whitespace replaced by underscores.
 */
const spacesToUnderscores = (str) => String(str ?? '').replace(/\s+/g, '_')

/** @returns {string} The device a block uses, as Python names it. */
const deviceOf = (block) => spacesToUnderscores(block.getFieldValue('name'))

/** Backward, or left for a Turn: make's _back version of the call. */
const isBack = (block) =>
    ['backward', 'left'].includes(block.getFieldValue('way'))

/**
 * A make call for a timed motion block: the seconds version, or the
 * degrees version when the block is set to degrees.
 * @param {object} block
 * @param {string} verb spin, drive or turn.
 * @returns {string} One line of Python.
 */
const timedCall = (block, verb) => {
    const method = isBack(block) ? `${verb}_back` : verb
    const p = val(block, 'power')
    const n = val(block, 'amount')
    return block.getFieldValue('unit') === 'degrees'
        ? `${deviceOf(block)}.${method}_degrees(degrees=${n}, power=${p})\n`
        : `${deviceOf(block)}.${method}(power=${p}, seconds=${n})\n`
}

/** A step: make's call with no time, so its 0.05 second default. */
const stepCall = (block, verb) => {
    const method = isBack(block) ? `${verb}_back` : verb
    return `${deviceOf(block)}.${method}(power=${val(block, 'power')})\n`
}

/** Curve's two powers, left then right, as make's curve takes them. */
const curvePowers = (block) =>
    `left_power=${val(block, 'left')}, right_power=${val(block, 'right')}`

const stopCall = (block) =>
    `${deviceOf(block)}.${block.getFieldValue('mode') === 'coast' ? 'stop' : 'brake'}()\n`

/** The Python inside a loop or If; pass when it is empty. */
const inside = (block, generator, name = 'input') =>
    generator.statementToCode(block, name) || `${generator.INDENT}pass\n`

const condition = (block, generator, name = 'function') =>
    generator.valueToCode(block, name, Order.NONE) || 'False'

const number = (block, generator, name, order = Order.NONE) =>
    generator.valueToCode(block, name, order) || '0'

/**
 * A board button or light. make has the board's own ready under their
 * port's name, so a block uses that name: A, L1.
 * @param {object} block A block with a `button` or `light` field.
 * @param {'button'|'light'} kind
 * @returns {string}
 */
const boardPart = (block, kind) => block.getFieldValue(kind).toUpperCase()

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
const block = (
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
const example = (name, preamble, devices, blocks) => ({
    entryType: 'example',
    name,
    preamble,
    workspace: {
        devices,
        blocks: { languageVersion: 0, blocks },
    },
})

const boolOut = { blocklyOutput: { type: 'Boolean', name: 'value' } }
const numberOut = { blocklyOutput: { type: 'Number', name: 'value' } }

// example devices
const ARM = { kind: 'drive_motor', name: 'arm', port: '0', direction: '1' }
const LEFT = { kind: 'drive_motor', name: 'left', port: '1', direction: '1' }
const RIGHT = { kind: 'drive_motor', name: 'right', port: '2', direction: '-1' }
// a drivetrain of the two wheels, left then right (make's drivetrain(left, right))
const ROBOT = { kind: 'drivetrain', name: 'robot', motors: ['left', 'right'] }

export const library = [
    {
        name: 'Motor',
        color: '#F2737B',
        entries: [
            block(
                'motorSpin',
                'Spins a motor forward or backward for some seconds, or through some degrees, then stops it. Degrees are how far the motor shaft turns: 360 is one full turn.',
                [
                    text('Spin'),
                    field('name', deviceField('drive_motor')),
                    field('way', ways),
                    text('at'),
                    num('power', 50),
                    text('power for'),
                    num('amount', 1),
                    field('unit', units),
                ],
                (b) => timedCall(b, 'spin'),
            ),
            block(
                'motorSpinStep',
                'A step: spins a motor for a moment. It only goes inside a loop, which runs it again and again, so the motor keeps spinning while the loop does.',
                [
                    text('Spin'),
                    field('name', deviceField('drive_motor')),
                    field('way', ways),
                    text('at'),
                    num('power', 50),
                    text('power'),
                ],
                (b) => stepCall(b, 'spin'),
                { step: true },
            ),
            block(
                'motorHold',
                'Holds a motor where it is for some seconds: it pushes back against a load, like an arm holding something up, to stay at its angle. Then it lets go.',
                [
                    text('Hold'),
                    field('name', deviceField('drive_motor')),
                    text('for'),
                    num('time', 1),
                    text('seconds'),
                ],
                (b) => `${deviceOf(b)}.hold(seconds=${val(b, 'time')})\n`,
            ),
            block(
                'motorHoldStep',
                'A step: holds a motor where it is for a moment. It only goes inside a loop, which keeps the motor held while the loop runs.',
                [text('Hold'), field('name', deviceField('drive_motor'))],
                (b) => `${deviceOf(b)}.hold()\n`,
                { step: true },
            ),
            block(
                'motorStop',
                'Stops a motor. Brake stops it quickly; coast lets it roll to a stop.',
                [
                    text('Stop'),
                    field('name', deviceField('drive_motor')),
                    text('and'),
                    field('mode', stops),
                ],
                stopCall,
            ),
            block(
                'motorDegrees',
                'How far a motor has turned since the program started, in degrees. 360 is one full turn; backward counts down.',
                [
                    text('degrees turned by'),
                    field('name', deviceField('drive_motor')),
                ],
                (b) => [
                    `${deviceOf(b)}.get_encoder().get_degrees()`,
                    Order.FUNCTION_CALL,
                ],
                numberOut,
            ),
            block(
                'motorSpeed',
                'How fast a motor is turning, in degrees each second. Below 0 when it turns backward.',
                [text('speed of'), field('name', deviceField('drive_motor'))],
                (b) => [
                    `${deviceOf(b)}.get_encoder().get_speed()`,
                    Order.FUNCTION_CALL,
                ],
                numberOut,
            ),
            example(
                'Lift an arm a quarter turn',
                'Turns the arm 90 degrees up, holds it there for 2 seconds, and lowers it.',
                [ARM],
                [
                    {
                        type: 'motorSpin',
                        x: 12,
                        y: 12,
                        fields: {
                            name: 'arm',
                            way: 'forward',
                            power: 50,
                            amount: 90,
                            unit: 'degrees',
                        },
                        next: {
                            block: {
                                type: 'motorHold',
                                fields: { name: 'arm', time: 2 },
                                next: {
                                    block: {
                                        type: 'motorSpin',
                                        fields: {
                                            name: 'arm',
                                            way: 'backward',
                                            power: 30,
                                            amount: 90,
                                            unit: 'degrees',
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            ),
            example(
                'Spin while a button is held',
                'A step inside a loop: the motor spins for as long as button B is held, then brakes.',
                [ARM],
                [
                    {
                        type: 'repeatIf',
                        x: 12,
                        y: 12,
                        fields: { operation: 'while' },
                        inputs: {
                            function: {
                                block: {
                                    type: 'buttonHeld',
                                    fields: { button: 'b' },
                                },
                            },
                            input: {
                                block: {
                                    type: 'motorSpinStep',
                                    fields: {
                                        name: 'arm',
                                        way: 'forward',
                                        power: 60,
                                    },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'motorStop',
                                fields: { name: 'arm', mode: 'brake' },
                            },
                        },
                    },
                ],
            ),
        ],
    },
    {
        name: 'Drivetrain',
        color: '#00B8AA',
        entries: [
            block(
                'driveFor',
                'Drives a drivetrain straight forward or backward for some seconds, or until every wheel has turned some degrees, then stops it. Degrees are of the wheels, not the robot: 360 is one full turn of each wheel.',
                [
                    text('Drive'),
                    field('name', deviceField('drivetrain')),
                    field('way', ways),
                    text('at'),
                    num('power', 50),
                    text('power for'),
                    num('amount', 1),
                    field('unit', units),
                ],
                (b) => timedCall(b, 'drive'),
            ),
            block(
                'driveStep',
                'A step: drives a drivetrain straight for a moment. It only goes inside a loop. A Drive step and a Turn step in one loop add up, so the robot drives in an arc.',
                [
                    text('Drive'),
                    field('name', deviceField('drivetrain')),
                    field('way', ways),
                    text('at'),
                    num('power', 50),
                    text('power'),
                ],
                (b) => stepCall(b, 'drive'),
                { step: true },
            ),
            block(
                'turnFor',
                'Turns a drivetrain on the spot, right or left, for some seconds, or until every wheel has turned some degrees, then stops it. To turn right the left wheels go forward and the right wheels backward.',
                [
                    text('Turn'),
                    field('name', deviceField('drivetrain')),
                    field('way', turns),
                    text('at'),
                    num('power', 50),
                    text('power for'),
                    num('amount', 1),
                    field('unit', units),
                ],
                (b) => timedCall(b, 'turn'),
            ),
            block(
                'turnStep',
                'A step: turns a drivetrain on the spot for a moment. It only goes inside a loop.',
                [
                    text('Turn'),
                    field('name', deviceField('drivetrain')),
                    field('way', turns),
                    text('at'),
                    num('power', 50),
                    text('power'),
                ],
                (b) => stepCall(b, 'turn'),
                { step: true },
            ),
            block(
                'curveFor',
                'Drives a drivetrain in a curve for some seconds, its left and right wheels at their own powers, then stops it. The robot curves toward the slower side.',
                [
                    text('Curve'),
                    field('name', deviceField('drivetrain')),
                    field('way', ways),
                    text('left at'),
                    num('left', 50),
                    text('right at'),
                    num('right', 25),
                    text('power for'),
                    num('time', 1),
                    text('seconds'),
                ],
                (b) => {
                    const method = isBack(b) ? 'curve_back' : 'curve'
                    return `${deviceOf(b)}.${method}(${curvePowers(b)}, seconds=${val(b, 'time')})\n`
                },
            ),
            block(
                'curveStep',
                'A step: drives a drivetrain in a curve for a moment, its left and right wheels at their own powers. It only goes inside a loop.',
                [
                    text('Curve'),
                    field('name', deviceField('drivetrain')),
                    field('way', ways),
                    text('left at'),
                    num('left', 50),
                    text('right at'),
                    num('right', 25),
                    text('power'),
                ],
                (b) => {
                    const method = isBack(b) ? 'curve_back' : 'curve'
                    return `${deviceOf(b)}.${method}(${curvePowers(b)})\n`
                },
                { step: true },
            ),
            block(
                'curveDegrees',
                'Drives a drivetrain in a curve until its left wheels have turned one number of degrees and its right wheels another, all finishing together, then stops it.',
                [
                    text('Curve'),
                    field('name', deviceField('drivetrain')),
                    field('way', ways),
                    text('left'),
                    num('leftDegrees', 720),
                    text('right'),
                    num('rightDegrees', 360),
                    text('degrees at'),
                    num('power', 50),
                    text('power'),
                ],
                (b) => {
                    const method = isBack(b)
                        ? 'curve_back_degrees'
                        : 'curve_degrees'
                    return `${deviceOf(b)}.${method}(left_degrees=${val(b, 'leftDegrees')}, right_degrees=${val(b, 'rightDegrees')}, power=${val(b, 'power')})\n`
                },
            ),
            block(
                'drivetrainStop',
                "Stops a drivetrain's motors. Brake stops them quickly; coast lets them roll to a stop.",
                [
                    text('Stop'),
                    field('name', deviceField('drivetrain')),
                    text('and'),
                    field('mode', stops),
                ],
                stopCall,
            ),
            example(
                'Drive a square',
                'Four times: drive two wheel turns, then turn right. Tune the turn degrees until the corners are square.',
                [LEFT, RIGHT, ROBOT],
                [
                    {
                        type: 'repeatFor',
                        x: 12,
                        y: 12,
                        inputs: {
                            function: {
                                shadow: {
                                    type: 'numberInput',
                                    fields: { operation: 4 },
                                },
                            },
                            input: {
                                block: {
                                    type: 'driveFor',
                                    fields: {
                                        name: 'robot',
                                        way: 'forward',
                                        power: 50,
                                        amount: 720,
                                        unit: 'degrees',
                                    },
                                    next: {
                                        block: {
                                            type: 'turnFor',
                                            fields: {
                                                name: 'robot',
                                                way: 'right',
                                                power: 40,
                                                amount: 200,
                                                unit: 'degrees',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            ),
            example(
                'Drive until a button is pressed',
                'Steps forward again and again until button B is pressed, then brakes.',
                [LEFT, RIGHT, ROBOT],
                [
                    {
                        type: 'repeatIf',
                        x: 12,
                        y: 12,
                        fields: { operation: 'until' },
                        inputs: {
                            function: {
                                block: {
                                    type: 'buttonPressed',
                                    fields: { button: 'b' },
                                },
                            },
                            input: {
                                block: {
                                    type: 'driveStep',
                                    fields: {
                                        name: 'robot',
                                        way: 'forward',
                                        power: 50,
                                    },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'drivetrainStop',
                                fields: { name: 'robot', mode: 'brake' },
                            },
                        },
                    },
                ],
            ),
        ],
    },
    {
        name: 'Board',
        color: '#6395CF',
        entries: [
            block(
                'buttonPressed',
                "True once for each press of one of the board's buttons, A to D. Button A also starts the program.",
                [
                    text('button'),
                    field('button', () => gridDropdown(buttons)),
                    text('pressed?'),
                ],
                (b, g) => [
                    `${boardPart(b, 'button')}.pressed()`,
                    Order.FUNCTION_CALL,
                ],
                boolOut,
            ),
            block(
                'buttonHeld',
                "True for as long as one of the board's buttons is held down.",
                [
                    text('button'),
                    field('button', () => gridDropdown(buttons)),
                    text('held down?'),
                ],
                (b, g) => [
                    `${boardPart(b, 'button')}.held()`,
                    Order.FUNCTION_CALL,
                ],
                boolOut,
            ),
            block(
                'lightSet',
                "Turns one of the board's lights on or off, or the other way round with toggle.",
                [
                    text('Light'),
                    field('light', () => gridDropdown(lights)),
                    field('action', () =>
                        gridDropdown([
                            ['on', 'on'],
                            ['off', 'off'],
                            ['toggle', 'toggle'],
                        ]),
                    ),
                ],
                (b, g) =>
                    `${boardPart(b, 'light')}.${b.getFieldValue('action')}()\n`,
            ),
            block(
                'lightFlash',
                'Turns a light on and off again after some seconds, without waiting: the program goes straight on.',
                [
                    text('Flash'),
                    field('light', () => gridDropdown(lights)),
                    text('for'),
                    num('time', 0.2),
                    text('seconds'),
                ],
                (b, g) =>
                    `${boardPart(b, 'light')}.flash(seconds=${val(b, 'time')})\n`,
            ),
            example(
                'The light shows the button',
                'Forever: light L1 is on while button B is held down, and off when it is not.',
                [],
                [
                    {
                        type: 'forever',
                        x: 12,
                        y: 12,
                        inputs: {
                            input: {
                                block: {
                                    type: 'ifElse',
                                    inputs: {
                                        function: {
                                            block: {
                                                type: 'buttonHeld',
                                                fields: { button: 'b' },
                                            },
                                        },
                                        input: {
                                            block: {
                                                type: 'lightSet',
                                                fields: {
                                                    light: 'l1',
                                                    action: 'on',
                                                },
                                            },
                                        },
                                        input_else: {
                                            block: {
                                                type: 'lightSet',
                                                fields: {
                                                    light: 'l1',
                                                    action: 'off',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            ),
        ],
    },
    {
        name: 'Time',
        color: '#9970B1',
        entries: [
            block(
                'wait',
                'Waits some seconds before the next block. A motor that is not in a step keeps still while it waits.',
                [text('Wait'), num('time', 1), text('seconds')],
                (b) => `wait(seconds=${val(b, 'time')})\n`,
            ),
            block(
                'until',
                'Waits until a condition is true, like a button being pressed.',
                [text('Wait until'), slot('function', 'Boolean')],
                (b, g) => `wait_until(lambda: ${condition(b, g)})\n`,
            ),
            example(
                'Wait for a button',
                'Waits until button B is pressed, flashes light L1, then spins the arm one turn.',
                [ARM],
                [
                    {
                        type: 'until',
                        x: 12,
                        y: 12,
                        inputs: {
                            function: {
                                block: {
                                    type: 'buttonPressed',
                                    fields: { button: 'b' },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'lightFlash',
                                fields: { light: 'l1', time: 0.2 },
                                next: {
                                    block: {
                                        type: 'motorSpin',
                                        fields: {
                                            name: 'arm',
                                            way: 'forward',
                                            power: 50,
                                            amount: 360,
                                            unit: 'degrees',
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            ),
        ],
    },
    {
        name: 'Flow',
        color: '#F8BF41',
        entries: [
            block(
                'if',
                'Runs the blocks inside only when the condition is true.',
                [
                    text('If'),
                    slot('function', 'Boolean'),
                    text('then'),
                    slot('input', 'Void'),
                ],
                (b, g) => `if ${condition(b, g)}:\n${inside(b, g)}`,
            ),
            block(
                'ifElse',
                'Runs the first blocks when the condition is true, and the else blocks when it is not.',
                [
                    text('If'),
                    slot('function', 'Boolean'),
                    text('then'),
                    slot('input', 'Void'),
                    text('\nelse'),
                    slot('input_else', 'Void'),
                ],
                (b, g) =>
                    `if ${condition(b, g)}:\n${inside(b, g)}else:\n${inside(b, g, 'input_else')}`,
            ),
            block(
                'forever',
                'Runs the blocks inside again and again, until the program is stopped.',
                [text('Forever'), slot('input', 'Void')],
                (b, g) => `while True:\n${inside(b, g)}`,
                { loop: true },
            ),
            block(
                'repeatFor',
                'Runs the blocks inside a number of times.',
                [
                    text('Repeat'),
                    num('function', 3),
                    text('times'),
                    slot('input', 'Void'),
                ],
                (b, g) =>
                    `for i in range(${number(b, g, 'function')}):\n${inside(b, g)}`,
                { loop: true, inputsInline: true },
            ),
            block(
                'repeatSeconds',
                'Runs the blocks inside again and again for some seconds.',
                [
                    text('Repeat for'),
                    num('time', 5),
                    text('seconds'),
                    slot('input', 'Void'),
                ],
                // the for loop makes its own timer, so loops inside each
                // other or one after another never share one
                (b, g) =>
                    `for _ in countdown(${val(b, 'time')}):\n${inside(b, g)}`,
                { loop: true },
            ),
            block(
                'repeatIf',
                'Runs the blocks inside again and again while a condition is true, or until it becomes true.',
                [
                    text('Repeat'),
                    field('operation', () =>
                        gridDropdown([
                            ['until', 'until'],
                            ['while', 'while'],
                        ]),
                    ),
                    slot('function', 'Boolean'),
                    slot('input', 'Void'),
                ],
                (b, g) => {
                    const not =
                        b.getFieldValue('operation') === 'until' ? 'not ' : ''
                    const c =
                        g.valueToCode(
                            b,
                            'function',
                            not ? Order.LOGICAL_NOT : Order.NONE,
                        ) || 'False'
                    return `while ${not}${c}:\n${inside(b, g)}`
                },
                { loop: true },
            ),
            example(
                'Repeat for a time',
                'For 5 seconds the arm spins and light L1 blinks, both in the same loop. Then the arm brakes.',
                [ARM],
                [
                    {
                        type: 'repeatSeconds',
                        x: 12,
                        y: 12,
                        fields: { time: 5 },
                        inputs: {
                            input: {
                                block: {
                                    type: 'motorSpinStep',
                                    fields: {
                                        name: 'arm',
                                        way: 'forward',
                                        power: 40,
                                    },
                                    next: {
                                        block: {
                                            type: 'lightSet',
                                            fields: {
                                                light: 'l1',
                                                action: 'toggle',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'motorStop',
                                fields: { name: 'arm', mode: 'brake' },
                            },
                        },
                    },
                ],
            ),
        ],
    },
    {
        name: 'Operators',
        color: '#59B03C',
        entries: [
            block(
                'numberInput',
                'A number.',
                [field('operation', () => new FieldNumber(0))],
                (b) => [`${b.getFieldValue('operation')}`, Order.ATOMIC],
                { ...numberOut, inputsInline: true },
            ),
            block(
                'arithmetic',
                'Adds, takes away, multiplies or divides two numbers.',
                [
                    num('a', 0),
                    field('op', () =>
                        gridDropdown([
                            ['+', '+'],
                            ['−', '-'],
                            ['×', '*'],
                            ['÷', '/'],
                        ]),
                    ),
                    num('b', 0),
                ],
                (b, g) => {
                    const op = b.getFieldValue('op')
                    const order =
                        op === '+' || op === '-'
                            ? Order.ADDITIVE
                            : Order.MULTIPLICATIVE
                    return [
                        `${number(b, g, 'a', order)} ${op} ${number(b, g, 'b', order)}`,
                        order,
                    ]
                },
                { ...numberOut, inputsInline: true },
            ),
            block(
                'logicalCompare',
                'True when both conditions are (and), or when either one is (or).',
                [
                    slot('functionA', 'Boolean'),
                    field('operation', () =>
                        gridDropdown([
                            ['and', 'and'],
                            ['or', 'or'],
                        ]),
                    ),
                    slot('functionB', 'Boolean'),
                ],
                (b, g) => {
                    const op = b.getFieldValue('operation')
                    const order =
                        op === 'and' ? Order.LOGICAL_AND : Order.LOGICAL_OR
                    const left = g.valueToCode(b, 'functionA', order) || 'False'
                    const right =
                        g.valueToCode(b, 'functionB', order) || 'False'
                    return [`${left} ${op} ${right}`, order]
                },
                { ...boolOut, inputsInline: true },
            ),
            block(
                'logicalNot',
                'True when the condition is false, and false when it is true.',
                [text('not'), slot('functionA', 'Boolean')],
                (b, g) => [
                    `not ${g.valueToCode(b, 'functionA', Order.LOGICAL_NOT) || 'False'}`,
                    Order.LOGICAL_NOT,
                ],
                boolOut,
            ),
            block(
                'compareNumbers',
                'Compares two numbers: true when the first is less than, more than, or equal to the second.',
                [
                    num('a', 0),
                    field('op', () =>
                        gridDropdown([
                            ['<', '<'],
                            ['>', '>'],
                            ['=', '=='],
                        ]),
                    ),
                    num('b', 0),
                ],
                (b, g) => [
                    `${number(b, g, 'a', Order.RELATIONAL)} ${b.getFieldValue('op')} ${number(b, g, 'b', Order.RELATIONAL)}`,
                    Order.RELATIONAL,
                ],
                { ...boolOut, inputsInline: true },
            ),
            block(
                'booleanInput',
                'True or false.',
                [
                    field('operation', () =>
                        gridDropdown([
                            ['true', 'True'],
                            ['false', 'False'],
                        ]),
                    ),
                ],
                (b) => [b.getFieldValue('operation'), Order.ATOMIC],
                { ...boolOut, inputsInline: true },
            ),
        ],
    },
    {
        name: 'Variables',
        color: '#FE8A18',
        entries: [
            block(
                'varSet',
                'Gives a variable a new number to remember. Make variables with the Devices button; each one starts at its own number.',
                [
                    text('Set'),
                    field('name', deviceField('variable')),
                    text('to'),
                    num('value', 0),
                ],
                (b, g) => `${deviceOf(b)} = ${number(b, g, 'value')}\n`,
                { inputsInline: true },
            ),
            block(
                'varChange',
                'Adds a number to a variable: change by 1 counts up, change by -1 counts down.',
                [
                    text('Change'),
                    field('name', deviceField('variable')),
                    text('by'),
                    num('value', 1),
                ],
                (b, g) => `${deviceOf(b)} += ${number(b, g, 'value')}\n`,
                { inputsInline: true },
            ),
            block(
                'varGet',
                'The number a variable remembers.',
                [field('name', deviceField('variable'))],
                (b) => [deviceOf(b), Order.ATOMIC],
                { ...numberOut, inputsInline: true },
            ),
            example(
                'Count presses',
                'Counts presses of button B and flashes light L1 for each, until there have been 3. The variable count starts at 0.',
                [{ kind: 'variable', name: 'count', value: '0' }],
                [
                    {
                        type: 'varSet',
                        x: 12,
                        y: 12,
                        fields: { name: 'count' },
                        inputs: {
                            value: {
                                shadow: {
                                    type: 'numberInput',
                                    fields: { operation: 0 },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'repeatIf',
                                fields: { operation: 'until' },
                                inputs: {
                                    function: {
                                        block: {
                                            type: 'compareNumbers',
                                            fields: { op: '==' },
                                            inputs: {
                                                a: {
                                                    block: {
                                                        type: 'varGet',
                                                        fields: {
                                                            name: 'count',
                                                        },
                                                    },
                                                },
                                                b: {
                                                    shadow: {
                                                        type: 'numberInput',
                                                        fields: {
                                                            operation: 3,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    input: {
                                        block: {
                                            type: 'if',
                                            inputs: {
                                                function: {
                                                    block: {
                                                        type: 'buttonPressed',
                                                        fields: { button: 'b' },
                                                    },
                                                },
                                                input: {
                                                    block: {
                                                        type: 'varChange',
                                                        fields: {
                                                            name: 'count',
                                                        },
                                                        inputs: {
                                                            value: {
                                                                shadow: {
                                                                    type: 'numberInput',
                                                                    fields: {
                                                                        operation: 1,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                        next: {
                                                            block: {
                                                                type: 'lightFlash',
                                                                fields: {
                                                                    light: 'l1',
                                                                    time: 0.2,
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            ),
        ],
    },
]

// the hidden number blocks the slots hold
library.push({
    name: 'Numbers',
    color: '#9a9a9a',
    hidden: true,
    entries: [...numberShadows].map(([type, value]) =>
        block(
            type,
            'A number.',
            [field('operation', () => new FieldNumber(value))],
            (b) => [`${b.getFieldValue('operation')}`, Order.ATOMIC],
            numberOut,
        ),
    ),
})

/** Each block type's number slots: slot name to the default's block type. */
export const numberSlots = Object.fromEntries(
    library.flatMap((category) =>
        category.entries
            .filter((entry) => entry.entryType === 'block')
            .map((entry) => [
                entry.name,
                Object.fromEntries(
                    entry.blocklyTemplate
                        .filter((part) => part.blocklyInput?.type === 'Number')
                        .map((part) => [
                            part.blocklyInput.name,
                            part.blocklyInput.shadow,
                        ]),
                ),
            ]),
    ),
)

/** The hidden number block types. */
export const numberShadowTypes = new Set(numberShadows.keys())

/**
 * A saved block (and everything in and under it) with its numbers in
 * their slots: a number given as a field ({ power: 50 }) becomes the
 * slot's default block holding it, and a number block in a slot takes the
 * slot's own default type. Examples and tests write numbers as fields.
 * @param {object} blockState
 * @returns {object}
 */
export const numbersToSlots = (blockState) => {
    if (!blockState || typeof blockState !== 'object') {
        return blockState
    }
    const slots = numberSlots[blockState.type] ?? {}
    const fields = { ...(blockState.fields ?? {}) }
    const inputs = { ...(blockState.inputs ?? {}) }
    for (const [name, shadowType] of Object.entries(slots)) {
        if (typeof fields[name] === 'number') {
            inputs[name] = {
                ...inputs[name],
                shadow: {
                    type: shadowType,
                    fields: { operation: fields[name] },
                },
            }
            delete fields[name]
        } else if (inputs[name]?.shadow?.type === 'numberInput') {
            inputs[name] = {
                ...inputs[name],
                shadow: { ...inputs[name].shadow, type: shadowType },
            }
        }
    }
    for (const [name, input] of Object.entries(inputs)) {
        inputs[name] = {
            ...input,
            ...(input.block ? { block: numbersToSlots(input.block) } : {}),
        }
    }
    return {
        ...blockState,
        fields,
        ...(Object.keys(inputs).length ? { inputs } : {}),
        ...(blockState.next?.block
            ? { next: { block: numbersToSlots(blockState.next.block) } }
            : {}),
    }
}

// the examples are written with numbers as fields
for (const category of library) {
    for (const entry of category.entries) {
        if (entry.entryType === 'example') {
            entry.workspace.blocks.blocks =
                entry.workspace.blocks.blocks.map(numbersToSlots)
        }
    }
}

/** The block types of every block marked `step: true`: they only belong in loops. */
export const stepBlockTypes = new Set(
    library.flatMap((category) =>
        category.entries
            .filter((entry) => entry.step)
            .map((entry) => entry.name),
    ),
)

/** The block types that run what is inside them again and again. */
export const loopBlockTypes = new Set(
    library.flatMap((category) =>
        category.entries
            .filter((entry) => entry.loop)
            .map((entry) => entry.name),
    ),
)

/**
 * Adds the shared cheatsheet-help control to each Blockly block definition.
 * @param {object[]} blocks Blockly category definitions to modify.
 * @returns {object[]} The same categories with help controls attached.
 */
const injectHelpButton = (blocks) => {
    blocks.forEach((category) => {
        // A hidden category has no cheatsheet entry for the icon to open.
        if (category.hidden) {
            return
        }

        category.entries.forEach((entry) => {
            if (entry.entryType && entry.entryType !== 'block') {
                return
            }

            entry.blocklyTemplate.push({
                field: () =>
                    new FieldImage(helpIcon, 15, 15, 'Info', () => {
                        document.dispatchEvent(
                            new CustomEvent(openCheatSheetDrawerEvent, {
                                detail: { blockName: entry.name },
                            }),
                        )
                    }),
                name: 'info_icon',
            })
        })
    })

    return blocks
}

/** Names of the categories left out unless an embed asks for them. */
export const hiddenCategoryNames = library
    .filter((category) => category.hidden)
    .map((category) => category.name)

/** Types of the blocks left out of the toolbox unless an embed asks for them. */
export const toolboxHiddenBlockTypes = library.flatMap((category) =>
    category.entries
        .filter(
            (entry) => entry.entryType === 'block' && entry.toolbox === false,
        )
        .map((entry) => entry.name),
)

/**
 * Extracts block-only categories for the interactive Jenga toolbox.
 * @param {object[]} [sourceLibrary=library] Library categories to extract.
 * @returns {object[]} Toolbox-ready Blockly categories.
 */
export function extractJengaBlocks(sourceLibrary = library) {
    const categories = Array.isArray(sourceLibrary)
        ? sourceLibrary
        : [sourceLibrary]

    const jengaBlocks = categories.map((category) => {
        const blockEntries = category.entries
            .filter((entry) => entry.entryType === 'block')
            // eslint-disable-next-line no-unused-vars
            .map(({ entryType, ...blockEntry }) => ({
                ...blockEntry,
                blocklyTemplate: [...blockEntry.blocklyTemplate],
            }))

        return {
            name: category.name,
            color: category.color,
            hidden: category.hidden,
            entries: blockEntries,
        }
    })

    return injectHelpButton(jengaBlocks)
}

/**
 * Extracts blocks and examples for cheatsheet rendering.
 * @param {object[]} [sourceLibrary=library] Library categories to extract.
 * @returns {object[]} Cheatsheet-ready categories.
 */
export function extractCheatSheetBlocks(sourceLibrary = library) {
    const categories = Array.isArray(sourceLibrary)
        ? sourceLibrary
        : [sourceLibrary]

    const cheatSheetCategories = categories
        .filter((category) => !category.hidden)
        .map((category) => ({
            name: category.name,
            color: category.color,
            entries: category.entries
                .filter((entry) => entry.entryType === 'block')
                // eslint-disable-next-line no-unused-vars
                .map(({ entryType, ...blockEntry }) => ({
                    ...blockEntry,
                    blocklyTemplate: [...blockEntry.blocklyTemplate],
                })),
            examples: category.entries
                .filter((entry) => entry.entryType === 'example')
                // eslint-disable-next-line no-unused-vars
                .map(({ entryType, ...exampleEntry }) => exampleEntry),
        }))

    return injectHelpButton(cheatSheetCategories)
}

export const jengaBlocks = extractJengaBlocks(library)
export const cheatSheetBlocks = extractCheatSheetBlocks(library)
