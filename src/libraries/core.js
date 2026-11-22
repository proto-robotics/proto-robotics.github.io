/*
 * The core blocks: everything that runs both on the robot and in a
 * sandbox. Every block writes a call of the make library (from make import
 * *), and every motion block says how long it runs: some seconds, some
 * degrees, or one short step. A step block (a dashed edge, `step: true`)
 * runs make's 0.05 second default and only belongs inside a loop, where it
 * runs again and again; mods/stepBlocks.js keeps it there.
 *
 * Besides the blocks, this library holds the program's first line, the
 * devices (drive motors, drivetrains, variables) the Devices pop-up sets
 * up, the names make already uses, the linter's rules for its blocks and
 * how blocks and devices of older programs load.
 */
import { categoryIcon } from '../assets'
import makeVocab from '../data/pythonLibraryVocab.json'
import { DEVICE_KINDS } from './coreDevices'
import { turnMotorGroups } from './coreMigrations'
import {
    gridDropdown,
    text,
    field,
    slot,
    ways,
    turns,
    units,
    stops,
    num,
    val,
    buttons,
    deviceOf,
    isBack,
    timedCall,
    stepCall,
    curvePowers,
    stopCall,
    inside,
    condition,
    number,
    boardPart,
    block,
    example,
    boolOut,
    numberOut,
    ARM,
    LEFT,
    RIGHT,
    ROBOT,
    Order,
    fields,
} from './kit'
import { FieldNumber } from 'blockly'
import { deviceField } from '../mods/deviceField'

/** @type {import('./engine').Library} */
export const core = {
    name: 'core',
    /** What every program starts with: the make library's names, bare. */
    preamble: 'from make import *',
    categories: [
    {
        name: 'Motor',
        /** The device kinds its blocks use: the editor gets Devices when it offers them. */
        devices: ['drive_motor'],
        icon: categoryIcon('motor'),
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
        /** The device kinds its blocks use: the editor gets Devices when it offers them. */
        devices: ['drivetrain', 'drive_motor'],
        icon: categoryIcon('drivetrain'),
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
        icon: categoryIcon('board'),
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
        icon: categoryIcon('time'),
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
        icon: categoryIcon('flow'),
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
        icon: categoryIcon('operators'),
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
        /** The device kinds its blocks use: the editor gets Devices when it offers them. */
        devices: ['variable'],
        icon: categoryIcon('variables'),
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
    ],
    devices: DEVICE_KINDS,
    /** The make library's names, for the line editor and checker (scripts/make-vocab.mjs writes it). */
    vocab: makeVocab,
    /** Names the blocks themselves write, which a device must not take. */
    takenNames: ['make', 'system_config', 'i'],
    renames: {
        /** Blocks of the motor groups make had before drivetrains came back: Drive blocks now. */
        blocks: { groupSpin: 'driveFor', groupSpinStep: 'driveStep', groupStop: 'drivetrainStop' },
        /** make called a drivetrain a motor group for a while (motor_group(motors, ratios)). */
        devices: { motor_group: 'drivetrain' },
        /** A motor group that turned the robot: its Spin blocks become Turn blocks. */
        migrate: turnMotorGroups,
    },
    lint: {
        zeroTime: {
            wait: 'Waiting 0 seconds does nothing. Wait at least a little, like 1 second.',
            repeatSeconds:
                'Repeat for 0 seconds never runs the blocks inside. Set how many seconds.',
            motorHold: 'Holding for 0 seconds does nothing. Set how many seconds.',
            curveFor:
                'For 0 seconds is no time at all, so nothing moves. Set how many seconds.',
        },
        longTime: ['wait', 'motorHold', 'curveFor'],
        emptySlot: {
            if: ['error', 'If needs a condition. With none, the blocks inside never run.'],
            ifElse: ['error', 'If needs a condition. With none, only the else blocks run.'],
            until: ['error', 'Wait until needs a condition. With none, it waits forever.'],
            repeatIf: ['error', 'Repeat needs a condition. Put a condition block in its slot.'],
            repeatFor: ['error', 'Repeat needs a number of times.'],
        },
    },
}
