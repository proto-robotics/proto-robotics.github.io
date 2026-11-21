/*
 * The block linter (src/mods/blockLinter.js) on the real blocks, built
 * from the library on a headless workspace.
 */
import { describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'

import { blockName, durationText, lintBlocks } from '../src/mods/blockLinter'
import {
    block,
    defineBlocks,
    drivetrain,
    motor,
    num,
    robot,
    slot,
    stack,
    workspaceOf,
} from './program'

/** Lints a program: its issues, without the block objects. */
const lint = (blocks, devices = []) => {
    const ws = workspaceOf(blocks, devices)
    const issues = lintBlocks(ws).map(({ severity, message, where }) => ({
        severity,
        message,
        where,
    }))
    ws.dispose()
    return issues
}
const messages = (...args) => lint(...args).map((i) => i.message)
const only = (...args) => {
    const issues = lint(...args)
    expect(issues, JSON.stringify(issues, null, 1)).toHaveLength(1)
    return issues[0]
}

const spin = (fields = {}) =>
    block('motorSpin', {
        name: 'arm',
        way: 'forward',
        power: 50,
        amount: 1,
        unit: 'seconds',
        ...fields,
    })
const spinStep = (fields = {}) =>
    block('motorSpinStep', {
        name: 'arm',
        way: 'forward',
        power: 50,
        ...fields,
    })
const wait = (time) => block('wait', { time })
const forever = (inside) =>
    block('forever', {}, inside ? { input: slot(inside) } : undefined)
const pressed = (button = 'b') => block('buttonPressed', { button })

describe('a program with nothing wrong', () => {
    test('an empty program', () => {
        expect(lint([])).toEqual([])
    })

    test('spin, wait, stop', () => {
        expect(
            lint(
                [
                    stack(
                        spin(),
                        wait(2),
                        block('motorStop', { name: 'arm', mode: 'brake' }),
                    ),
                ],
                [motor()],
            ),
        ).toEqual([])
    })

    test('drive until a button is pressed, with a step', () => {
        expect(
            lint(
                [
                    stack(
                        block(
                            'repeatIf',
                            { operation: 'until' },
                            {
                                function: slot(pressed()),
                                input: slot(
                                    block('driveStep', {
                                        name: 'robot',
                                        way: 'forward',
                                        power: 50,
                                    }),
                                ),
                            },
                        ),
                        block('drivetrainStop', {
                            name: 'robot',
                            mode: 'brake',
                        }),
                    ),
                ],
                robot(),
            ),
        ).toEqual([])
    })

    test('a step inside an If inside Forever', () => {
        expect(
            lint(
                [
                    forever(
                        block(
                            'if',
                            {},
                            {
                                function: slot(pressed()),
                                input: slot(spinStep()),
                            },
                        ),
                    ),
                ],
                [motor()],
            ),
        ).toEqual([])
    })

    test('a counter', () => {
        expect(
            lint(
                [
                    forever(
                        block(
                            'varChange',
                            { name: 'count' },
                            { value: num(1) },
                        ),
                    ),
                ],
                [{ kind: 'variable', name: 'count', value: '0' }],
            ),
        ).toEqual([])
    })
})

describe('step blocks', () => {
    test('a step on its own is an error', () => {
        expect(only([spinStep()], [motor()])).toEqual({
            severity: 'error',
            message:
                'A step only works inside a loop, like Forever or Repeat: on its own it runs for a moment and stops. Put it in a loop, or use the Spin block with a time.',
            where: 'Spin step',
        })
    })

    test('a step in an If outside any loop is an error', () => {
        expect(
            messages(
                [
                    block(
                        'if',
                        {},
                        { function: slot(pressed()), input: slot(spinStep()) },
                    ),
                ],
                [motor()],
            ),
        ).toEqual([expect.stringMatching(/^A step only works inside a loop/)])
    })

    test.each(['forever', 'repeatSeconds'])('a step in %s is fine', (loop) => {
        expect(
            lint(
                [block(loop, { time: 5 }, { input: slot(spinStep()) })],
                [motor()],
            ),
        ).toEqual([])
    })
})

describe('device dropdowns', () => {
    test('blank, with no motors', () => {
        expect(only([spin({ name: '' })])).toEqual({
            severity: 'error',
            message:
                'Add a drive motor with the Devices button, then pick it here.',
            where: 'Spin block',
        })
    })

    test('blank, with a motor to pick', () => {
        expect(only([spin({ name: '' })], [motor()]).message).toBe(
            'Pick which drive motor this block uses.',
        )
    })

    test('a motor that is not set up', () => {
        expect(only([spin({ name: 'lift' })], [motor()]).message).toBe(
            'There is no drive motor named lift. Add it with the Devices button, or pick another.',
        )
    })

    test.each([
        [
            'driveFor',
            { way: 'forward', power: 50, amount: 1, unit: 'seconds' },
            'drivetrain',
        ],
        ['motorHold', { time: 1 }, 'drive motor'],
    ])('a blank %s asks for %s', (type, fields, label) => {
        expect(only([block(type, { name: '', ...fields })]).message).toBe(
            `Add a ${label} with the Devices button, then pick it here.`,
        )
    })
})

describe('times and degrees', () => {
    test('Wait 0 seconds', () => {
        expect(only([wait(0)]).message).toBe(
            'Waiting 0 seconds does nothing. Wait at least a little, like 1 second.',
        )
    })

    test('Wait 400 seconds is likely milliseconds', () => {
        expect(only([wait(400)]).message).toBe(
            '400 seconds is 6 minutes 40 seconds. Times are in seconds: 0.4 seconds is 400 milliseconds.',
        )
    })

    test.each([0.5, 1, 30, 59.99])('Wait %s seconds is fine', (s) => {
        expect(lint([wait(s)])).toEqual([])
    })

    test('Spin for 0 seconds', () => {
        expect(only([spin({ amount: 0 })], [motor()]).message).toMatch(
            /^For 0 seconds is no time at all/,
        )
    })

    test('Spin through 0 degrees', () => {
        expect(
            only([spin({ amount: 0, unit: 'degrees' })], [motor()]).message,
        ).toBe(
            'Through 0 degrees nothing moves. Set how many degrees: 360 is one full turn.',
        )
    })

    test('Spin 3600 degrees is fine: degrees are not seconds', () => {
        expect(
            lint([spin({ amount: 3600, unit: 'degrees' })], [motor()]),
        ).toEqual([])
    })

    test('Drive for 120 seconds', () => {
        expect(
            only(
                [
                    block('driveFor', {
                        name: 'robot',
                        way: 'forward',
                        power: 50,
                        amount: 120,
                        unit: 'seconds',
                    }),
                ],
                robot(),
            ).message,
        ).toMatch(/^120 seconds is 2 minutes\./)
    })

    test('Drive through 0 degrees', () => {
        expect(
            only(
                [
                    block('driveFor', {
                        name: 'robot',
                        way: 'forward',
                        power: 50,
                        amount: 0,
                        unit: 'degrees',
                    }),
                ],
                robot(),
            ).message,
        ).toMatch(/^Through 0 degrees nothing moves/)
    })

    test('Repeat for 0 seconds', () => {
        expect(
            only([
                block('repeatSeconds', { time: 0 }, { input: slot(wait(1)) }),
            ]).message,
        ).toMatch(/^Repeat for 0 seconds never runs/)
    })

    test.each([
        ['motorHold', { name: 'arm' }, 'Holding for 0 seconds does nothing'],
        [
            'curveFor',
            { name: 'robot', way: 'forward', left: 50, right: 20 },
            'For 0 seconds is no time at all',
        ],
    ])('%s for 0 seconds', (type, fields, start) => {
        expect(
            only([block(type, { ...fields, time: 0 })], robot().concat(motor()))
                .message,
        ).toMatch(new RegExp(`^${start}`))
    })

    test('Curve with both sides at 0 power', () => {
        expect(
            only(
                [
                    block('curveFor', {
                        name: 'robot',
                        way: 'forward',
                        left: 0,
                        right: 0,
                        time: 1,
                    }),
                ],
                robot(),
            ).message,
        ).toMatch(/^With both sides at 0 power nothing moves/)
    })

    test('Turn left at below 0 power', () => {
        expect(
            only(
                [
                    block('turnFor', {
                        name: 'robot',
                        way: 'left',
                        power: -40,
                        amount: 1,
                        unit: 'seconds',
                    }),
                ],
                robot(),
            ).message,
        ).toMatch(/turns left around, so it goes right/)
    })

    test('a 0 second flash', () => {
        expect(
            only([block('lightFlash', { light: 'l1', time: 0 })]).message,
        ).toMatch(/too short to see/)
    })
})

describe('power', () => {
    test('0 power', () => {
        expect(only([spin({ power: 0 })], [motor()]).message).toBe(
            'At 0 power nothing moves. To stop, use a Stop block.',
        )
    })

    test('below 0 power, forward', () => {
        expect(only([spin({ power: -50 })], [motor()]).message).toBe(
            'Less than 0 power turns forward around, so it goes backward. Pick backward and use power above 0.',
        )
    })

    test('below 0 power, a drivetrain backward', () => {
        expect(
            only(
                [
                    block('driveFor', {
                        name: 'robot',
                        way: 'backward',
                        power: -30,
                        amount: 1,
                        unit: 'seconds',
                    }),
                ],
                robot(),
            ).message,
        ).toMatch(/turns backward around, so it goes forward/)
    })
})

describe('Repeat and slots', () => {
    test('Repeat 0 times', () => {
        expect(
            only([
                block(
                    'repeatFor',
                    {},
                    { function: num(0), input: slot(wait(1)) },
                ),
            ]).message,
        ).toMatch(/never runs/)
    })

    test('Repeat 2.5 times', () => {
        expect(
            only([
                block(
                    'repeatFor',
                    {},
                    { function: num(2.5), input: slot(wait(1)) },
                ),
            ]),
        ).toMatchObject({
            severity: 'error',
            message:
                "Repeat 2.5 times can't be done: repeat a whole number of times, like 3.",
        })
    })

    test('If with no condition', () => {
        expect(only([block('if', {}, { input: slot(wait(1)) })])).toMatchObject(
            {
                severity: 'error',
                message:
                    'If needs a condition. With none, the blocks inside never run.',
            },
        )
    })

    test('Wait until with no condition', () => {
        expect(only([block('until')]).message).toBe(
            'Wait until needs a condition. With none, it waits forever.',
        )
    })

    test('a compare keeps its default number in a slot left out', () => {
        const issues = lint(
            [
                block(
                    'until',
                    {},
                    {
                        function: slot(
                            block(
                                'compareNumbers',
                                { op: '<' },
                                {
                                    a: slot(
                                        block('motorDegrees', { name: 'arm' }),
                                    ),
                                },
                            ),
                        ),
                    },
                ),
            ],
            [motor()],
        )
        expect(issues).toEqual([])
    })

    test('Forever with nothing inside', () => {
        expect(only([forever()]).message).toBe(
            'Forever block has nothing inside. Put blocks in it.',
        )
    })

    test('a block under Forever never runs', () => {
        expect(only([stack(forever(wait(1)), wait(2))]).message).toMatch(
            /^This block never runs/,
        )
    })
})

describe('variables', () => {
    const count = { kind: 'variable', name: 'count', value: '0' }

    test('a blank variable, with none made', () => {
        expect(
            only([block('varChange', { name: '' }, { value: num(1) })]),
        ).toEqual({
            severity: 'error',
            message:
                'Add a variable with the Devices button, then pick it here.',
            where: 'Change block',
        })
    })

    test('a variable that is not made', () => {
        expect(only([block('varGet', { name: 'laps' })], [count]).message).toBe(
            'There is no variable named laps. Add it with the Devices button, or pick another.',
        )
    })

    test.each(['wait', 'button_a', 'i', 'for'])(
        'a variable named %s',
        (name) => {
            expect(only([], [{ ...count, name }])).toEqual({
                severity: 'error',
                message: `${name} can't be a variable's name: the program uses that word. Pick another name.`,
                where: 'Variables',
            })
        },
    )

    test('a variable named like a device', () => {
        expect(messages([], [motor('arm'), { ...count, name: 'arm' }])).toEqual(
            ['arm is used twice. Give each device and variable its own name.'],
        )
    })
})

describe('devices', () => {
    test.each([
        'countdown',
        'drivetrain',
        'button',
        'wait',
        'light_l1',
        'A',
        'L2',
        'for',
    ])('a device named %s', (name) => {
        expect(messages([], [motor(name)])).toEqual([
            `${name} can't be a device's name: the program uses that word. Pick another name.`,
        ])
    })

    test('a nameless device', () => {
        expect(messages([], [motor('')])).toEqual([
            'A drive motor has no name. Give it one.',
        ])
    })

    test('two devices, one name', () => {
        expect(messages([], [motor('arm', '0'), motor('arm', '1')])).toEqual([
            'arm is used twice. Give each device and variable its own name.',
        ])
    })

    test('a drivetrain with blank motors and none to pick', () => {
        expect(messages([], [drivetrain('robot', '', '')])).toEqual([
            'robot needs motors. Add a drive motor, then pick it.',
        ])
    })

    test('a drivetrain with a blank motor to pick', () => {
        expect(
            messages([], [motor('left'), drivetrain('robot', 'left', '')]),
        ).toEqual(["Pick robot's motor 2."])
    })

    test('a drivetrain motor that is not a drive motor', () => {
        expect(
            messages([], [motor('left'), drivetrain('robot', 'left', 'arm')]),
        ).toEqual(["robot's motor arm is not a drive motor. Pick another."])
    })

    test('a drivetrain with one motor twice', () => {
        expect(
            only([], [motor('left'), drivetrain('robot', 'left', 'left')]),
        ).toMatchObject({
            severity: 'error',
            message:
                'robot has left twice. Pick a different motor for each wheel.',
        })
    })

    test('a drivetrain of one motor', () => {
        expect(
            only([], [motor('left'), drivetrain('robot', 'left')]),
        ).toMatchObject({
            severity: 'error',
            message:
                'robot needs at least 2 motors, a left and a right. Add a motor.',
        })
    })

    test('a drivetrain of four motors', () => {
        expect(
            lint(
                [],
                [
                    motor('a', '0'),
                    motor('b', '1'),
                    motor('c', '2'),
                    motor('d', '3'),
                    drivetrain('robot', 'a', 'b', 'c', 'd'),
                ],
            ),
        ).toEqual([])
    })

    test('two drive motors on one port', () => {
        expect(only([], [motor('lift', '3'), motor('grab', '3')]).message).toBe(
            'lift and grab are both on port 3. Give each one its own port.',
        )
    })
})

describe('the list', () => {
    test('errors before warnings', () => {
        expect(
            lint([stack(wait(0), spin({ name: '' }))]).map((i) => i.severity),
        ).toEqual(['error', 'warning'])
    })
})

describe('durationText', () => {
    test.each([
        [0.5, '0.5 seconds'],
        [1, '1 second'],
        [60, '1 minute'],
        [61, '1 minute 1 second'],
        [400, '6 minutes 40 seconds'],
    ])('%s', (s, text) => {
        expect(durationText(s)).toBe(text)
    })
})

describe('blockName', () => {
    test('blocks and steps', () => {
        defineBlocks()
        const ws = new Blockly.Workspace(new Blockly.Options({}))
        expect(blockName(ws.newBlock('motorSpin'))).toBe('Spin block')
        expect(blockName(ws.newBlock('driveStep'))).toBe('Drive step')
        expect(blockName(ws.newBlock('motorHoldStep'))).toBe('Hold step')
        ws.dispose()
    })
})

describe('number slots', () => {
    test('a variable in a slot is not checked: its number comes when the program runs', () => {
        expect(
            lint(
                [
                    block(
                        'motorSpin',
                        {
                            name: 'arm',
                            way: 'forward',
                            amount: 1,
                            unit: 'seconds',
                        },
                        {
                            power: slot(block('varGet', { name: 'speed' })),
                        },
                    ),
                ],
                [motor(), { kind: 'variable', name: 'speed', value: '0' }],
            ),
        ).toEqual([])
    })

    test('power past 100', () => {
        expect(only([spin({ power: 150 })], [motor()]).message).toBe(
            'Power goes from -100 to 100, so 150 runs the same as 100.',
        )
    })

    test('a time below 0', () => {
        expect(only([spin({ amount: -2 })], [motor()]).message).toBe(
            "-2 can't be below 0. To go the other way, pick the other direction.",
        )
    })
})
