/*
 * The Python each block writes, in each of its settings: one make call per
 * block, in make's own words (from make import *).
 */
import { describe, expect, test } from 'vitest'

import { block, motor, num, python, robot, slot, stack } from './program'

describe('Motor', () => {
    test.each([['motorHold', { time: 2 }, 'arm.hold(seconds=2)']])(
        '%s',
        (type, fields, code) => {
            expect(
                python([block(type, { name: 'arm', ...fields })], [motor()]),
            ).toBe(code)
        },
    )

    test('Hold step', () => {
        expect(
            python(
                [
                    block(
                        'forever',
                        {},
                        {
                            input: slot(
                                block('motorHoldStep', { name: 'arm' }),
                            ),
                        },
                    ),
                ],
                [motor()],
            ),
        ).toBe('while True:\n  arm.hold()')
    })

    test.each([
        ['forward', 'seconds', 'arm.spin(power=50, seconds=2)'],
        ['backward', 'seconds', 'arm.spin_back(power=50, seconds=2)'],
        ['forward', 'degrees', 'arm.spin_degrees(degrees=2, power=50)'],
        ['backward', 'degrees', 'arm.spin_back_degrees(degrees=2, power=50)'],
    ])('Spin %s for 2 %s', (way, unit, code) => {
        expect(
            python(
                [
                    block('motorSpin', {
                        name: 'arm',
                        way,
                        power: 50,
                        amount: 2,
                        unit,
                    }),
                ],
                [motor()],
            ),
        ).toBe(code)
    })

    test.each([
        ['forward', 'arm.spin(power=40)'],
        ['backward', 'arm.spin_back(power=40)'],
    ])('Spin step %s', (way, code) => {
        expect(
            python(
                [
                    block(
                        'forever',
                        {},
                        {
                            input: slot(
                                block('motorSpinStep', {
                                    name: 'arm',
                                    way,
                                    power: 40,
                                }),
                            ),
                        },
                    ),
                ],
                [motor()],
            ),
        ).toBe(`while True:\n  ${code}`)
    })

    test.each([
        ['brake', 'arm.brake()'],
        ['coast', 'arm.stop()'],
    ])('Stop and %s', (mode, code) => {
        expect(
            python([block('motorStop', { name: 'arm', mode })], [motor()]),
        ).toBe(code)
    })

    test('degrees turned and speed', () => {
        expect(
            python(
                [
                    block(
                        'until',
                        {},
                        {
                            function: slot(
                                block(
                                    'compareNumbers',
                                    { op: '>' },
                                    {
                                        a: slot(
                                            block('motorDegrees', {
                                                name: 'arm',
                                            }),
                                        ),
                                        b: num(90),
                                    },
                                ),
                            ),
                        },
                    ),
                ],
                [motor()],
            ),
        ).toBe('wait_until(lambda: arm.get_encoder().get_degrees() > 90)')
        expect(
            python(
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
                                            block('motorSpeed', {
                                                name: 'arm',
                                            }),
                                        ),
                                        b: num(10),
                                    },
                                ),
                            ),
                        },
                    ),
                ],
                [motor()],
            ),
        ).toBe('wait_until(lambda: arm.get_encoder().get_speed() < 10)')
    })
})

