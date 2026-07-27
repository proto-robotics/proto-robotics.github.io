import {
    FieldDropdown,
    FieldNumber,
    FieldTextInput,
    FieldCheckbox,
    FieldImage,
} from 'blockly'
import { FieldColourHsvSliders } from '@blockly/field-colour-hsv-sliders'
import { pythonGenerator, Order } from 'blockly/python'
import { FieldGridDropdown } from '@blockly/field-grid-dropdown'
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

/**
 * Adds the shared cheatsheet-help control to each Blockly block definition.
 * @param {object[]} blocks Blockly category definitions to modify.
 * @returns {object[]} The same categories with help controls attached.
 */
const injectHelpButton = (blocks) => {
    blocks.forEach((category) => {
        category.entries.forEach((block) => {
            const field = {
                field: () =>
                    new FieldImage('./assets/images/help.svg', 15, 15, 'Info', () => {
                        document.dispatchEvent(
                            new CustomEvent(openCheatSheetDrawerEvent, {
                                detail: { blockName: block.name },
                            }),
                        )
                    }),
                name: 'info_icon',
            }
            block.blocklyTemplate.push(field)
        })
    })

    return blocks
}

export const library = [
    {
        name: 'Motor',
        color: '#F2737B',
        codeAutoComplete: {
            'make.smallmotor': {
                type: 'function',
                description: 'Creates a small motor on a port.',
            },
            'make.servo': {
                type: 'function',
                description: 'Creates a servo on a port.',
            },
            'make.largemotor': {
                type: 'function',
                description: 'Creates a large motor on a drivetrain port.',
            },
        },
        entries: [
            {
                name: 'smallmotor',
                description: 'Creates a smallmotor',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('smallmotor'),
                        name: 'name',
                    },
                    {
                        text: 'is a smallmotor \non port',
                    },
                    {
                        field: () => new FieldDropdown(simplePorts),
                        name: 'port',
                    },
                    {
                        text: 'in direction',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['clockwise ↻', '1'],
                                ['counter-clockwise ↺', '-1'],
                            ]),
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
                        direction == 1 ? '' : ', direction=-1'
                    const code = `${name} = make.smallmotor(port=${port}${directionSnippet})\n`
                    return code
                },
            },
            {
                name: 'servo',
                description: 'Creates a servo',
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const dropdown_port = block.getFieldValue('port')

                    const code = `${text_name} = make.servo(port=${dropdown_port})\n`
                    return code
                },
            },
            {
                name: 'largemotor',
                description: 'Creates a largemotor',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('largemotor'),
                        name: 'name',
                    },
                    {
                        text: 'is a largemotor \non port',
                    },
                    {
                        field: () => new FieldDropdown(drivePorts),
                        name: 'port',
                    },
                    {
                        text: 'in direction',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['clockwise ↻', '1'],
                                ['counter-clockwise ↺', '-1'],
                            ]),
                        name: 'direction',
                    },
                ],
                codeGenerator: (block) => {
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const dropdown_port = block.getFieldValue('port')
                    const dropdown_direction = block.getFieldValue('direction')

                    const directionSnippet =
                        dropdown_direction == 1 ? '' : ', direction=-1'
                    const code = `${text_name} = make.largemotor(port=${dropdown_port}${directionSnippet})\n`
                    return code
                },
            },
            {
                name: 'spin',
                description: 'Spins a motor at a power until stopped',
                codeAutoComplete: [
                    {
                        label: 'motor.spin',
                        type: 'method',
                        description:
                            'Spins a motor at a power until it is stopped.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')

                    const code = `${text_name}.spin(power=${number_power})\n`
                    return code
                },
            },
            {
                name: 'spinBack',
                description: 'Spins a motor backwards at a power until stopped',
                codeAutoComplete: [
                    {
                        label: 'motor.spin_back',
                        type: 'method',
                        description:
                            'Spins a motor backwards at a power until it is stopped.',
                    },
                ],
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'backwards at',
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')

                    const code = `${text_name}.spin_back(power=${number_power})\n`
                    return code
                },
            },
            {
                name: 'moveto',
                description: 'Moves a servo to an angle',
                codeAutoComplete: [
                    {
                        label: 'servo.moveto',
                        type: 'method',
                        description: 'Moves a servo to an angle.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_angle = block.getFieldValue('angle')

                    const code = `${text_name}.moveto(angle=${number_angle})\n`
                    return code
                },
            },
            {
                name: 'spinForTime',
                description: 'Spins a motor at a power for a time',
                codeAutoComplete: [
                    {
                        label: 'motor.spin',
                        type: 'method',
                        description:
                            'Spins a motor at a power for a number of seconds.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.spin(power=${number_power}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'spinBackForTime',
                description: 'Spins a motor backwards at a power for a time',
                codeAutoComplete: [
                    {
                        label: 'motor.spin_back',
                        type: 'method',
                        description:
                            'Spins a motor backwards at a power for a number of seconds.',
                    },
                ],
                blocklyTemplate: [
                    {
                        text: 'Spin',
                    },
                    {
                        field: () => new FieldTextInput('motor'),
                        name: 'name',
                    },
                    {
                        text: 'backwards at',
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.spin_back(power=${number_power}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'movetoForTime',
                description: 'Moves a servo to an angle and waits for a time',
                codeAutoComplete: [
                    {
                        label: 'servo.moveto',
                        type: 'method',
                        description:
                            'Moves a servo to an angle and waits for a number of seconds.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_angle = block.getFieldValue('angle')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.moveto(angle=${number_angle}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'stopMotor',
                description: 'Stops a motor or drivetrain',
                codeAutoComplete: [
                    {
                        label: 'motor.stop',
                        type: 'method',
                        description: 'Stops a motor or drivetrain.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const code = `${text_name}.stop()\n`
                    return code
                },
            },
        ],
        examples: [
            {
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
                                                type: 'wait',
                                                fields: {
                                                    time: '0.5',
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
                                },
                            },
                        ],
                    },
                },
            },
            {
                name: 'Timed small motor',
                preamble:
                    'Runs a small motor forward, reverses it at a lower power, then stops it.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'smallmotor',
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
                name: 'Large motor launcher',
                preamble:
                    'Creates a large motor, spins it up, waits, and stops it.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'largemotor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'launcher',
                                    port: '2',
                                },
                                next: {
                                    block: {
                                        type: 'spin',
                                        fields: {
                                            name: 'launcher',
                                            power: '100',
                                        },
                                        next: {
                                            block: {
                                                type: 'wait',
                                                fields: {
                                                    time: '3',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'stopMotor',
                                                        fields: {
                                                            name: 'launcher',
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
        codeAutoComplete: {
            'make.drivetrain': {
                type: 'function',
                description: 'Creates a drivetrain from left and right motors.',
            },
        },
        entries: [
            {
                name: 'drivetrain',
                description: 'Creates a drivetrain from two motors',
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput('drivetrain'),
                        name: 'name',
                    },
                    {
                        text: 'is a drivetrain \nfrom motors',
                    },
                    {
                        field: () => new FieldTextInput('left'),
                        name: 'left',
                    },
                    {
                        text: 'and',
                    },
                    {
                        field: () => new FieldTextInput('right'),
                        name: 'right',
                    },
                    {
                        text: 'in direction',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['clockwise ↻', '1'],
                                ['counter-clockwise ↺', '-1'],
                            ]),
                        name: 'direction',
                    },
                ],
                codeGenerator: (block) => {
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const text_left = block
                        .getFieldValue('left')
                        .replace(' ', '_')
                    const text_right = block
                        .getFieldValue('right')
                        .replace(' ', '_')
                    const dropdown_direction = block.getFieldValue('direction')

                    const directionSnippet =
                        dropdown_direction == 1 ? '' : ', direction=-1'
                    const code = `${text_name} = make.drivetrain(${text_left}, ${text_right}${directionSnippet})\n`
                    return code
                },
            },
            {
                name: 'drive',
                description: 'Drives a drivetrain at a power until stopped',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.drive',
                        type: 'method',
                        description:
                            'Drives forward or backward until stopped.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')

                    const code = `${text_name}.drive(power=${number_power})\n`
                    return code
                },
            },
            {
                name: 'driveForTime',
                description: 'Drives a drivetrain at a power for a time',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.drive',
                        type: 'method',
                        description:
                            'Drives forward or backward for a number of seconds.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.drive(power=${number_power}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'curve',
                description:
                    'Curves a drivetrain at two different powers until stopped',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.curve',
                        type: 'method',
                        description:
                            'Runs the left and right sides of a drivetrain at different powers.',
                    },
                ],
                blocklyTemplate: [
                    {
                        text: 'Curve',
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
                        name: 'left',
                    },
                    {
                        text: 'left power and',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'right',
                    },
                    {
                        text: 'right power',
                    },
                ],
                codeGenerator: (block) => {
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_left = block.getFieldValue('left')
                    const number_right = block.getFieldValue('right')

                    const code = `${text_name}.curve(left_power=${number_left}, right_power=${number_right})\n`
                    return code
                },
            },
            {
                name: 'curveForTime',
                description:
                    'Curves a drivetrain at two different powers for a time',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.curve',
                        type: 'method',
                        description: 'Curves for a number of seconds.',
                    },
                ],
                blocklyTemplate: [
                    {
                        text: 'Curve',
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
                        name: 'left',
                    },
                    {
                        text: 'left power and',
                    },
                    {
                        field: () => new FieldNumber(100, -100, 100, 0.1),
                        name: 'right',
                    },
                    {
                        text: 'right power \nfor',
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_left = block.getFieldValue('left')
                    const number_right = block.getFieldValue('right')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.curve(left_power=${number_left}, right_power=${number_right}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'turn',
                description: 'Turn a drivetrain at a power until stopped',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.turn',
                        type: 'method',
                        description: 'Turns a drivetrain until stopped.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')

                    const code = `${text_name}.turn(power=${number_power})\n`
                    return code
                },
            },
            {
                name: 'turnForTime',
                description: 'Turn a drivetrain at a power until stopped',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.turn',
                        type: 'method',
                        description:
                            'Turns a drivetrain for a number of seconds.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')
                    const number_power = block.getFieldValue('power')
                    const number_time = block.getFieldValue('time')

                    const code = `${text_name}.turn(power=${number_power}, seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'stopDrivetrain',
                description: 'Stops a motor or drivetrain',
                codeAutoComplete: [
                    {
                        label: 'drivetrain.stop',
                        type: 'method',
                        description: 'Stops a drivetrain.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const code = `${text_name}.stop()\n`
                    return code
                },
            },
        ],
        examples: [
            {
                name: 'Straight drive',
                preamble:
                    'Creates two motors, combines them into a drivetrain, then drives forward briefly.',
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
            {
                name: 'Curve and turn',
                preamble:
                    'Curves by running each side at a different power, then turns in place.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'drivetrain',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'drivebase',
                                    left: 'left_motor',
                                    right: 'right_motor',
                                },
                                next: {
                                    block: {
                                        type: 'curveForTime',
                                        fields: {
                                            name: 'drivebase',
                                            left: '50',
                                            right: '100',
                                            time: '1.5',
                                        },
                                        next: {
                                            block: {
                                                type: 'turnForTime',
                                                fields: {
                                                    name: 'drivebase',
                                                    power: '45',
                                                    time: '0.75',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'stopDrivetrain',
                                                        fields: {
                                                            name: 'drivebase',
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
        name: 'Sensors',
        color: '#6395CF',
        codeAutoComplete: {
            'make.button': {
                type: 'function',
                description: 'Creates a button sensor on a port.',
            },
        },
        entries: [
            {
                name: 'button',
                description: 'Creates a button',
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const dropdown_port = block.getFieldValue('port')

                    const code = `${text_name} = make.button(port=${dropdown_port})\n`
                    return code
                },
            },
            {
                name: 'isPressed',
                description: 'Returns whether or not the button is pressed',
                codeAutoComplete: [
                    {
                        label: 'button.pressed',
                        type: 'method',
                        description:
                            'Returns whether a button is currently pressed.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const code = `${text_name}.pressed()`
                    return [code, generator.ORDER_NONE]
                },
            },
            {
                name: 'isHeld',
                description: 'Returns whether or not the button is held down',
                codeAutoComplete: [
                    {
                        label: 'button.held',
                        type: 'method',
                        description: 'Returns whether a button has been held.',
                    },
                ],
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
                    const text_name = block
                        .getFieldValue('name')
                        .replace(' ', '_')

                    const code = `${text_name}.held()`
                    return [code, generator.ORDER_NONE]
                },
            },
        ],
        examples: [
            {
                name: 'Read a button',
                preamble:
                    'Creates a button on a digital port and checks whether it is pressed.',
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
            {
                name: 'Hold to run',
                preamble:
                    'Runs a motor only while a button is being held down.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'run_button',
                                    port: '11',
                                },
                                next: {
                                    block: {
                                        type: 'smallmotor',
                                        fields: {
                                            name: 'intake',
                                            port: '2',
                                        },
                                        next: {
                                            block: {
                                                type: 'ifElse',
                                                inputs: {
                                                    function: {
                                                        block: {
                                                            type: 'isHeld',
                                                            fields: {
                                                                name: 'run_button',
                                                            },
                                                        },
                                                    },
                                                    input: {
                                                        block: {
                                                            type: 'spin',
                                                            fields: {
                                                                name: 'intake',
                                                                power: '80',
                                                            },
                                                        },
                                                    },
                                                    input_else: {
                                                        block: {
                                                            type: 'stopMotor',
                                                            fields: {
                                                                name: 'intake',
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
    {
        name: 'Time',
        color: '#9970B1',
        codeAutoComplete: [
            {
                label: 'make.wait',
                type: 'function',
                description: 'Waits for a number of seconds.',
            },
            {
                label: 'make.wait_until',
                type: 'function',
                description: 'Waits until a condition becomes true.',
            },
            {
                label: 'make.wait_while',
                type: 'function',
                description: 'Waits while a condition stays true.',
            },
        ],
        entries: [
            {
                name: 'wait',
                description: 'Waits for a number of seconds',
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
                    const number_time = block.getFieldValue('time')

                    const code = `make.wait(seconds=${number_time})\n`
                    return code
                },
            },
            {
                name: 'until',
                description: 'Waits until a action returns true',
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
                    const value_function = generator.valueToCode(
                        block,
                        'function',
                        generator.ORDER_ATOMIC,
                    )

                    const len = value_function.length
                    let functionText

                    if (len < 4) {
                        functionText = '()'
                    } else if (
                        value_function[len - 3] == '(' &&
                        value_function[len - 2] == ')'
                    ) {
                        functionText = value_function.replace('()', '')
                    } else {
                        functionText = `(lambda: ${value_function})`
                    }

                    const code = `make.wait_until${functionText}\n`
                    return code
                },
            },
            {
                name: 'while',
                description: 'Waits while a action returns true',
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
                    const value_function = generator.valueToCode(
                        block,
                        'function',
                        generator.ORDER_ATOMIC,
                    )

                    const len = value_function.length
                    let functionText

                    if (len < 4) {
                        functionText = '()'
                    } else if (
                        value_function[len - 3] == '(' &&
                        value_function[len - 2] == ')'
                    ) {
                        functionText = value_function.replace('()', '')
                    } else {
                        functionText = `(lambda: ${value_function})`
                    }

                    const code = `make.wait_while${functionText}\n`
                    return code
                },
            },
        ],
        examples: [
            {
                name: 'Pause between actions',
                preamble:
                    'Waits between motor commands so each action has time to finish.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'smallmotor',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'lift',
                                    port: '3',
                                },
                                next: {
                                    block: {
                                        type: 'spin',
                                        fields: {
                                            name: 'lift',
                                            power: '50',
                                        },
                                        next: {
                                            block: {
                                                type: 'wait',
                                                fields: {
                                                    time: '1.5',
                                                },
                                                next: {
                                                    block: {
                                                        type: 'stopMotor',
                                                        fields: {
                                                            name: 'lift',
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
                name: 'Wait for a button',
                preamble:
                    'Pauses the program until a button is pressed, then starts driving.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'go_button',
                                    port: '12',
                                },
                                next: {
                                    block: {
                                        type: 'until',
                                        inputs: {
                                            function: {
                                                block: {
                                                    type: 'isPressed',
                                                    fields: {
                                                        name: 'go_button',
                                                    },
                                                },
                                            },
                                        },
                                        next: {
                                            block: {
                                                type: 'drive',
                                                fields: {
                                                    name: 'drivebase',
                                                    power: '50',
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
                name: 'Wait while held',
                preamble:
                    'Keeps waiting while a button is held, then continues when it is released.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'pause_button',
                                    port: '13',
                                },
                                next: {
                                    block: {
                                        type: 'while',
                                        inputs: {
                                            function: {
                                                block: {
                                                    type: 'isHeld',
                                                    fields: {
                                                        name: 'pause_button',
                                                    },
                                                },
                                            },
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
                        ],
                    },
                },
            },
        ],
    },
    {
        name: 'Flow',
        color: '#F8BF41',
        codeAutoComplete: [
            {
                label: 'if',
                type: 'keyword',
                description: 'Starts a conditional block.',
            },
            {
                label: 'while',
                type: 'keyword',
                description: 'Repeats code while a condition is true.',
            },
            {
                label: 'for',
                type: 'keyword',
                description: 'Repeats code for a fixed range.',
            },
            {
                label: 'range',
                type: 'function',
                description: 'Creates a range of numbers.',
            },
        ],
        entries: [
            // {
            // 	name: "section",
            // 	description: "Returns whether or not the button is pressed.",
            // 	blocklyTemplate: [
            //         {
            //             field: () => new FieldCheckbox('FALSE', function(newValue) {
            //                 if(this.sourceBlock_){
            //                     this.sourceBlock_.updateShape_(null, newValue)
            //                 }
            //             }),
            //             name: 'collapsed',
            //         },
            //         {
            //             field: () => new FieldTextInput('Section'),
            //             name: 'section_name',
            //         },
            //         {
            //             field: () => new FieldColourHsvSliders('#ff0000', function(newValue) {
            //                 if(this.sourceBlock_){
            //                     this.sourceBlock_.updateShape_(newValue, null)
            //                 }
            //             }),
            //             name: 'color',
            //         },
            //         {
            //             blocklyInput: {
            //                 name: 'input',
            //                 type: 'Void',
            //             },
            //         },
            // 	],
            // 	save: function() {
            // 		return {
            // 			'collapsed': this.collapsed,
            // 			'color': this.color,
            // 		};
            // 	},
            // 	load: function(state) {
            // 		var color = state['color'];
            // 		var collapsed = state['collapsed'];
            // 		this.updateShape_(color, collapsed);
            // 	},
            // 	update: function(color, collapsed) {
            // 		if(color != null) {
            // 			this.setColour(color == null ? "#ff0000" : color);
            // 		}
            // 		if (collapsed != null) {
            // 			this.getInput("input").setVisible(collapsed === "FALSE")
            // 			this.render()
            // 		}
            // 	},
            // 	codeGenerator: (block) => {
            // 		function dropOneTab(str) {
            // 			return str
            // 				.split('\n')
            // 				.map(line => {
            // 				return line.slice(2);
            // 				})
            // 			.join('\n');
            // 		}
            // 		var raw = pythonGenerator.statementToCode(block, 'input');
            // 		var cleaned = dropOneTab(raw);
            // 		const code = `${cleaned}`;
            // 		return code;
            // 	}
            // },
            {
                name: 'if',
                description: 'if statement help.',
                blocklyTemplate: [
                    {
                        text: 'if      ',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: 'do:',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block) => {
                    var value_function = pythonGenerator.valueToCode(
                        block,
                        'function',
                        Order.ATOMIC,
                    )
                    let len = value_function.length
                    if (len == 0) value_function = 'False'
                    else {
                        value_function = value_function.replace('(', '')
                        value_function = value_function.slice(0, -1)
                    }
                    var input = pythonGenerator.statementToCode(block, 'input')
                    if (input.length == 0) {
                        input = '\tpass'
                    }

                    const code = `if ${value_function}:\n${input}\n`
                    return code
                },
            },
            {
                name: 'ifElse',
                description: 'if_else statement help.',
                codeAutoComplete: [
                    {
                        label: 'else',
                        type: 'keyword',
                        description: 'Adds an alternate branch to an if block.',
                    },
                ],
                blocklyTemplate: [
                    {
                        text: 'if      ',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        text: 'do:',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                    {
                        text: '\nelse:',
                    },
                    {
                        blocklyInput: {
                            name: 'input_else',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block) => {
                    var value_function = pythonGenerator.valueToCode(
                        block,
                        'function',
                        Order.ATOMIC,
                    )
                    let len = value_function.length
                    if (len == 0) value_function = 'False'
                    else {
                        value_function = value_function.replace('(', '')
                        value_function = value_function.slice(0, -1)
                    }
                    var input = pythonGenerator.statementToCode(block, 'input')
                    if (input.length == 0) {
                        input = '\tpass'
                    }

                    const code = `if ${value_function}:\n${input}\nelse:\n${pythonGenerator.statementToCode(block, 'input_else') || '\tpass'}\n`
                    return code
                },
            },
            // {
            // 	name: "BetterCompare",
            // 	description: "Returns whether or not the button is pressed.",
            // 	blocklyTemplate: [
            //         {
            //             blocklyInput: {
            //                 name: 'functionA',
            //                 type: 'Any',
            //             },
            //         },
            //         {
            //             text: '\n',
            //         },
            //         {
            //             field: () => new FieldGridDropdown([['=', '=='],['>', '>'],['<', '<'],['≠', '!='],['≥', '>='],['≤', '<=']]),
            //             name: 'operation',
            //         },
            //         {
            //             blocklyInput: {
            //                 name: 'functionB',
            //                 type: 'Any',
            //             },
            //         },
            // 	],
            //     blocklyOutput: {
            //         type: 'Boolean',
            //         name: 'value',
            //     },
            //     inputsInline: true,
            // 	codeGenerator: (block) => {
            // 		const operation = spacesToUnderscores(block.getFieldValue('operation'));
            // 		var value_functionA_code = pythonGenerator.valueToCode(block, 'functionA', Order.ATOMIC);
            // 		var value_functionB_code = pythonGenerator.valueToCode(block, 'functionB', Order.ATOMIC);
            // 		if (value_functionA_code.length == 0) {
            // 			value_functionA_code = '0';
            // 		}
            // 		if (value_functionB_code.length == 0) {
            // 			value_functionB_code = '0';
            // 		}
            // 		let code = `${value_functionA_code} ${operation} ${value_functionB_code}`
            // 		return [code, Order.NONE];
            // 	}
            // },
            {
                name: 'logicalCompare',
                description: 'Returns whether or not the button is pressed.',
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
                            new FieldGridDropdown([
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
                codeGenerator: (block) => {
                    const operation = spacesToUnderscores(
                        block.getFieldValue('operation'),
                    )
                    var value_functionA_code = pythonGenerator.valueToCode(
                        block,
                        'functionA',
                        Order.ATOMIC,
                    )
                    var value_functionB_code = pythonGenerator.valueToCode(
                        block,
                        'functionB',
                        Order.ATOMIC,
                    )
                    if (value_functionA_code.length == 0) {
                        value_functionA_code = '0'
                    }
                    if (value_functionB_code.length == 0) {
                        value_functionB_code = '0'
                    }
                    let code = `${value_functionA_code} ${operation} ${value_functionB_code}`
                    return [code, Order.NONE]
                },
            },
            {
                name: 'logicalNot',
                description: 'Returns whether or not the button is pressed.',
                codeAutoComplete: [
                    {
                        label: 'not',
                        type: 'keyword',
                        description: 'Reverses a boolean condition.',
                    },
                ],
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
                // inputsInline: false,
                codeGenerator: (block) => {
                    var value_functionA_code = pythonGenerator.valueToCode(
                        block,
                        'functionA',
                        Order.ATOMIC,
                    )
                    if (value_functionA_code.length == 0) {
                        value_functionA_code = '0'
                    }
                    let code = `not ${value_functionA_code}`
                    return [code, Order.NONE]
                },
            },
            // {
            // 	name: "BooleanInput",
            // 	description: "Returns whether or not the button is pressed.",
            // 	blocklyTemplate: [
            //         {
            //             field: () => new FieldGridDropdown([['true', 'True'],['false', 'False']]),
            //             name: 'operation',
            //         },
            // 	],
            //     blocklyOutput: {
            //         type: 'Boolean',
            //         name: 'value',
            //     },
            //     inputsInline: true,
            // 	codeGenerator: (block) => {
            // 		const operation = spacesToUnderscores(block.getFieldValue('operation'));
            // 		let code = `${operation}`
            // 		return [code, Order.NONE];
            // 	}
            // },
            {
                name: 'numberInput',
                description: 'Returns whether or not the button is pressed.',
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
                codeGenerator: (block) => {
                    const operation = block.getFieldValue('operation')
                    let code = `${operation}`
                    return [code, Order.NONE]
                },
            },
            {
                name: 'repeatFor',
                description: 'if statement help.',
                blocklyTemplate: [
                    {
                        text: 'repeat for',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Number',
                            shadow: 'numberInput',
                        },
                    },
                    {
                        text: 'times do:',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                //inputsInline: false,
                codeGenerator: (block) => {
                    var value_function = pythonGenerator.valueToCode(
                        block,
                        'function',
                        Order.ATOMIC,
                    )
                    let len = value_function.length
                    if (len == 0) value_function = '0'
                    else {
                        value_function = value_function.replace('(', '')
                        value_function = value_function.slice(0, -1)
                    }
                    var input = pythonGenerator.statementToCode(block, 'input')
                    if (input.length == 0) {
                        input = '\tpass'
                    }

                    const code = `for i in range(${value_function}):\n${input}\n`
                    return code
                },
            },
            {
                name: 'repeatIf',
                description: 'if statement help.',
                blocklyTemplate: [
                    {
                        text: 'repeat',
                    },
                    {
                        field: () =>
                            new FieldGridDropdown([
                                ['while', 'While'],
                                ['until', 'Until'],
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
                        text: 'do:',
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                ],
                codeGenerator: (block) => {
                    var value_function = pythonGenerator.valueToCode(
                        block,
                        'function',
                        Order.ATOMIC,
                    )
                    const operation = block.getFieldValue('operation')
                    let len = value_function.length
                    if (len == 0) value_function = 'False'
                    else {
                        value_function = value_function.replace('(', '')
                        value_function = value_function.slice(0, -1)
                    }
                    var input = pythonGenerator.statementToCode(block, 'input')
                    if (input.length == 0) {
                        input = '\tpass'
                    }
                    const optional_not = operation == 'While' ? '' : 'not '
                    const code = `while ${optional_not}${value_function}:\n${input}\n`
                    return code
                },
            },
        ],
        examples: [
            {
                name: 'Run code when pressed',
                preamble:
                    'Uses an if block to run a motor command only when the button is pressed.',
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
                                        type: 'smallmotor',
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
                                                            type: 'isPressed',
                                                            fields: {
                                                                name: 'start_button',
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
                        ],
                    },
                },
            },
            {
                name: 'Choose between actions',
                preamble:
                    'Uses if/else to run one motor action when a button is held and another when it is not.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'button',
                                x: 12,
                                y: 12,
                                fields: {
                                    name: 'mode_button',
                                    port: '11',
                                },
                                next: {
                                    block: {
                                        type: 'ifElse',
                                        inputs: {
                                            function: {
                                                block: {
                                                    type: 'isHeld',
                                                    fields: {
                                                        name: 'mode_button',
                                                    },
                                                },
                                            },
                                            input: {
                                                block: {
                                                    type: 'driveForTime',
                                                    fields: {
                                                        name: 'drivebase',
                                                        power: '40',
                                                        time: '1',
                                                    },
                                                },
                                            },
                                            input_else: {
                                                block: {
                                                    type: 'turnForTime',
                                                    fields: {
                                                        name: 'drivebase',
                                                        power: '35',
                                                        time: '0.5',
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
                name: 'Repeat a task',
                preamble:
                    'Repeats a short motor movement a set number of times.',
                workspace: {
                    blocks: {
                        languageVersion: 0,
                        blocks: [
                            {
                                type: 'smallmotor',
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
                                                block: {
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
        ],
    },
]

/**
 * Converts learner-entered names into valid Python identifiers.
 * @param {string} str Name entered in a Blockly text field.
 * @returns {string} Name with whitespace replaced by underscores.
 */
const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')

/**
 * Extracts block-only categories for the interactive Jenga toolbox.
 * @param {object[]} [sourceLibrary=library] Library categories to extract.
 * @returns {object[]} Toolbox-ready Blockly categories.
 */
export function extractJengaBlocks(sourceLibrary = library) {
    const categories = Array.isArray(sourceLibrary)
        ? sourceLibrary
        : [sourceLibrary]

    const jengaBlocks = categories.map(({ examples, ...category }) => ({
        ...category,
        entries: category.entries.map((blockEntry) => ({
            ...blockEntry,
            blocklyTemplate: [...blockEntry.blocklyTemplate],
        })),
    }))

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
        ...category,
        entries: category.entries.map((blockEntry) => ({
            ...blockEntry,
            blocklyTemplate: [...blockEntry.blocklyTemplate],
        })),
        examples: (category.examples ?? []).map((example) => ({
            ...example,
        })),
    }))

    return injectHelpButton(cheatSheetCategories)
}

export const jengaBlocks = extractJengaBlocks(library)
export const cheatSheetBlocks = extractCheatSheetBlocks(library)
