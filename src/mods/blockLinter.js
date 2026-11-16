/*
 * The block linter: checks the program for mistakes the blocks and the
 * Devices pop-up let through, and says how to fix each one. It runs after
 * every change to the blocks or the devices (buildBlockMode.js), which
 * lists what it finds in the Issues drawer (issuesDrawerHelper.js). A block
 * with a problem also gets Blockly's warning icon with the message.
 *
 * An error is a program that breaks or cannot do anything: a blank device,
 * a button set up twice, a condition left empty. A warning is a program
 * that runs but likely not as meant: Wait 400 seconds, 0 power, a block
 * after Forever.
 *
 * There are two kinds of rule: a block rule looks at one block, a device
 * rule at the devices. Each returns its problems. To add a check, add a
 * rule to `blockRules` or `deviceRules`, and a test to
 * tests/blockLinter.test.js.
 */

import { FieldLabel, inputs } from 'blockly'

import { deviceKinds, getDevices } from '../helpers/devicesHelper'
import { FieldDevice } from './deviceField'

/** The id the linter's warnings go under, apart from any other warning. */
const LINT_ID = 'lint'

/**
 * Words Python keeps for itself, and the names the program already uses:
 * a device or button named one of them breaks the program.
 */
const TAKEN_NAMES = new Set([
    'False',
    'None',
    'True',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
    // the program's own
    'make',
    'time',
])

/** A time this long or longer is likely meant in milliseconds. */
const LONG_SECONDS = 60

/** The blocks with a time in seconds, in their `time` field. */
const TIMED_BLOCKS = new Set([
    'wait',
    'spinForTime',
    'driveForTime',
    'turnForTime',
    'curveForTime',
])

/** The blocks with one power, in their `power` field. */
const POWERED_BLOCKS = new Set([
    'spin',
    'spinForTime',
    'drive',
    'driveForTime',
    'turn',
    'turnForTime',
])

/** The blocks with a left and a right power. */
const CURVE_BLOCKS = new Set(['curve', 'curveForTime'])

/** The blocks that run what is inside them again and again. */
const LOOP_BLOCKS = new Set(['forever', 'repeatFor', 'repeatIf'])

/** The blocks that ask whether a button is down, by its name. */
const BUTTON_READERS = new Set(['isPressed', 'isHeld'])

/**
 * What an empty slot does, for the blocks where it is worse than a gap:
 * [severity, message]. The rest get a general warning.
 */
const EMPTY_SLOT = {
    if: [
        'error',
        'If needs a condition. With none, the blocks inside never run.',
    ],
    ifElse: [
        'error',
        'If needs a condition. With none, only the else blocks run.',
    ],
    until: [
        'error',
        'Wait until needs a condition. With none, it waits forever.',
    ],
    while: [
        'warning',
        'Wait while needs a condition. With none, it does not wait.',
    ],
    repeatIf: [
        'error',
        'Repeat needs a condition. Put a condition block in its slot.',
    ],
    repeatFor: ['error', 'Repeat needs a number of times.'],
}

/**
 * A problem found by a rule.
 * @typedef {object} Problem
 * @property {'error'|'warning'} severity
 * @property {string} message What is wrong and how to fix it.
 */

/** @param {string} message @returns {Problem} */
const error = (message) => ({ severity: 'error', message })
/** @param {string} message @returns {Problem} */
const warning = (message) => ({ severity: 'warning', message })

/**
 * @param {object} block
 * @returns {object[]} The block's own fields.
 */
const fieldsOf = (block) => block.inputList.flatMap((input) => input.fieldRow)

/**
 * @param {string} kindName
 * @returns {string} What the kind is called: "drive motor".
 */
const labelOf = (kindName) => deviceKinds[kindName]?.label ?? 'device'

/**
 * @param {string} word
 * @returns {string} "a drive motor", "an ...".
 */
