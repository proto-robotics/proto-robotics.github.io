import { FieldDropdown, FieldImage, FieldNumber, FieldTextInput } from 'blockly'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'

const simplePorts = [
    ['0', '0'],
    ['1', '1'],
    ['2', '2'],
    ['3', '3'],
    ['4', '4'],
    ['5', '5'],
    ['6', '6'],
    ['7', '7'],
]

const drivePorts = [
    ['0', '0'],
    ['1', '1'],
    ['2', '2'],
    ['3', '3'],
]

const buttonPorts = [
    ['10', '10'],
    ['11', '11'],
    ['12', '12'],
    ['13', '13'],
]

const directionOptions = [
    ['clockwise', '1'],
    ['counter-clockwise', '-1'],
]

const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')

const injectHelpButton = (blocks) => {
    blocks.forEach((category) => {
        category.entries.forEach((block) => {
            if (block.entryType && block.entryType !== 'block') {
                return
            }

            block.blocklyTemplate.push({
                field: () =>
                    new FieldImage('./images/help.svg', 15, 15, 'Info', () => {
                        document.dispatchEvent(
                            new CustomEvent(openCheatSheetDrawerEvent, {
                                detail: { blockName: block.name },
                            }),
                        )
                    }),
                name: 'info_icon',
            })
        })
    })

    return blocks
}