describe('Drivetrain', () => {
    const timed = (type, way, unit) =>
        python(
            [
                block(type, {
                    name: 'robot',
                    way,
                    power: 50,
                    amount: 3,
                    unit,
                }),
            ],
            robot(),
        )
    const inLoop = (child) =>
        python([block('forever', {}, { input: slot(child) })], robot())

    test.each([
        ['forward', 'seconds', 'robot.drive(power=50, seconds=3)'],
        ['backward', 'seconds', 'robot.drive_back(power=50, seconds=3)'],
        ['forward', 'degrees', 'robot.drive_degrees(degrees=3, power=50)'],
        [
            'backward',
            'degrees',
            'robot.drive_back_degrees(degrees=3, power=50)',
        ],
    ])('Drive %s for 3 %s', (way, unit, code) => {
        expect(timed('driveFor', way, unit)).toBe(code)
    })

    test.each([
        ['right', 'seconds', 'robot.turn(power=50, seconds=3)'],
        ['left', 'seconds', 'robot.turn_back(power=50, seconds=3)'],
        ['right', 'degrees', 'robot.turn_degrees(degrees=3, power=50)'],
        ['left', 'degrees', 'robot.turn_back_degrees(degrees=3, power=50)'],
    ])('Turn %s for 3 %s', (way, unit, code) => {
        expect(timed('turnFor', way, unit)).toBe(code)
    })

    test.each([
        ['driveStep', 'forward', 'robot.drive(power=50)'],
        ['driveStep', 'backward', 'robot.drive_back(power=50)'],
        ['turnStep', 'right', 'robot.turn(power=50)'],
        ['turnStep', 'left', 'robot.turn_back(power=50)'],
    ])('%s %s', (type, way, code) => {
        expect(inLoop(block(type, { name: 'robot', way, power: 50 }))).toBe(
            `while True:\n  ${code}`,
        )
    })

    test.each([
        ['forward', 'robot.curve(left_power=50, right_power=20, seconds=2)'],
        [
            'backward',
            'robot.curve_back(left_power=50, right_power=20, seconds=2)',
        ],
    ])('Curve %s for 2 seconds', (way, code) => {
        expect(
            python(
                [
                    block('curveFor', {
                        name: 'robot',
                        way,
                        left: 50,
                        right: 20,
                        time: 2,
                    }),
                ],
                robot(),
            ),
        ).toBe(code)
    })

    test.each([
        ['forward', 'robot.curve(left_power=50, right_power=20)'],
        ['backward', 'robot.curve_back(left_power=50, right_power=20)'],
    ])('Curve step %s', (way, code) => {
        expect(
            inLoop(
                block('curveStep', { name: 'robot', way, left: 50, right: 20 }),
            ),
        ).toBe(`while True:\n  ${code}`)
    })

    test.each([
        [
            'forward',
            'robot.curve_degrees(left_degrees=720, right_degrees=360, power=40)',
        ],
        [
            'backward',
            'robot.curve_back_degrees(left_degrees=720, right_degrees=360, power=40)',
        ],
    ])('Curve %s by degrees', (way, code) => {
        expect(
            python(
                [
                    block('curveDegrees', {
                        name: 'robot',
                        way,
                        leftDegrees: 720,
                        rightDegrees: 360,
                        power: 40,
                    }),
                ],
                robot(),
            ),
        ).toBe(code)
    })

    test.each([
        ['brake', 'robot.brake()'],
        ['coast', 'robot.stop()'],
    ])('Stop and %s', (mode, code) => {
        expect(
            python([block('drivetrainStop', { name: 'robot', mode })], robot()),
        ).toBe(code)
    })
})

describe('Board', () => {
    test.each([
        ['buttonPressed', 'a', 'A', 'pressed'],
        ['buttonPressed', 'd', 'D', 'pressed'],
        ['buttonHeld', 'b', 'B', 'held'],
    ])('%s %s', (type, button, port, method) => {
        expect(
            python([
                block('until', {}, { function: slot(block(type, { button })) }),
            ]),
        ).toBe(`wait_until(lambda: ${port}.${method}())`)
    })

    test.each([
        ['l1', 'on', 'L1.on()'],
        ['l2', 'off', 'L2.off()'],
        ['l1', 'toggle', 'L1.toggle()'],
    ])('Light %s %s', (light, action, code) => {
        expect(python([block('lightSet', { light, action })])).toBe(code)
    })

    test('Flash', () => {
        expect(python([block('lightFlash', { light: 'l2', time: 0.5 })])).toBe(
            'L2.flash(seconds=0.5)',
        )
    })

    test('the board buttons and lights are used by name, with nothing made first', () => {
        expect(
            python([
                stack(
                    block(
                        'until',
                        {},
                        {
                            function: slot(
                                block('buttonPressed', { button: 'b' }),
                            ),
                        },
                    ),
                    block('lightSet', { light: 'l1', action: 'on' }),
                ),
            ]),
        ).toBe('wait_until(lambda: B.pressed())\nL1.on()')
    })
})

