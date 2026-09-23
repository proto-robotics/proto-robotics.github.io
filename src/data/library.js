import { FieldDropdown, FieldImage, FieldNumber, FieldTextInput } from 'blockly'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import { helpIcon } from '../assets'

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
    ['clockwise ↻', '1'],
    ['counter-clockwise ↺', '-1'],
]

/**
 * Converts learner-entered names into valid Python identifiers.
 * @param {string} str Name entered in a Blockly text field.
 * @returns {string} Name with whitespace replaced by underscores.
 */
const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')

/**
 * Adds the shared cheatsheet-help control to each Blockly block definition.
 * @param {object[]} blocks Blockly category definitions to modify.
 * @returns {object[]} The same categories with help controls attached.
 */
const injectHelpButton = (blocks) => {
    blocks.forEach((category) => {
        category.entries.forEach((block) => {
            if (block.entryType && block.entryType !== 'block') {
                return
            }

            block.blocklyTemplate.push({
                field: () =>
                    new FieldImage(helpIcon, 15, 15, 'Info', () => {
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
                name: 'largemotor',
                description: 'Creates a DC motor.',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('largemotor'),
                        name: 'name',
                    },
                    {
                        text: 'is a large motor\non port',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
                    const port = block.getFieldValue('port')
                    const direction = block.getFieldValue('direction')
                    const directionSnippet =
                        direction === '1' ? '' : ', direction=-1'

                    return `${name} = make.largemotor(port=${port}${directionSnippet})\n`
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                        text: 'power\nfor',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                        text: 'power\nfor',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )

                    return `${name}.stop()\n`
                },
            },
            {
                entryType: 'example',
                name: 'Timed large motor',
                preamble:
                    'Runs a large motor forward, reverses it, then stops it.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'largemotor',
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
                        text: 'is a drivetrain\nfrom motors',
                    },
                    {
                        field: () => new FieldTextInput('leftmotor'),
                        name: 'left',
                    },
                    {
                        text: 'and',
                    },
                    {
                        field: () => new FieldTextInput('rightmotor'),
                        name: 'right',
                    },
                    {
                        text: 'with drift',
                    },
                    {
                        field: () =>
                            new FieldNumber(1, -Infinity, Infinity, 0.01),
                        name: 'drift',
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
                    const left = spacesToUnderscores(
                        block.getFieldValue('left'),
                    )
                    const right = spacesToUnderscores(
                        block.getFieldValue('right'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                        text: 'power\nfor',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                        text: 'power\nfor',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
                    const power = block.getFieldValue('power')
                    const time = block.getFieldValue('time')

                    return `${name}.turn(power=${power}, seconds=${time})\n`
                },
            },
            {
                entryType: 'block',
                name: 'curve',
                description:
                    'Runs the two sides of a drivetrain at different powers.',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                        text: 'power\nfor',
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )

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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )
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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )

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
                    const name = spacesToUnderscores(
                        block.getFieldValue('name'),
                    )

                    return [`${name}.held()`, generator.ORDER_NONE]
                },
            },
            {
                entryType: 'example',
                name: 'Read a button',
                preamble: 'Creates a button and waits until it is pressed.',
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
                description:
                    'Runs one set of blocks if true, otherwise another.',
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
                        text: '\nelse',
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
                name: 'logicalCompare',
                description: 'Combines two conditions using and/or.',
                blocklyTemplate: [
                    {
                        blocklyInput: {
                            name: 'functionA',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: '\n',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['and', 'and'],
                                ['or', 'or'],
                            ]),
                        name: 'operation',
                    },
                    {
                        blocklyInput: {
                            name: 'functionB',
                            type: 'Boolean',
                        },
                    },
                ],
                blocklyOutput: {
                    type: 'Boolean',
                    name: 'value',
                },
                inputsInline: true,
                codeGenerator: (block, generator) => {
                    const left =
                        generator.valueToCode(
                            block,
                            'functionA',
                            generator.ORDER_ATOMIC,
                        ) || 'False'
                    const right =
                        generator.valueToCode(
                            block,
                            'functionB',
                            generator.ORDER_ATOMIC,
                        ) || 'False'
                    const operation = block.getFieldValue('operation')

                    return [
                        `${left} ${operation} ${right}`,
                        generator.ORDER_NONE,
                    ]
                },
            },
            {
                entryType: 'block',
                name: 'logicalNot',
                description: 'Reverses a condition.',
                blocklyTemplate: [
                    {
                        text: 'not',
                    },
                    {
                        blocklyInput: {
                            name: 'functionA',
                            type: 'Boolean',
                        },
                    },
                ],
                blocklyOutput: {
                    type: 'Boolean',
                    name: 'value',
                },
                codeGenerator: (block, generator) => {
                    const condition =
                        generator.valueToCode(
                            block,
                            'functionA',
                            generator.ORDER_ATOMIC,
                        ) || 'False'

                    return [`not ${condition}`, generator.ORDER_NONE]
                },
            },
            {
                entryType: 'block',
                name: 'numberInput',
                description: 'Provides a number.',
                blocklyTemplate: [
                    {
                        field: () => new FieldNumber(0),
                        name: 'operation',
                    },
                ],
                blocklyOutput: {
                    type: 'Number',
                    name: 'value',
                },
                inputsInline: true,
                codeGenerator: (block, generator) => [
                    `${block.getFieldValue('operation')}`,
                    generator.ORDER_NONE,
                ],
            },
            {
                entryType: 'block',
                name: 'booleanInput',
                description: 'Provides true or false.',
                blocklyTemplate: [
                    {
                        field: () =>
                            new FieldDropdown([
                                ['true', 'True'],
                                ['false', 'False'],
                            ]),
                        name: 'operation',
                    },
                ],
                blocklyOutput: {
                    type: 'Boolean',
                    name: 'value',
                },
                inputsInline: true,
                codeGenerator: (block, generator) => [
                    `${block.getFieldValue('operation')}`,
                    generator.ORDER_ATOMIC,
                ],
            },
            {
                entryType: 'block',
                name: 'repeatFor',
                description: 'Repeats blocks a fixed number of times.',
                blocklyTemplate: [
                    {
                        text: 'Repeat',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Number',
                            shadow: 'numberInput',
                        },
                    },
                    {
                        text: 'times',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block, generator) => {
                    const count =
                        generator.valueToCode(
                            block,
                            'function',
                            generator.ORDER_ATOMIC,
                        ) || '0'
                    const input =
                        generator.statementToCode(block, 'input') || '\tpass\n'

                    return `for i in range(${count}):\n${input}`
                },
            },
            {
                entryType: 'block',
                name: 'repeatIf',
                description: 'Repeats blocks while or until a condition.',
                blocklyTemplate: [
                    {
                        text: 'Repeat',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['while', 'while'],
                                ['until', 'until'],
                            ]),
                        name: 'operation',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: 'do',
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
                    const prefix =
                        block.getFieldValue('operation') === 'until'
                            ? 'not '
                            : ''

                    return `while ${prefix}${condition}:\n${input}`
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
            {
                entryType: 'example',
                name: 'Run when both buttons are pressed',
                preamble:
                    'Combines two button conditions and runs a motor only when both are true.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'left_button',
                                    port: '10',
                                },
                                next: {
                                    block: {
                                        type: 'button',
                                        fields: {
                                            name: 'right_button',
                                            port: '11',
                                        },
                                        next: {
                                            block: {
                                                type: 'largemotor',
                                                fields: {
                                                    name: 'intake',
                                                    port: '2',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'if',
                                                        inputs: {
                                                            function: {
                                                                block: {
                                                                    type: 'logicalCompare',
                                                                    fields: {
                                                                        operation:
                                                                            'and',
                                                                    },
                                                                    inputs: {
                                                                        functionA:
                                                                            {
                                                                                block: {
                                                                                    type: 'isPressed',
                                                                                    fields: {
                                                                                        name: 'left_button',
                                                                                    },
                                                                                },
                                                                            },
                                                                        functionB:
                                                                            {
                                                                                block: {
                                                                                    type: 'isPressed',
                                                                                    fields: {
                                                                                        name: 'right_button',
                                                                                    },
                                                                                },
                                                                            },
                                                                    },
                                                                },
                                                            },
                                                            input: {
                                                                block: {
                                                                    type: 'spinForTime',
                                                                    fields: {
                                                                        name: 'intake',
                                                                        power: '70',
                                                                        time: '1',
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
                    },
                },
            },
            {
                entryType: 'example',
                name: 'Choose between actions',
                preamble:
                    'Uses if/else and not to choose a motor direction from a button state.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'reverse_button',
                                    port: '10',
                                },
                                next: {
                                    block: {
                                        type: 'largemotor',
                                        fields: {
                                            name: 'arm',
                                            port: '2',
                                        },
                                        next: {
                                            block: {
                                                type: 'ifElse',
                                                inputs: {
                                                    function: {
                                                        block: {
                                                            type: 'logicalNot',
                                                            inputs: {
                                                                functionA: {
                                                                    block: {
                                                                        type: 'isPressed',
                                                                        fields: {
                                                                            name: 'reverse_button',
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                    input: {
                                                        block: {
                                                            type: 'spinForTime',
                                                            fields: {
                                                                name: 'arm',
                                                                power: '60',
                                                                time: '1',
                                                            },
                                                        },
                                                    },
                                                    input_else: {
                                                        block: {
                                                            type: 'spinBackForTime',
                                                            fields: {
                                                                name: 'arm',
                                                                power: '60',
                                                                time: '1',
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
                    },
                },
            },
            {
                entryType: 'example',
                name: 'Repeat a task',
                preamble:
                    'Repeats a short motor movement a fixed number of times.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'largemotor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'indexer',
                                    port: '3',
                                },
                                next: {
                                    block: {
                                        type: 'repeatFor',
                                        inputs: {
                                            function: {
                                                shadow: {
                                                    type: 'numberInput',
                                                    fields: {
                                                        operation: '3',
                                                    },
                                                },
                                            },
                                            input: {
                                                block: {
                                                    type: 'spinForTime',
                                                    fields: {
                                                        name: 'indexer',
                                                        power: '50',
                                                        time: '0.5',
                                                    },
                                                    next: {
                                                        block: {
                                                            type: 'wait',
                                                            fields: {
                                                                time: '0.25',
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
                    },
                },
            },
            {
                entryType: 'example',
                name: 'Repeat until pressed',
                preamble:
                    'Runs a motor repeatedly until the stop button is pressed.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'stop_button',
                                    port: '10',
                                },
                                next: {
                                    block: {
                                        type: 'largemotor',
                                        fields: {
                                            name: 'conveyor',
                                            port: '2',
                                        },
                                        next: {
                                            block: {
                                                type: 'repeatIf',
                                                fields: {
                                                    operation: 'until',
                                                },
                                                inputs: {
                                                    function: {
                                                        block: {
                                                            type: 'isPressed',
                                                            fields: {
                                                                name: 'stop_button',
                                                            },
                                                        },
                                                    },
                                                    input: {
                                                        block: {
                                                            type: 'spinForTime',
                                                            fields: {
                                                                name: 'conveyor',
                                                                power: '40',
                                                                time: '0.25',
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
                    },
                },
            },
            {
                entryType: 'example',
                name: 'Repeat forever',
                preamble:
                    'Runs the same forward and backward motor sequence forever.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'largemotor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'sweeper',
                                    port: '2',
                                },
                                next: {
                                    block: {
                                        type: 'forever',
                                        inputs: {
                                            input: {
                                                block: {
                                                    type: 'spinForTime',
                                                    fields: {
                                                        name: 'sweeper',
                                                        power: '50',
                                                        time: '0.5',
                                                    },
                                                    next: {
                                                        block: {
                                                            type: 'spinBackForTime',
                                                            fields: {
                                                                name: 'sweeper',
                                                                power: '50',
                                                                time: '0.5',
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
                    },
                },
            },
        ],
    },
]

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

/**
 * Extracts blocks and examples for cheatsheet rendering.
 * @param {object[]} [sourceLibrary=library] Library categories to extract.
 * @returns {object[]} Cheatsheet-ready categories.
 */
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