export const library = [
    {
        name: 'Motor',
        color: '#F2737B',
        entries: [
            {
                entryType: 'block',
                name: 'simple_motor',
                description: 'Creates a continuous servo motor.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('simple_motor'),
                        name: 'name',
                    },
                    {
                        text: 'is a simple motor on port',
                    },
                    {
                        field: () => new FieldDropdown(simplePorts),
                        name: 'port',
                    },
                    {
                        text: 'in direction',
                    },
                    {
                        field: () => new FieldDropdown(directionOptions),
                        name: 'direction',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const port = block.getFieldValue('port')
                    const direction = block.getFieldValue('direction')
                    const directionSnippet =
                        direction === '1' ? '' : ', direction=-1'

                    return `${name} = make.simple_motor(port=${port}${directionSnippet})\n`
                },
            },
            {
                entryType: 'block',
                name: 'largemotor',
                description: 'Creates a DC motor.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('largemotor'),
                        name: 'name',
                    },
                    {
                        text: 'is a large motor on port',
                    },
                    {
                        field: () => new FieldDropdown(drivePorts),
                        name: 'port',
                    },
                    {
                        text: 'in direction',
                    },
                    {
                        field: () => new FieldDropdown(directionOptions),
                        name: 'direction',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const port = block.getFieldValue('port')
                    const direction = block.getFieldValue('direction')
                    const directionSnippet =
                        direction === '1' ? '' : ', direction=-1'

                    return `${name} = make.largemotor(port=${port}${directionSnippet})\n`
                },
            },
            {
                entryType: 'block',
                name: 'servo',
                description: 'Creates a positional servo.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('servo'),
                        name: 'name',
                    },
                    {
                        text: 'is a servo on port',
                    },
                    {
                        field: () => new FieldDropdown(simplePorts),
                        name: 'port',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const port = block.getFieldValue('port')

                    return `${name} = make.servo(port=${port})\n`
                },
            },
            {
                entryType: 'block',
                name: 'spin',
                description: 'Spins a motor until stopped.',
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')

                    return `${name}.spin(power=${power})\n`
                },
            },
            {
                entryType: 'block',
                name: 'spinBack',
                description: 'Spins a motor backward until stopped.',
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'backward at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')

                    return `${name}.spin_back(power=${power})\n`
                },
            },
            {
                entryType: 'block',
                name: 'spinForTime',
                description: 'Spins a motor for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')
                    const time = block.getFieldValue('time')

                    return `${name}.spin(power=${power}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'spinBackForTime',
                description: 'Spins a motor backward for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'backward at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')
                    const time = block.getFieldValue('time')

                    return `${name}.spin_back(power=${power}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'stopMotor',
                description: 'Stops a motor.',
                blocklyTemplate: [
                    {
                        text: 'Stop',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))

                    return `${name}.stop()\n`
                },
            },
            {
                entryType: 'block',
                name: 'moveto',
                description: 'Moves a servo to an angle.',
                blocklyTemplate: [
                    {
                        text: 'Move',
                    },
                    {
                        field: () => new FieldTextInput('servo'),
                        name: 'name',
                    },
                    {
                        text: 'to',
                    },
                    {
                        field: () => new FieldNumber(0, 0, 180, 0.1),
                        name: 'angle',
                    },
                    {
                        text: 'degrees',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const angle = block.getFieldValue('angle')

                    return `${name}.moveto(angle=${angle})\n`
                },
            },
            {
                entryType: 'block',
                name: 'movetoForTime',
                description: 'Moves a servo to an angle and waits.',
                blocklyTemplate: [
                    {
                        text: 'Move',
                    },
                    {
                        field: () => new FieldTextInput('servo'),
                        name: 'name',
                    },
                    {
                        text: 'to',
                    },
                    {
                        field: () => new FieldNumber(0, 0, 180, 0.1),
                        name: 'angle',
                    },
                    {
                        text: 'degrees for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const angle = block.getFieldValue('angle')
                    const time = block.getFieldValue('time')

                    return `${name}.moveto(angle=${angle}, seconds=${time})\n`
                },
            },
            {
                entryType: 'example',
                name: 'Timed simple motor',
                preamble:
                    'Runs a simple motor forward, reverses it, then stops it.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'simple_motor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'arm_motor',
                                    port: '1',
                                },
                                next: {
                                    block: {
                                        type: 'spinForTime',
                                        fields: {
                                            name: 'arm_motor',
                                            power: '75',
                                            time: '2',
                                        },
                                        next: {
                                            block: {
                                                type: 'spinBackForTime',
                                                fields: {
                                                    name: 'arm_motor',
                                                    power: '40',
                                                    time: '1',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'stopMotor',
                                                        fields: {
                                                            name: 'arm_motor',
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                entryType: 'example',
                name: 'Servo sweep',
                preamble:
                    'Creates a servo, moves it to the middle, waits briefly, then returns it to the start.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'servo',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'servo_sam',
                                    port: '1',
                                },
                                next: {
                                    block: {
                                        type: 'movetoForTime',
                                        fields: {
                                            name: 'servo_sam',
                                            angle: '90',
                                            time: '1',
                                        },
                                        next: {
                                            block: {
                                                type: 'moveto',
                                                fields: {
                                                    name: 'servo_sam',
                                                    angle: '0',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        ],
    },
    {
        name: 'Drivetrain',
        color: '#00B8AA',
        entries: [
            {
                entryType: 'block',
                name: 'drivetrain',
                description: 'Creates a drivetrain from two motors.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'is a drivetrain from motors',
                    },
                    {
                        field: () => new FieldTextInput('left_motor'),
                        name: 'left',
                    },
                    {
                        text: 'and',
                    },
                    {
                        field: () => new FieldTextInput('right_motor'),
                        name: 'right',
                    },
                    {
                        text: 'with drift',
                    },
                    {
                        field: () => new FieldNumber(1, -Infinity, Infinity, 0.01),
                        name: 'drift',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const left = spacesToUnderscores(block.getFieldValue('left'))
                    const right = spacesToUnderscores(block.getFieldValue('right'))
                    const drift = block.getFieldValue('drift')
                    const driftSnippet = drift === '1' ? '' : `, drift=${drift}`

                    return `${name} = make.drivetrain(${left}, ${right}${driftSnippet})\n`
                },
            },
            {
                entryType: 'block',
                name: 'drive',
                description: 'Drives a drivetrain until stopped.',
                blocklyTemplate: [
                    {
                        text: 'Drive',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')

                    return `${name}.drive(power=${power})\n`
                },
            },
            {
                entryType: 'block',
                name: 'driveForTime',
                description: 'Drives a drivetrain for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Drive',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')
                    const time = block.getFieldValue('time')

                    return `${name}.drive(power=${power}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'turn',
                description: 'Turns a drivetrain until stopped.',
                blocklyTemplate: [
                    {
                        text: 'Turn',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')

                    return `${name}.turn(power=${power})\n`
                },
            },
            {
                entryType: 'block',
                name: 'turnForTime',
                description: 'Turns a drivetrain for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Turn',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'at',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'power',
                    },
                    {
                        text: 'power for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const power = block.getFieldValue('power')
                    const time = block.getFieldValue('time')

                    return `${name}.turn(power=${power}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'curve',
                description: 'Runs the two sides of a drivetrain at different powers.',
                blocklyTemplate: [
                    {
                        text: 'Curve',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'with left',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'left',
                    },
                    {
                        text: 'and right',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'right',
                    },
                    {
                        text: 'power',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const left = block.getFieldValue('left')
                    const right = block.getFieldValue('right')

                    return `${name}.curve(left_power=${left}, right_power=${right})\n`
                },
            },
            {
                entryType: 'block',
                name: 'curveForTime',
                description: 'Curves a drivetrain for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Curve',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'with left',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'left',
                    },
                    {
                        text: 'and right',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'right',
                    },
                    {
                        text: 'power for',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const left = block.getFieldValue('left')
                    const right = block.getFieldValue('right')
                    const time = block.getFieldValue('time')

                    return `${name}.curve(left_power=${left}, right_power=${right}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'stopDrivetrain',
                description: 'Stops a drivetrain.',
                blocklyTemplate: [
                    {
                        text: 'Stop',
                    },
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))

                    return `${name}.stop()\n`
                },
            },
            {
                entryType: 'example',
                name: 'Straight drive',
                preamble:
                    'Creates two large motors, combines them into a drivetrain, then drives forward briefly.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'largemotor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'left_motor',
                                    port: '0',
                                },
                                next: {
                                    block: {
                                        type: 'largemotor',
                                        fields: {
                                            name: 'right_motor',
                                            port: '1',
                                            direction: '-1',
                                        },
                                        next: {
                                            block: {
                                                type: 'drivetrain',
                                                fields: {
                                                    name: 'drivebase',
                                                    left: 'left_motor',
                                                    right: 'right_motor',
                                                    drift: '1',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'driveForTime',
                                                        fields: {
                                                            name: 'drivebase',
                                                            power: '60',
                                                            time: '2',
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        ],
    },
    {
        name: 'Input',
        color: '#6395CF',
        entries: [
            {
                entryType: 'block',
                name: 'button',
                description: 'Creates a button.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('button'),
                        name: 'name',
                    },
                    {
                        text: 'is a button on port',
                    },
                    {
                        field: () => new FieldDropdown(buttonPorts),
                        name: 'port',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))
                    const port = block.getFieldValue('port')

                    return `${name} = make.button(port=${port})\n`
                },
            },
            {
                entryType: 'block',
                name: 'isPressed',
                description: 'Returns whether a button is pressed.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('button'),
                        name: 'name',
                    },
                    {
                        text: 'is pressed?',
                    },
                ],
                blocklyOutput: {
                    type: 'Boolean',
                    name: 'value',
                },
                codeGenerator: (block, generator) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))

                    return [`${name}.pressed()`, generator.ORDER_NONE]
                },
            },
            {
                entryType: 'block',
                name: 'isHeld',
                description: 'Returns whether a button is held down.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('button'),
                        name: 'name',
                    },
                    {
                        text: 'is held down?',
                    },
                ],
                blocklyOutput: {
                    type: 'Boolean',
                    name: 'value',
                },
                codeGenerator: (block, generator) => {
                    const name = spacesToUnderscores(block.getFieldValue('name'))

                    return [`${name}.held()`, generator.ORDER_NONE]
                },
            },
            {
                entryType: 'example',
                name: 'Read a button',
                preamble:
                    'Creates a button and waits until it is pressed.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'start_button',
                                    port: '10',
                                },
                                next: {
                                    block: {
                                        type: 'until',
                                        inputs: {
                                            function: {
                                                block: {
                                                    type: 'isPressed',
                                                    fields: {
                                                        name: 'start_button',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        ],
    },
    {
        name: 'Time',
        color: '#9970B1',
        entries: [
            {
                entryType: 'block',
                name: 'wait',
                description: 'Waits for a number of seconds.',
                blocklyTemplate: [
                    {
                        text: 'Wait',
                    },
                    {
                        field: () => new FieldNumber(0, 0, Infinity, 0.01),
                        name: 'time',
                    },
                    {
                        text: 'seconds',
                    },
                ],
                codeGenerator: (block) => {
                    const time = block.getFieldValue('time')

                    return `make.wait(seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'until',
                description: 'Waits until a condition is true.',
                blocklyTemplate: [
                    {
                        text: 'Wait until',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const condition = generator.valueToCode(
                        block,
                        'function',
                        generator.ORDER_ATOMIC,
                    )

                    if (!condition) {
                        return 'make.wait_until(lambda: False)\n'
                    }

                    return `make.wait_until(lambda: ${condition})\n`
                },
            },
            {
                entryType: 'block',
                name: 'while',
                description: 'Waits while a condition is true.',
                blocklyTemplate: [
                    {
                        text: 'Wait while',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const condition = generator.valueToCode(
                        block,
                        'function',
                        generator.ORDER_ATOMIC,
                    )

                    if (!condition) {
                        return 'make.wait_while(lambda: False)\n'
                    }

                    return `make.wait_while(lambda: ${condition})\n`
                },
            },
        ],
    },
    {
        name: 'Flow',
        color: '#F8BF41',
        entries: [
            {
                entryType: 'block',
                name: 'if',
                description: 'Runs blocks if a condition is true.',
                blocklyTemplate: [
                    {
                        text: 'If',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: 'then',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const condition =
                        generator.valueToCode(
                            block,
                            'function',
                            generator.ORDER_ATOMIC,
                        ) || 'False'
                    const input =
                        generator.statementToCode(block, 'input') || '\tpass\n'

                    return `if ${condition}:\n${input}`
                },
            },
            {
                entryType: 'block',
                name: 'ifElse',
                description: 'Runs one set of blocks if true, otherwise another.',
                blocklyTemplate: [
                    {
                        text: 'If',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: 'then',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                    {
                        text: 'else',
                    },
                    {
                        blocklyInput: {
                            name: 'input_else',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const condition =
                        generator.valueToCode(
                            block,
                            'function',
                            generator.ORDER_ATOMIC,
                        ) || 'False'
                    const input =
                        generator.statementToCode(block, 'input') || '\tpass\n'
                    const inputElse =
                        generator.statementToCode(block, 'input_else') ||
                        '\tpass\n'

                    return `if ${condition}:\n${input}else:\n${inputElse}`
                },
            },
            {
                entryType: 'block',
                name: 'forever',
                description: 'Repeats blocks forever.',
                blocklyTemplate: [
                    {
                        text: 'Forever',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const input =
                        generator.statementToCode(block, 'input') || '\tpass\n'

                    return `while True:\n${input}`
                },
            },
        ],
    },
]

export function extractJengaBlocks(sourceLibrary = library) {
    const categories = Array.isArray(sourceLibrary)
        ? sourceLibrary
        : [sourceLibrary]

    const jengaBlocks = categories.map((category) => {
        const blockEntries = category.entries
            .filter((entry) => entry.entryType === 'block')
            .map(({ entryType, ...blockEntry }) => ({
                ...blockEntry,
                blocklyTemplate: [...blockEntry.blocklyTemplate],
            }))

        return {
            name: category.name,
            color: category.color,
            entries: blockEntries,
        }
    })

    return injectHelpButton(jengaBlocks)
}

export function extractCheatSheetBlocks(sourceLibrary = library) {
    const categories = Array.isArray(sourceLibrary)
        ? sourceLibrary
        : [sourceLibrary]

    const cheatSheetCategories = categories.map((category) => ({
        name: category.name,
        color: category.color,
        entries: category.entries
            .filter((entry) => entry.entryType === 'block')
            .map(({ entryType, ...blockEntry }) => ({
                ...blockEntry,
                blocklyTemplate: [...blockEntry.blocklyTemplate],
            })),
        examples: category.entries
            .filter((entry) => entry.entryType === 'example')
            .map(({ entryType, ...exampleEntry }) => exampleEntry),
    }))

    return injectHelpButton(cheatSheetCategories)
}

export const jengaBlocks = extractJengaBlocks(library)
export const cheatSheetBlocks = extractCheatSheetBlocks(library)
