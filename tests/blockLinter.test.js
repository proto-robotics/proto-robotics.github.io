/*
 * The block linter (src/mods/blockLinter.js) on real blocks, built from the
 * library on a headless workspace. Each program is a saved workspace, the
 * shape a project file has: devices, then blocks.
 */
import { beforeAll, describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { processJengaTower } from '@protorobotics/jenga'

import { jengaBlocks } from '../src/data/library'
import { blockName, durationText, lintBlocks } from '../src/mods/blockLinter'

beforeAll(() => {
    processJengaTower(jengaBlocks, pythonGenerator)
})

// ---- building programs ------------------------------------------------------

const motor = (name = 'motor', port = '0') => ({
    kind: 'drive_motor',
    name,
    port,
    direction: '1',
})

const drivetrain = (name, left, right, drift = '1') => ({
    kind: 'drivetrain',
    name,
    left,
    right,
    drift,
})

/** A block, with its fields, what is in its slots, and the block under it. */
const block = (type, fields = {}, { inputs, next } = {}) => ({
    type,
    fields,
    ...(inputs ? { inputs } : {}),
    ...(next ? { next: { block: next } } : {}),
})

/** Puts blocks one under another. */
const stack = (...blocks) =>
    blocks.reduceRight((below, top) =>
        below ? { ...top, next: { block: below } } : top,
    )

/** A block in a slot. */
const slot = (child) => ({ block: child })

/** Repeat N times, the count in its shadow number as the toolbox has it. */
const repeat = (times, inside) =>
    block(
        'repeatFor',
        {},
        {
            inputs: {
                function: {
                    shadow: {
                        type: 'numberInput',
                        fields: { operation: times },
                    },
                },
                ...(inside ? { input: slot(inside) } : {}),
            },
        },
    )

const spin = (name = 'motor', power = 100, way = 'forward') =>
    block('spin', { name, way, power })
const wait = (time) => block('wait', { time })
const button = (name, port = 'A') => block('button', { name, port })
const pressed = (name) => block('isPressed', { name })
const forever = (inside) =>
    block('forever', {}, inside ? { inputs: { input: slot(inside) } } : {})

/**
 * Lints a program.
 * @param {object[]} blocks Top blocks.
 * @param {object[]} [devices]
 * @returns {{severity: string, message: string, where: string}[]}
 */
const lint = (blocks, devices = []) => {
    const workspace = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
        { devices, blocks: { languageVersion: 0, blocks } },
        workspace,
    )
    const issues = lintBlocks(workspace).map(
        ({ severity, message, where }) => ({ severity, message, where }),
    )
    workspace.dispose()
    return issues
}

/** Just the messages. */
const messages = (...args) => lint(...args).map((issue) => issue.message)

/** The one issue there is. */
const only = (...args) => {
    const issues = lint(...args)
    expect(issues, JSON.stringify(issues, null, 1)).toHaveLength(1)
    return issues[0]
}

// ---- tests ----------------------------------------------------------------

describe('a program with nothing wrong', () => {
    test('an empty program', () => {
        expect(lint([])).toEqual([])
    })

    test('a motor that spins, waits and stops', () => {
        expect(
            lint(
                [stack(spin(), wait(2), block('stopMotor', { name: 'motor' }))],
                [motor()],
            ),
        ).toEqual([])
    })

    test('a drivetrain that drives backward', () => {
        expect(
            lint(
                [block('drive', { name: 'base', power: -50 })],
                [
                    motor('left', '0'),
                    motor('right', '2'),
                    drivetrain('base', 'left', 'right', '1.05'),
                ],
            ),
        ).toEqual([])
    })

    test('a button read inside a loop', () => {
        expect(
            lint([
                stack(
                    button('go'),
                    forever(
                        block(
                            'if',
                            {},
                            {
                                inputs: {
                                    function: slot(pressed('go')),
                                    input: slot(wait(1)),
                                },
                            },
                        ),
                    ),
                ),
            ]),
        ).toEqual([])
    })
})

