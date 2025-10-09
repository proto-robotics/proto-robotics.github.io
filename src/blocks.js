import { FieldDropdown, FieldTextInput } from "blockly"

export default [
    {
        name: "Motor",
        color: "#cc4444",
        entries: [
            {
                name: "smallmotor",
                description: "Creates a smallmotor",
                blocklyTemplate: [
                    {
                        field: () => new FieldTextInput("motor"),
                        name: "name",
                    },
                    {
                        text: "is a smallmotor on port",
                    },
                    {
                        field: () => new FieldDropdown([
                            ["1", "1"],
                            ["2", "2"],
                            ["3", "3"],
                            ["4", "4"],
                            ["5", "5"],
                        ]),
                        name: "port",
                    },
                    {
                        text: "in direction",
                    },
                    {
                        field: () => new FieldDropdown([
                            ["clockwise ↻", "1"],
                            ["counter-clockwise ↺", "-1"]
                        ]),
                        name: "direction",
                    },
                ],
                codeGenerator: (block) => {
                    const name = spacesToUnderscores(block.getFieldValue("name"))

                    const port = block.getFieldValue("port")
                    const direction = block.getFieldValue("direction")

                    const directionSnippet = (direction == 1) ? "" : ", direction=-1"
                    const code = `${name} = make.smallmotor(port=${port}${directionSnippet})\n`
                    return code
                },
            },
        ],
    },
]

const spacesToUnderscores = (str) => str.replace(/\s+/g, '_')
