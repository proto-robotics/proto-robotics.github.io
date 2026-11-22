/*
 * The block linter: checks the program for mistakes the blocks and the
 * Devices pop-up let through, and says how to fix each one. It runs after
 * every change to the blocks or the devices (buildBlockMode.js), which
 * lists what it finds in the Issues drawer (issuesDrawerHelper.js). A block
 * with a problem also gets Blockly's warning icon with the message.
 *
 * An error is a program that breaks or cannot do anything: a blank device
 * or variable, a step outside a loop. A warning is a
 * program that runs but likely not as meant: Wait 400 seconds, 0 power, a
 * block after Forever.
 *
 * There are two kinds of rule: a block rule looks at one block, a device
 * rule at the devices. Each returns its problems. To add a check, add a
 * rule to `blockRules` or `deviceRules`, and a test to
 * tests/blockLinter.test.js.
 */

import { FieldLabel, inputs } from 'blockly'

import { blockSet, lintRules, numberShadowTypes, stepBlockTypes } from '../libraries/engine'
import { getVocab } from '../data/vocab'
import { deviceKinds, getDevices } from '../helpers/devicesHelper'
import { FieldDevice } from './deviceField'
import { insideLoop } from './stepBlocks'

/** The id the linter's warnings go under, apart from any other warning. */
const LINT_ID = 'lint'

/** Words Python keeps for itself: a device or variable named one breaks the program. */
const PYTHON_WORDS = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]

/**
 * The names a device or variable cannot have: Python's words, every name
 * the libraries' vocabulary brings in (make's wait, drive_motor, the board's
 * A and L1...), and the names the libraries say their blocks use.
 * @returns {Set<string>}
 */
const takenNames = () =>
    new Set([
        ...PYTHON_WORDS,
        ...(getVocab().autocomplete?.members ?? []).map((member) => member.name),
        ...blockSet().takenNames,
    ])