describe('device dropdowns on blocks', () => {
    test('blank, with no motors at all', () => {
        expect(only([spin('')])).toEqual({
            severity: 'error',
            message:
                'Add a drive motor with the Devices button, then pick it here.',
            where: 'Spin block',
        })
    })

    test('blank, with a motor to pick', () => {
        expect(only([spin('')], [motor()]).message).toBe(
            'Pick which drive motor this block uses.',
        )
    })

    test('naming a motor that is not set up', () => {
        expect(only([spin('arm')], [motor()]).message).toBe(
            'There is no drive motor named arm. Add it with the Devices button, or pick another.',
        )
    })

    test('naming a drivetrain as a motor', () => {
        const issue = only(
            [spin('base')],
            [
                motor('left', '0'),
                motor('right', '1'),
                drivetrain('base', 'left', 'right'),
            ],
        )
        expect(issue.message).toMatch(/no drive motor named base/)
    })

    test('a blank drivetrain block says to add a drivetrain', () => {
        expect(only([block('drive', { name: '', power: 50 })]).message).toBe(
            'Add a drivetrain with the Devices button, then pick it here.',
        )
    })
})

describe('device names', () => {
    test('a device with no name', () => {
        expect(messages([], [motor('')])).toEqual([
            'A drive motor has no name. Give it one.',
        ])
    })

    test('two devices with one name', () => {
        expect(messages([], [motor('arm', '0'), motor('arm', '1')])).toEqual([
            'Two devices are named arm. Give each one its own name.',
        ])
    })

    test.each(['for', 'if', 'True', 'make', 'time'])(
        'a device named %s',
        (name) => {
            expect(messages([], [motor(name)])).toEqual([
                `${name} can't be a device's name: the program uses that word. Pick another name.`,
            ])
        },
    )

    test('issues about devices are listed under Devices', () => {
        expect(only([], [motor('')]).where).toBe('Devices')
    })
})

describe('drivetrains', () => {
    test('blank motors with no motors to pick', () => {
        expect(messages([], [drivetrain('base', '', '')])).toEqual([
            'base needs a left motor. Add a drive motor, then pick it.',
            'base needs a right motor. Add a drive motor, then pick it.',
        ])
    })

    test('a blank motor with motors to pick', () => {
        expect(
            messages([], [motor('left'), drivetrain('base', 'left', '')]),
        ).toEqual(["Pick base's right motor."])
    })

    test('a motor that is not set up', () => {
        expect(
            messages(
                [],
                [
                    motor('left', '0'),
                    motor('right', '1'),
                    drivetrain('base', 'left', 'gone'),
                ],
            ),
        ).toEqual([
            "base's right motor, gone, is not a drive motor. Pick another.",
        ])
    })

    test('one motor for both sides', () => {
        expect(
            lint([], [motor('left'), drivetrain('base', 'left', 'left')]),
        ).toEqual([
            {
                severity: 'warning',
                message:
                    'base uses left for both sides. Pick a different motor for one side.',
                where: 'Devices',
            },
        ])
    })

    const withDrift = (drift) =>
        lint(
            [],
            [
                motor('left', '0'),
                motor('right', '1'),
                drivetrain('base', 'left', 'right', drift),
            ],
        )

    test.each(['0', '-1'])('drift %s stops a side: an error', (drift) => {
        const issues = withDrift(drift)
        expect(issues).toHaveLength(1)
        expect(issues[0].severity).toBe('error')
        expect(issues[0].message).toMatch(/Drift must be above 0/)
    })

    test.each(['0.4', '2.5', '10'])('drift %s: a warning', (drift) => {
        const issues = withDrift(drift)
        expect(issues).toHaveLength(1)
        expect(issues[0].severity).toBe('warning')
        expect(issues[0].message).toMatch(/less than half power/)
    })

    test.each(['0.5', '0.9', '1', '1.2', '2'])('drift %s: fine', (drift) => {
        expect(withDrift(drift)).toEqual([])
    })
})

