import { FieldDropdown, FieldNumber, FieldTextInput } from 'blockly'

export default [
    {
        name: 'Motor',
        color: '#cc4444',
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
                        text: 'is a smallmotor on port',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['1', '1'],
                                ['2', '2'],
                                ['3', '3'],
                                ['4', '4'],
                                ['5', '5'],
                            ]),
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
                        field: () =>
                            new FieldDropdown([
                                ['1', '1'],
                                ['2', '2'],
                                ['3', '3'],
                                ['4', '4'],
                                ['5', '5'],
                            ]),
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
                        text: 'is a largemotor on port',
                    },
                    {
                        field: () =>
                            new FieldDropdown([
                                ['6', '6'],
                                ['7', '7'],
                            ]),
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
                name: 'stop',
                description: 'Stops a motor or drivetrain',
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
    },
    {
        name: 'Drivetrain',
        color: '#44cc44',
        entries: [],
    },
    {
        name: 'Sensors',
        color: '#4444cc',
        entries: [],
    },
    {
        name: 'Time',
        color: '#44cccc',
        entries: [],
    },
]

const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')