const a = (word) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`

/**
 * @param {string} name As typed on a block.
 * @returns {string} As the Python has it: spaces become underscores.
 */
const pythonName = (name) =>
    String(name ?? '')
        .trim()
        .replace(/\s+/g, '_')

/**
 * @param {number} seconds
 * @returns {string} "6 minutes 40 seconds", "1 minute", "90 seconds" under
 *     two minutes reads as minutes too.
 */
export const durationText = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const rest = Math.round((seconds - minutes * 60) * 100) / 100
    const parts = []
    if (minutes) {
        parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
    }
    if (rest || !minutes) {
        parts.push(`${rest} second${rest === 1 ? '' : 's'}`)
    }
    return parts.join(' ')
}

/**
 * @param {object} block
 * @returns {string} What the block is called, by its first words: "Spin
 *     block", or "button block" for one that starts with a name.
 */
export const blockName = (block) => {
    const label = fieldsOf(block).find((field) => field instanceof FieldLabel)
    const text = label?.getText()?.trim()
    return text ? `${text} block` : 'A block'
}

/**
 * @param {object} block
 * @returns {boolean} Whether the block is inside a loop, at any depth.
 */
const insideLoop = (block) => {
    for (let parent = block.getSurroundParent(); parent; ) {
        if (LOOP_BLOCKS.has(parent.type)) {
            return true
        }
        parent = parent.getSurroundParent()
    }
    return false
}

/**
 * What the rules know about the whole program.
 * @typedef {object} Context
 * @property {object[]} devices
 * @property {object[]} buttons The button blocks.
 */

/**
 * A rule for one block.
 * @typedef {(block: object, context: Context) => Problem[]} BlockRule
 */

/** @type {BlockRule[]} */
const blockRules = [
    // a device dropdown left blank, or naming a device that is not there
    (block, { devices }) =>
        fieldsOf(block)
            .filter((field) => field instanceof FieldDevice)
            .map((field) => {
                const label = labelOf(field.kind)
                const ofKind = devices.filter((d) => d.kind === field.kind)
                const name = field.getValue()
                if (!name) {
                    return ofKind.length
                        ? error(`Pick which ${label} this block uses.`)
                        : error(
                              `Add ${a(label)} with the Devices button, then pick it here.`,
                          )
                }
                if (!ofKind.some((device) => device.name === name)) {
                    return error(
                        `There is no ${label} named ${name}. Add it with the Devices button, or pick another.`,
                    )
                }
                return null
            })
            .filter(Boolean),

    // a time of 0 does nothing; a long one is likely meant in milliseconds
    (block) => {
        if (!TIMED_BLOCKS.has(block.type)) {
            return []
        }
        const seconds = Number(block.getFieldValue('time'))
        if (seconds === 0) {
            return [
                warning(
                    block.type === 'wait'
                        ? 'Waiting 0 seconds does nothing. Wait at least a little, like 1 second.'
                        : 'For 0 seconds is no time at all, so nothing moves. Set how many seconds.',
                ),
            ]
        }
        if (seconds >= LONG_SECONDS) {
            return [
                warning(
                    `${seconds} seconds is ${durationText(seconds)}. Times are in seconds: ` +
                        `${seconds / 1000} seconds is ${seconds} milliseconds.`,
                ),
            ]
        }
        return []
    },

    // 0 power moves nothing; negative power with a way picked is backwards twice
    (block) => {
        const problems = []
        if (POWERED_BLOCKS.has(block.type)) {
            const power = Number(block.getFieldValue('power'))
            if (power === 0) {
                problems.push(
                    warning(
                        'At 0 power nothing moves. To stop, use a Stop block.',
                    ),
                )
            } else if (power < 0 && block.getField('way')) {
                const way = block.getFieldValue('way')
                const other = way === 'backward' ? 'forward' : 'backward'
                problems.push(
                    warning(
                        `Less than 0 power turns ${way} around, so it spins ${other}. Pick ${other} and use power above 0.`,
                    ),
                )
            }
        }
        if (CURVE_BLOCKS.has(block.type)) {
            const left = Number(block.getFieldValue('left'))
            const right = Number(block.getFieldValue('right'))
            if (left === 0 && right === 0) {
                problems.push(
                    warning(
                        'At 0 power on both sides nothing moves. To stop, use a Stop block.',
                    ),
                )
            }
        }
        return problems
    },

    // a Repeat's count: a whole number above 0
    (block) => {
        if (block.type !== 'repeatFor') {
            return []
        }
        const count = block.getInputTargetBlock('function')
        if (count?.type !== 'numberInput') {
            return []
        }
        const times = Number(count.getFieldValue('operation'))
        if (!Number.isInteger(times)) {
            return [
                error(
                    `Repeat ${times} times can't be done: repeat a whole number of times, like ${Math.max(1, Math.round(times))}.`,
                ),
            ]
        }
        if (times <= 0) {
            return [
                warning(
                    `Repeat ${times} times never runs the blocks inside. Repeat at least 1 time.`,
                ),
            ]
        }
        return []
    },

    // an empty slot for a condition or a number
    (block) =>
        block.inputList
            .filter(
                (input) =>
                    input.type === inputs.inputTypes.VALUE &&
                    input.connection &&
                    !input.connection.targetBlock(),
            )
            .map(() => {
                const [severity, message] = EMPTY_SLOT[block.type] ?? [
                    'warning',
                    `${blockName(block)} has an empty slot. Put a block in it.`,
                ]
                return { severity, message }
            })
            .slice(0, 1),

    // a loop or If with nothing inside
    (block) => {
        const empty = block.inputList.filter(
            (input) =>
                input.type === inputs.inputTypes.STATEMENT &&
                input.name !== 'input_else' &&
                !input.connection?.targetBlock(),
        )
        return empty.length
            ? [
                  warning(
                      `${blockName(block)} has nothing inside. Put blocks in it.`,
                  ),
              ]
            : []
    },

    // a block under a Forever never runs
    (block) =>
        block.getPreviousBlock()?.type === 'forever' &&
        block.getPreviousBlock().getNextBlock() === block
            ? [
                  warning(
                      'This block never runs: the Forever above it never ends. Move it above the Forever, or inside it.',
                  ),
              ]
            : [],

    // a button: named, once, on a port of its own, set up outside any loop
    (block, { devices, buttons }) => {
        if (block.type !== 'button') {
            return []
        }
        const problems = []
        const name = pythonName(block.getFieldValue('name'))
        const port = block.getFieldValue('port')
        if (!name) {
            problems.push(error('This button has no name. Give it one.'))
        } else if (TAKEN_NAMES.has(name)) {
            problems.push(
                error(
                    `${name} can't be a button's name: the program uses that word. Pick another name.`,
                ),
            )
        } else if (devices.some((device) => device.name === name)) {
            problems.push(
                error(
                    `${name} is already a device's name. Give the button another name.`,
                ),
            )
        }
        const samePort = buttons.filter(
            (other) => other.getFieldValue('port') === port,
        )
        if (samePort.length > 1) {
            problems.push(
                error(
                    `Button ${port} is set up ${samePort.length} times. Set each button up once.`,
                ),
            )
        } else if (
            name &&
            buttons.some(
                (other) =>
                    other !== block &&
                    pythonName(other.getFieldValue('name')) === name,
            )
        ) {
            problems.push(
                warning(
                    `Two buttons are named ${name}. Give each one its own name.`,
                ),
            )
        }
        if (insideLoop(block)) {
            problems.push(
                error(
                    'A button is set up once. Inside a loop it is set up again each time, which stops the program. Move it above the loop.',
                ),
            )
        }
        return problems
    },

    // asking about a button that is not set up
    (block, { buttons }) => {
        if (!BUTTON_READERS.has(block.type)) {
            return []
        }
        const name = pythonName(block.getFieldValue('name'))
        const known = buttons.some(
            (button) => pythonName(button.getFieldValue('name')) === name,
        )
        if (known) {
            return []
        }
        return [
            error(
                name
                    ? `There is no button named ${name}. Set it up with an "is button" block first.`
                    : 'Type the name of the button this block asks about.',
            ),
        ]
    },
]