describe('ports', () => {
    test('two motors on one port', () => {
        expect(only([], [motor('left', '0'), motor('right', '0')])).toEqual({
            severity: 'warning',
            message:
                'left and right are both on port 0. Give each one its own port.',
            where: 'Devices',
        })
    })

    test('three motors on one port', () => {
        expect(
            only([], [motor('a', '1'), motor('b', '1'), motor('c', '1')])
                .message,
        ).toMatch(/^a and b and c are all on port 1/)
    })

    test('motors on ports of their own', () => {
        expect(lint([], [motor('a', '0'), motor('b', '1')])).toEqual([])
    })
})

describe('times', () => {
    test('Wait 0 seconds', () => {
        expect(only([wait(0)])).toEqual({
            severity: 'warning',
            message:
                'Waiting 0 seconds does nothing. Wait at least a little, like 1 second.',
            where: 'Wait block',
        })
    })

    test('Wait 400 seconds: likely meant as milliseconds', () => {
        expect(only([wait(400)]).message).toBe(
            '400 seconds is 6 minutes 40 seconds. Times are in seconds: 0.4 seconds is 400 milliseconds.',
        )
    })

    test('Wait 1000 seconds', () => {
        expect(only([wait(1000)]).message).toMatch(
            /^1000 seconds is 16 minutes 40 seconds\. .* 1 seconds is 1000 milliseconds\.$/,
        )
    })

    test('a minute is long enough to ask about', () => {
        expect(only([wait(60)]).message).toMatch(/^60 seconds is 1 minute\./)
    })

    test.each([0.01, 0.5, 1, 2.5, 30, 59.99])('Wait %s seconds: fine', (s) => {
        expect(lint([wait(s)])).toEqual([])
    })

    test('Spin for 0 seconds', () => {
        expect(
            messages(
                [
                    block('spinForTime', {
                        name: 'motor',
                        way: 'forward',
                        power: 50,
                        time: 0,
                    }),
                ],
                [motor()],
            ),
        ).toEqual([
            'For 0 seconds is no time at all, so nothing moves. Set how many seconds.',
        ])
    })

    test('Drive for 120 seconds', () => {
        expect(
            messages(
                [block('driveForTime', { name: 'base', power: 50, time: 120 })],
                [
                    motor('left', '0'),
                    motor('right', '1'),
                    drivetrain('base', 'left', 'right'),
                ],
            ),
        ).toEqual([
            '120 seconds is 2 minutes. Times are in seconds: 0.12 seconds is 120 milliseconds.',
        ])
    })
})

describe('power', () => {
    test('Spin at 0 power', () => {
        expect(messages([spin('motor', 0)], [motor()])).toEqual([
            'At 0 power nothing moves. To stop, use a Stop block.',
        ])
    })

    test('Spin forward at less than 0 power', () => {
        expect(messages([spin('motor', -50, 'forward')], [motor()])).toEqual([
            'Less than 0 power turns forward around, so it spins backward. Pick backward and use power above 0.',
        ])
    })

    test('Spin backward at less than 0 power', () => {
        expect(messages([spin('motor', -50, 'backward')], [motor()])).toEqual([
            'Less than 0 power turns backward around, so it spins forward. Pick forward and use power above 0.',
        ])
    })

    test('Turn at less than 0 power turns the other way: fine', () => {
        expect(
            lint(
                [block('turn', { name: 'base', power: -40 })],
                [
                    motor('left', '0'),
                    motor('right', '1'),
                    drivetrain('base', 'left', 'right'),
                ],
            ),
        ).toEqual([])
    })

    const base = [
        motor('left', '0'),
        motor('right', '1'),
        drivetrain('base', 'left', 'right'),
    ]

    test('Curve at 0 power on both sides', () => {
        expect(
            messages(
                [block('curve', { name: 'base', left: 0, right: 0 })],
                base,
            ),
        ).toEqual([
            'At 0 power on both sides nothing moves. To stop, use a Stop block.',
        ])
    })

    test('Curve at 0 on one side pivots: fine', () => {
        expect(
            lint([block('curve', { name: 'base', left: 0, right: 60 })], base),
        ).toEqual([])
    })

    test('power past 100 is held to 100 by the block itself', () => {
        expect(lint([spin('motor', 400)], [motor()])).toEqual([])
    })
})