describe('Time and Flow', () => {
    test('Wait and Wait until', () => {
        expect(python([block('wait', { time: 1.5 })])).toBe('wait(seconds=1.5)')
        expect(python([block('until')])).toBe('wait_until(lambda: False)')
    })

    test('the loops', () => {
        expect(
            python([
                block(
                    'forever',
                    {},
                    { input: slot(block('wait', { time: 1 })) },
                ),
            ]),
        ).toBe('while True:\n  wait(seconds=1)')
        expect(
            python([
                block(
                    'repeatFor',
                    {},
                    {
                        function: num(3),
                        input: slot(block('wait', { time: 1 })),
                    },
                ),
            ]),
        ).toBe('for i in range(3):\n  wait(seconds=1)')
        expect(
            python([
                block(
                    'repeatSeconds',
                    { time: 5 },
                    { input: slot(block('wait', { time: 1 })) },
                ),
            ]),
        ).toBe('for _ in countdown(5):\n  wait(seconds=1)')
        expect(
            python([
                block(
                    'repeatIf',
                    { operation: 'until' },
                    {
                        function: slot(block('buttonPressed', { button: 'b' })),
                        input: slot(block('wait', { time: 1 })),
                    },
                ),
            ]),
        ).toBe('while not B.pressed():\n  wait(seconds=1)')
        expect(
            python([
                block(
                    'repeatIf',
                    { operation: 'while' },
                    {
                        function: slot(block('buttonHeld', { button: 'b' })),
                        input: slot(block('wait', { time: 1 })),
                    },
                ),
            ]),
        ).toBe('while B.held():\n  wait(seconds=1)')
    })

    test('Repeat for seconds nests, each loop with its own timer', () => {
        const repeat = (time, inside) =>
            block('repeatSeconds', { time }, { input: slot(inside) })
        expect(
            python([repeat(10, repeat(2, block('wait', { time: 1 })))]),
        ).toBe(
            'for _ in countdown(10):\n' +
                '  for _ in countdown(2):\n' +
                '    wait(seconds=1)',
        )
    })

    test('an empty loop or If writes pass', () => {
        expect(python([block('forever')])).toBe('while True:\n  pass')
    })

    test('If and If-else', () => {
        expect(
            python([
                block(
                    'ifElse',
                    {},
                    {
                        function: slot(
                            block(
                                'logicalNot',
                                {},
                                {
                                    functionA: slot(
                                        block('buttonHeld', { button: 'a' }),
                                    ),
                                },
                            ),
                        ),
                        input: slot(
                            block('lightSet', { light: 'l1', action: 'on' }),
                        ),
                        input_else: slot(
                            block('lightSet', { light: 'l1', action: 'off' }),
                        ),
                    },
                ),
            ]),
        ).toBe('if not A.held():\n  L1.on()\nelse:\n  L1.off()')
    })

    test('and, or, compare', () => {
        expect(
            python([
                block(
                    'until',
                    {},
                    {
                        function: slot(
                            block(
                                'logicalCompare',
                                { operation: 'or' },
                                {
                                    functionA: slot(
                                        block('buttonPressed', { button: 'b' }),
                                    ),
                                    functionB: slot(
                                        block(
                                            'compareNumbers',
                                            { op: '==' },
                                            { a: num(1), b: num(2) },
                                        ),
                                    ),
                                },
                            ),
                        ),
                    },
                ),
            ]),
        ).toBe('wait_until(lambda: B.pressed() or 1 == 2)')
    })
})

describe('Variables', () => {
    const variables = [
        { kind: 'variable', name: 'count', value: '0' },
        { kind: 'variable', name: 'half', value: '0' },
    ]

    test('set, change, read, and arithmetic', () => {
        expect(
            python(
                [
                    stack(
                        block('varSet', { name: 'count' }, { value: num(0) }),
                        block(
                            'varChange',
                            { name: 'count' },
                            { value: num(1) },
                        ),
                        block(
                            'varSet',
                            { name: 'half' },
                            {
                                value: slot(
                                    block(
                                        'arithmetic',
                                        { op: '/' },
                                        {
                                            a: slot(
                                                block('varGet', {
                                                    name: 'count',
                                                }),
                                            ),
                                            b: num(2),
                                        },
                                    ),
                                ),
                            },
                        ),
                    ),
                ],
                variables,
            ),
        ).toBe('count = 0\ncount += 1\nhalf = count / 2')
    })
})

describe('number slots', () => {
    const speed = { kind: 'variable', name: 'speed', value: '40' }

    test('a variable in a power slot', () => {
        expect(
            python(
                [
                    block(
                        'motorSpin',
                        {
                            name: 'arm',
                            way: 'forward',
                            amount: 2,
                            unit: 'seconds',
                        },
                        {
                            power: slot(block('varGet', { name: 'speed' })),
                        },
                    ),
                ],
                [motor(), speed],
            ),
        ).toBe('arm.spin(power=speed, seconds=2)')
    })

    test('a sum in a time slot', () => {
        expect(
            python(
                [
                    block(
                        'wait',
                        {},
                        {
                            time: slot(
                                block(
                                    'arithmetic',
                                    { op: '*' },
                                    {
                                        a: slot(
                                            block('varGet', { name: 'speed' }),
                                        ),
                                        b: num(2),
                                    },
                                ),
                            ),
                        },
                    ),
                ],
                [speed],
            ),
        ).toBe('wait(seconds=speed * 2)')
    })

    test('every slot keeps its default number', () => {
        expect(python([block('wait')])).toBe('wait(seconds=1)')
        expect(python([block('lightFlash', { light: 'l1' })])).toBe(
            'L1.flash(seconds=0.2)',
        )
    })
})