/**
 * A rule for the devices.
 * @typedef {(devices: object[]) => Problem[]} DeviceRule
 */

/** @type {DeviceRule[]} */
const deviceRules = [
    // every device needs a name, one of its own, that Python can use
    (devices) => {
        const problems = []
        const seen = new Set()
        devices.forEach((device) => {
            const label = labelOf(device.kind)
            if (!device.name) {
                problems.push(error(`A ${label} has no name. Give it one.`))
                return
            }
            if (TAKEN_NAMES.has(device.name)) {
                problems.push(
                    error(
                        `${device.name} can't be a device's name: the program uses that word. Pick another name.`,
                    ),
                )
            }
            if (seen.has(device.name)) {
                problems.push(
                    error(
                        `Two devices are named ${device.name}. Give each one its own name.`,
                    ),
                )
            }
            seen.add(device.name)
        })
        return problems
    },

    // a drivetrain's motors: both picked, both drive motors, not the same one
    (devices) => {
        const motors = devices
            .filter((device) => device.kind === 'drive_motor')
            .map((device) => device.name)
        return devices
            .filter((device) => device.kind === 'drivetrain')
            .flatMap((device) => {
                const name = device.name || 'A drivetrain'
                const problems = []
                for (const side of ['left', 'right']) {
                    const motor = device[side]
                    if (!motor) {
                        problems.push(
                            motors.length
                                ? error(`Pick ${name}'s ${side} motor.`)
                                : error(
                                      `${name} needs a ${side} motor. Add a drive motor, then pick it.`,
                                  ),
                        )
                    } else if (!motors.includes(motor)) {
                        problems.push(
                            error(
                                `${name}'s ${side} motor, ${motor}, is not a drive motor. Pick another.`,
                            ),
                        )
                    }
                }
                if (device.left && device.left === device.right) {
                    problems.push(
                        warning(
                            `${name} uses ${device.left} for both sides. Pick a different motor for one side.`,
                        ),
                    )
                }
                return problems
            })
    },

    // a drivetrain's drift: above 0, and near 1 (1 is no drift; below 1
    // slows the left side, above 1 the right)
    (devices) =>
        devices
            .filter((device) => device.kind === 'drivetrain')
            .map((device) => {
                const name = device.name || 'A drivetrain'
                const drift = Number(device.drift)
                if (!(drift > 0)) {
                    return error(
                        `${name}'s drift is ${device.drift}, so one side doesn't drive. Drift must be above 0: 1 is none.`,
                    )
                }
                if (drift < 0.5 || drift > 2) {
                    return warning(
                        `${name}'s drift of ${device.drift} runs one side at less than half power. Drift is usually close to 1.`,
                    )
                }
                return null
            })
            .filter(Boolean),

    // two drive motors on one port
    (devices) => {
        const byPort = new Map()
        for (const device of devices) {
            if (device.kind === 'drive_motor') {
                byPort.set(device.port, [
                    ...(byPort.get(device.port) ?? []),
                    device.name || 'a motor',
                ])
            }
        }
        return [...byPort]
            .filter(([, names]) => names.length > 1)
            .map(([port, names]) =>
                warning(
                    `${names.join(' and ')} are ${names.length === 2 ? 'both' : 'all'} on port ${port}. Give each one its own port.`,
                ),
            )
    },
]