describe('Repeat', () => {
    test('Repeat 0 times', () => {
        expect(only([repeat(0, wait(1))])).toEqual({
            severity: 'warning',
            message:
                'Repeat 0 times never runs the blocks inside. Repeat at least 1 time.',
            where: 'Repeat block',
        })
    })

    test('Repeat less than 0 times', () => {
        expect(only([repeat(-3, wait(1))]).message).toMatch(
            /^Repeat -3 times never runs/,
        )
    })

    test('Repeat 2.5 times: not a whole number', () => {
        expect(only([repeat(2.5, wait(1))])).toEqual({
            severity: 'error',
            message:
                "Repeat 2.5 times can't be done: repeat a whole number of times, like 3.",
            where: 'Repeat block',
        })
    })

    test('Repeat 3 times', () => {
        expect(lint([repeat(3, wait(1))])).toEqual([])
    })

    test('Repeat with nothing inside', () => {
        expect(messages([repeat(3)])).toEqual([
            'Repeat block has nothing inside. Put blocks in it.',
        ])
    })
})

describe('empty slots', () => {
    test('If with no condition', () => {
        expect(
            only([block('if', {}, { inputs: { input: slot(wait(1)) } })]),
        ).toEqual({
            severity: 'error',
            message:
                'If needs a condition. With none, the blocks inside never run.',
            where: 'If block',
        })
    })

    test('Wait until with no condition', () => {
        expect(only([block('until')])).toMatchObject({
            severity: 'error',
            message:
                'Wait until needs a condition. With none, it waits forever.',
        })
    })

    test('Wait while with no condition', () => {
        expect(only([block('while')])).toMatchObject({
            severity: 'warning',
            message:
                'Wait while needs a condition. With none, it does not wait.',
        })
    })

    test('Repeat while with no condition', () => {
        const issues = lint([
            block(
                'repeatIf',
                { operation: 'while' },
                {
                    inputs: { input: slot(wait(1)) },
                },
            ),
        ])
        expect(issues).toEqual([
            {
                severity: 'error',
                message:
                    'Repeat needs a condition. Put a condition block in its slot.',
                where: 'Repeat block',
            },
        ])
    })

    test('not with nothing in it', () => {
        const issues = lint([
            button('go'),
            block(
                'until',
                {},
                {
                    inputs: { function: slot(block('logicalNot')) },
                },
            ),
        ])
        expect(issues).toEqual([
            {
                severity: 'warning',
                message: 'not block has an empty slot. Put a block in it.',
                where: 'not block',
            },
        ])
    })
})

describe('blocks inside blocks', () => {
    test('Forever with nothing inside', () => {
        expect(only([forever()])).toEqual({
            severity: 'warning',
            message: 'Forever block has nothing inside. Put blocks in it.',
            where: 'Forever block',
        })
    })

    test('If with nothing inside', () => {
        expect(
            messages([
                stack(
                    button('go'),
                    block(
                        'if',
                        {},
                        {
                            inputs: { function: slot(pressed('go')) },
                        },
                    ),
                ),
            ]),
        ).toEqual(['If block has nothing inside. Put blocks in it.'])
    })

    test('If-else with an empty else part: fine', () => {
        expect(
            lint([
                stack(
                    button('go'),
                    block(
                        'ifElse',
                        {},
                        {
                            inputs: {
                                function: slot(pressed('go')),
                                input: slot(wait(1)),
                            },
                        },
                    ),
                ),
            ]),
        ).toEqual([])
    })
})

describe('after Forever', () => {
    test('the block under a Forever never runs', () => {
        expect(only([stack(forever(wait(1)), wait(2))])).toEqual({
            severity: 'warning',
            message:
                'This block never runs: the Forever above it never ends. Move it above the Forever, or inside it.',
            where: 'Wait block',
        })
    })

    test('only the first block under it is marked', () => {
        expect(lint([stack(forever(wait(1)), wait(2), wait(3))])).toHaveLength(
            1,
        )
    })

    test('blocks inside a Forever run', () => {
        expect(lint([forever(stack(wait(1), wait(2)))])).toEqual([])
    })
})

