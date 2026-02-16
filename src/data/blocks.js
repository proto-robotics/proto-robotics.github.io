import { FieldDropdown, FieldNumber, FieldTextInput, FieldCheckbox, FieldImage } from 'blockly'
import {FieldColourHsvSliders} from '@blockly/field-colour-hsv-sliders';
import {pythonGenerator, Order} from 'blockly/python';
import {FieldGridDropdown} from '@blockly/field-grid-dropdown';

export default [
    {
        name: 'Motor',
        color: '#F2737B',
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
                        text: 'is a largemotor \non port',
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
                name: 'stopMotor',
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
        color: '#00B8AA',
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
    },
    {
        name: 'Sensors',
        color: '#6395CF',
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
                        field: () =>
                            new FieldDropdown([
                                ['8', '8'],
                                ['9', '9'],
                            ]),
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
    },
    {
        name: 'Time',
        color: '#9970B1',
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
                    }
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
                    }
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
    },
    {
        name: 'Flow',
        color: '#F8BF41',
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
				name: "if",
				description: "if statement help.",
				blocklyTemplate: [
                    {
                        "text": "if      ",
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        "text": "do:",
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
				],
				codeGenerator: (block) => {
					var value_function = pythonGenerator.valueToCode(block, 'function', Order.ATOMIC);
					let len = value_function.length;
					if (len == 0)
						value_function = 'False';
					else {
						value_function = value_function.replace('(','');
						value_function = value_function.slice(0,-1);
					}
					var input = pythonGenerator.statementToCode(block, 'input');
					if (input.length == 0) {
						input = '\tpass';
					}

					const code = `if ${value_function}:\n${input}\n`;
					return code;
				}
			},
            {
				name: "ifElse",
				description: "if_else statement help.",
				blocklyTemplate: [
                    {
                        "text": "if      ",
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        "text": "do:",
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
                    {
                        "text": "\nelse:",
                    },
                    {
                        blocklyInput: {
                            name: 'input_else',
                            type: 'Void',
                        },
                    },
				],
				codeGenerator: (block) => {
					var value_function = pythonGenerator.valueToCode(block, 'function', Order.ATOMIC);
					let len = value_function.length;
					if (len == 0)
						value_function = 'False';
					else {
						value_function = value_function.replace('(','');
						value_function = value_function.slice(0,-1);
					}
					var input = pythonGenerator.statementToCode(block, 'input');
					if (input.length == 0) {
						input = '\tpass';
					}

					const code = `if ${value_function}:\n${input}\nelse:\n${pythonGenerator.statementToCode(block, 'input_else') || '\tpass'}\n`;
					return code;
				}
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
				name: "logicalCompare",
				description: "Returns whether or not the button is pressed.",
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
                        field: () => new FieldGridDropdown([['and', 'and'],['or', 'or']]),
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
					const operation = spacesToUnderscores(block.getFieldValue('operation'));
					var value_functionA_code = pythonGenerator.valueToCode(block, 'functionA', Order.ATOMIC);
					var value_functionB_code = pythonGenerator.valueToCode(block, 'functionB', Order.ATOMIC);
					if (value_functionA_code.length == 0) {
						value_functionA_code = '0';
					}
					if (value_functionB_code.length == 0) {
						value_functionB_code = '0';
					}
					let code = `${value_functionA_code} ${operation} ${value_functionB_code}`
					return [code, Order.NONE];
				}
			},
            {
				name: "logicalNot",
				description: "Returns whether or not the button is pressed.",
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
					var value_functionA_code = pythonGenerator.valueToCode(block, 'functionA', Order.ATOMIC);
					if (value_functionA_code.length == 0) {
						value_functionA_code = '0';
					}
					let code = `not ${value_functionA_code}`
					return [code, Order.NONE];
				}
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
				name: "numberInput",
				description: "Returns whether or not the button is pressed.",
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
					const operation = block.getFieldValue('operation');
					let code = `${operation}`
					return [code, Order.NONE];
				}
			},
            {
				name: "repeatFor",
				description: "if statement help.",
				blocklyTemplate: [
                    {
                        "text": "repeat for",
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Number',
                            shadow: 'numberInput',
                        },
                    },
                    {
                        "text": "times do:",
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
					var value_function = pythonGenerator.valueToCode(block, 'function', Order.ATOMIC);
					let len = value_function.length;
					if (len == 0)
						value_function = '0';
					else {
						value_function = value_function.replace('(','');
						value_function = value_function.slice(0,-1);
					}
					var input = pythonGenerator.statementToCode(block, 'input');
					if (input.length == 0) {
						input = '\tpass';
					}

					const code = `for i in range(${value_function}):\n${input}\n`;
					return code;
				}
			},
            {
				name: "repeatIf",
				description: "if statement help.",
				blocklyTemplate: [
                    {
                        "text": "repeat",
                    },
                    {
                        field: () => new FieldGridDropdown([['while', 'While'],['until', 'Until']]),
                        name: 'operation',
                    },
                    {
                        blocklyInput: {
                            name: 'function',
                            type: 'Boolean',
                        },
                    },
                    {
                        "text": "do:",
                    },
                    {
                        blocklyInput: {
                            name: 'input',
                            type: 'Void',
                        },
                    },
				],
				codeGenerator: (block) => {
					var value_function = pythonGenerator.valueToCode(block, 'function', Order.ATOMIC);
                    const operation = block.getFieldValue('operation');
					let len = value_function.length;
					if (len == 0)
						value_function = 'False';
					else {
						value_function = value_function.replace('(','');
						value_function = value_function.slice(0,-1);
					}
					var input = pythonGenerator.statementToCode(block, 'input');
					if (input.length == 0) {
						input = '\tpass';
					}
                    const optional_not = operation == 'While' ? '' : 'not '
                    const code = `while ${optional_not}${value_function}:\n${input}\n`;
                    return code;
                }
			},
            
        ],
    }
]

const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')