/**
 * A problem, ready for the Issues drawer.
 * @typedef {object} LintIssue
 * @property {'error'|'warning'} severity
 * @property {string} message
 * @property {string} where "Spin block", or "Devices".
 * @property {object} [block] The block it is on, if any.
 */

/**
 * Checks the program: its devices, then every block on the workspace.
 * Marks the blocks with problems (on a rendered workspace); blocks
 * without lose their mark.
 * @param {object} workspace The program's workspace.
 * @returns {LintIssue[]} The problems found, errors first.
 */
export const lintBlocks = (workspace) => {
    const devices = getDevices(workspace)
    const found = deviceRules
        .flatMap((rule) => rule(devices))
        .map((problem) => ({ ...problem, where: 'Devices' }))

    const blocks = workspace
        .getTopBlocks(true)
        .flatMap((top) => top.getDescendants(true))
        // a shadow (a default value in a slot) is part of the block it is in
        .filter((block) => !block.isShadow())
    const context = {
        devices,
        buttons: blocks.filter((block) => block.type === 'button'),
    }
    for (const block of blocks) {
        const problems = blockRules.flatMap((rule) => rule(block, context))
        // only a rendered block can show a warning icon
        block.setWarningText?.(
            problems.length
                ? problems.map((problem) => problem.message).join('\n')
                : null,
            LINT_ID,
        )
        found.push(
            ...problems.map((problem) => ({
                ...problem,
                where: blockName(block),
                block,
            })),
        )
    }
    return found.sort(
        (x, y) =>
            Number(x.severity !== 'error') - Number(y.severity !== 'error'),
    )
}