describe('buttons', () => {
    test('asking about a button that is not set up', () => {
        expect(
            only([
                block(
                    'until',
                    {},
                    { inputs: { function: slot(pressed('go')) } },
                ),
            ]),
        ).toEqual({
            severity: 'error',
            message:
                'There is no button named go. Set it up with an "is button" block first.',
            where: 'is pressed? block',
        })
    })

    test('a button name with spaces matches as Python has it', () => {
        expect(
            lint([
                stack(
                    button('go button'),
                    block(
                        'until',
                        {},
                        {
                            inputs: { function: slot(pressed('go  button')) },
                        },
                    ),
                ),
            ]),
        ).toEqual([])
    })

    test('asking about a button with no name', () => {
        const issues = lint([
            button('go'),
            block('until', {}, { inputs: { function: slot(pressed('')) } }),
        ])
        expect(issues.map((i) => i.message)).toContain(
            'Type the name of the button this block asks about.',
        )
    })

    test('one port set up twice', () => {
        const issues = lint([stack(button('go', 'A'), button('start', 'A'))])
        expect(issues).toHaveLength(2)
        for (const issue of issues) {
            expect(issue).toMatchObject({
                severity: 'error',
                message: 'Button A is set up 2 times. Set each button up once.',
            })
        }
    })

    test('one name on two ports', () => {
        const issues = lint([stack(button('go', 'A'), button('go', 'B'))])
        expect(issues.map((i) => i.severity)).toEqual(['warning', 'warning'])
        expect(issues[0].message).toBe(
            'Two buttons are named go. Give each one its own name.',
        )
    })

    test('a button set up inside a loop', () => {
        expect(only([forever(button('go'))])).toMatchObject({
            severity: 'error',
            message: expect.stringMatching(/Move it above the loop\.$/),
        })
    })

    test('a button set up deep inside a loop', () => {
        const issues = lint([
            repeat(
                2,
                block(
                    'if',
                    {},
                    {
                        inputs: {
                            function: slot(pressed('go')),
                            input: slot(button('go')),
                        },
                    },
                ),
            ),
        ])
        expect(issues.map((i) => i.message)).toContainEqual(
            expect.stringMatching(/Move it above the loop/),
        )
    })

    test('a button named like a device', () => {
        expect(messages([button('motor')], [motor()])).toEqual([
            "motor is already a device's name. Give the button another name.",
        ])
    })

    test('a button named for', () => {
        expect(messages([button('for')])).toEqual([
            "for can't be a button's name: the program uses that word. Pick another name.",
        ])
    })

    test('a button with no name', () => {
        expect(messages([button('')])).toEqual([
            'This button has no name. Give it one.',
        ])
    })
})

describe('the list', () => {
    test('errors come before warnings', () => {
        const issues = lint([stack(wait(0), spin(''))])
        expect(issues.map((i) => i.severity)).toEqual(['error', 'warning'])
    })

    test('device issues and block issues together', () => {
        const issues = lint(
            [spin('motor', 0)],
            [motor(''), motor('motor', '1')],
        )
        expect(issues.map((i) => i.where).sort()).toEqual([
            'Devices',
            'Spin block',
        ])
    })
})

describe('durationText', () => {
    test.each([
        [0.5, '0.5 seconds'],
        [1, '1 second'],
        [45, '45 seconds'],
        [60, '1 minute'],
        [61, '1 minute 1 second'],
        [400, '6 minutes 40 seconds'],
        [3600, '60 minutes'],
    ])('%s seconds', (seconds, text) => {
        expect(durationText(seconds)).toBe(text)
    })
})

describe('blockName', () => {
    test('a block is called by its first words', () => {
        const workspace = new Blockly.Workspace()
        expect(blockName(workspace.newBlock('spin'))).toBe('Spin block')
        expect(blockName(workspace.newBlock('wait'))).toBe('Wait block')
        workspace.dispose()
    })
})