/** A time this long or longer is likely meant in milliseconds. */
const LONG_SECONDS = 60

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
 * A number a block is given, in a field or in a slot (a number block, or
 * the slot's default). A variable or a sum in the slot is only known when
 * the program runs, so it gives null, as does a block with no such number.
 * @returns {number|null}
 */
const numberField = (block, name) => {
    if (block.getField(name)) {
        return Number(block.getFieldValue(name))
    }
    const inSlot = block.getInput(name) ? block.getInputTargetBlock(name) : null
    if (
        inSlot &&
        (inSlot.type === 'numberInput' || numberShadowTypes.has(inSlot.type))
    ) {
        return Number(inSlot.getFieldValue('operation'))
    }
    return null
}

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
 * @param {number} seconds
 * @returns {string} "6 minutes 40 seconds", "1 minute", "45 seconds".
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

/** "400 seconds is 6 minutes 40 seconds. Times are in seconds: ..." */
const longTime = (seconds) =>
    warning(
        `${seconds} seconds is ${durationText(seconds)}. Times are in seconds: ` +
            `${seconds / 1000} seconds is ${seconds} milliseconds.`,
    )

/**
 * @param {object} block
 * @returns {string} What the block is called, by its first words: "Spin
 *     block". A step block says so: "Spin step".
 */
export const blockName = (block) => {
    const label = fieldsOf(block).find((field) => field instanceof FieldLabel)
    const text = label?.getText()?.trim()
    if (!text) {
        return 'A block'
    }
    return `${text} ${stepBlockTypes.has(block.type) ? 'step' : 'block'}`
}

/**
 * What the rules know about the whole program.
 * @typedef {object} Context
 * @property {object[]} devices The devices and variables.
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

    // a step outside every loop runs once, for a moment
    (block) =>
        stepBlockTypes.has(block.type) && !insideLoop(block)
            ? [
                  error(
                      `A step only works inside a loop, like Forever or Repeat: on its own it runs for a moment and stops. Put it in a loop, or use the ${blockName(block).replace(/ step$/, '')} block with a time.`,
                  ),
              ]
            : [],

    // seconds or degrees: 0 does nothing, and a long time is likely milliseconds
    (block) => {
        const problems = []
        const unit = block.getField('unit') ? block.getFieldValue('unit') : null
        const n = numberField(block, 'amount')
        if (unit === 'degrees' && n === 0) {
            problems.push(
                warning(
                    'Through 0 degrees nothing moves. Set how many degrees: 360 is one full turn.',
                ),
            )
        }
        if (unit === 'seconds' && n === 0) {
            problems.push(
                warning(
                    'For 0 seconds is no time at all, so nothing moves. Set how many seconds.',
                ),
            )
        }
        if (unit === 'seconds' && n >= LONG_SECONDS) {
            problems.push(longTime(n))
        }
        const time = numberField(block, 'time')
        if (lintRules.zeroTime[block.type] && time === 0) {
            problems.push(warning(lintRules.zeroTime[block.type]))
        }
        if (lintRules.longTime.has(block.type) && time >= LONG_SECONDS) {
            problems.push(longTime(time))
        }
        return problems
    },

    // 0 power moves nothing; below 0 with a way picked turns it around
    (block) => {
        const problems = []
        const power = numberField(block, 'power')
        if (
            numberField(block, 'left') === 0 &&
            numberField(block, 'right') === 0
        ) {
            problems.push(
                warning(
                    'With both sides at 0 power nothing moves. To stop, use a Stop block.',
                ),
            )
        }
        if (power === 0) {
            problems.push(
                warning('At 0 power nothing moves. To stop, use a Stop block.'),
            )
        } else if (power < 0 && block.getField('way')) {
            const way = block.getFieldValue('way')
            const other = {
                forward: 'backward',
                backward: 'forward',
                right: 'left',
                left: 'right',
            }[way]
            problems.push(
                warning(
                    `Less than 0 power turns ${way} around, so it goes ${other}. Pick ${other} and use power above 0.`,
                ),
            )
        }
        return problems
    },

    // the ranges a number field used to hold a number to: power, and
    // times and degrees that can't be below 0
    (block) => {
        const problems = []
        for (const name of ['power', 'left', 'right']) {
            const power = numberField(block, name)
            if (power !== null && Math.abs(power) > 100) {
                problems.push(
                    warning(
                        `Power goes from -100 to 100, so ${power} runs the same as ${power > 0 ? 100 : -100}.`,
                    ),
                )
            }
        }
        for (const name of ['amount', 'time', 'leftDegrees', 'rightDegrees']) {
            const n = numberField(block, name)
            if (n !== null && n < 0) {
                problems.push(
                    warning(
                        `${n} can't be below 0. To go the other way, pick the other direction.`,
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
        const times = numberField(block, 'function')
        if (times === null) {
            return []
        }
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
                const [severity, message] = lintRules.emptySlot[block.type] ?? [
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
]

/**
 * A rule for the devices.
 * @typedef {(devices: object[]) => Problem[]} DeviceRule
 */

/** @type {DeviceRule[]} */
const deviceRules = [
    // every device and variable needs a name, one of its own, that Python
    // can use; a variable's problems are listed under Variables
    (devices) => {
        const problems = []
        const seen = new Set()
        devices.forEach((device) => {
            const label = labelOf(device.kind)
            const what = device.kind === 'variable' ? 'variable' : 'device'
            const where = device.kind === 'variable' ? 'Variables' : 'Devices'
            const add = (problem) => problems.push({ ...problem, where })
            if (!device.name) {
                add(error(`A ${label} has no name. Give it one.`))
                return
            }
            if (takenNames().has(device.name)) {
                add(
                    error(
                        `${device.name} can't be a ${what}'s name: the program uses that word. Pick another name.`,
                    ),
                )
            }
            if (seen.has(device.name)) {
                add(
                    error(
                        `${device.name} is used twice. Give each device and variable its own name.`,
                    ),
                )
            }
            seen.add(device.name)
        })
        return problems
    },

    // a drivetrain's motors: at least two, each picked, each a drive
    // motor, none twice (make refuses a drivetrain of fewer than two)
    (devices) => {
        const motors = devices
            .filter((device) => device.kind === 'drive_motor')
            .map((device) => device.name)
        return devices
            .filter((device) => device.kind === 'drivetrain')
            .flatMap((device) => {
                const name = device.name || 'A drivetrain'
                const problems = []
                if (device.motors.length < 2) {
                    problems.push(
                        error(
                            `${name} needs at least 2 motors, a left and a right. Add a motor.`,
                        ),
                    )
                }
                const seen = new Set()
                device.motors.forEach((motor, i) => {
                    if (!motor) {
                        if (motors.length) {
                            problems.push(
                                error(`Pick ${name}'s motor ${i + 1}.`),
                            )
                        } else if (!seen.has('')) {
                            // with no drive motors yet, one line says so
                            problems.push(
                                error(
                                    `${name} needs motors. Add a drive motor, then pick it.`,
                                ),
                            )
                        }
                    } else if (!motors.includes(motor)) {
                        problems.push(
                            error(
                                `${name}'s motor ${motor} is not a drive motor. Pick another.`,
                            ),
                        )
                    } else if (seen.has(motor)) {
                        problems.push(
                            error(
                                `${name} has ${motor} twice. Pick a different motor for each wheel.`,
                            ),
                        )
                    }
                    seen.add(motor)
                })
                return problems
            })
    },

    // two devices on one port
    (devices) => {
        const byPort = new Map()
        for (const device of devices) {
            if (device.port !== undefined) {
                byPort.set(device.port, [
                    ...(byPort.get(device.port) ?? []),
                    device.name || `a ${labelOf(device.kind)}`,
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
        .map((problem) => ({ where: 'Devices', ...problem }))

    const blocks = workspace
        .getTopBlocks(true)
        .flatMap((top) => top.getDescendants(true))
        // a shadow (a default value in a slot) is part of the block it is in
        .filter((block) => !block.isShadow())
    const context = { devices }
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
