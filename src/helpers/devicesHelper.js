/*
 * The devices a program sets up before its blocks run: drive motors, each
 * with a name, a port and a direction, and drivetrains: two or more drive
 * motors driven as one (make's drivetrain(left, right)). Its variables live
 * here too, each a name and the number it starts at (the Variables pop-up
 * shows them). They are part of the workspace's state (a
 * Blockly serializer under the key `devices`), so they save and load with
 * the blocks, in local storage and in a project file, and the generated
 * Python starts with one line per device, in make's own words
 * (`arm = drive_motor(port=0)`, from make import *).
 */

import { serialization } from 'blockly'

/** The drive ports, for DC motors with encoders. */
const DRIVE_PORTS = ['0', '1', '2', '3']

const DIRECTIONS = [
    ['clockwise ↻', '1'],
    ['counter-clockwise ↺', '-1'],
]

/**
 * A device's port and direction, each one its kind allows.
 * @param {object} kind
 * @param {object} device As saved or typed.
 * @returns {{port: string, direction?: string}}
 */
const cleanPortAndDirection = (kind, device) => {
    const port = kind.ports.includes(String(device.port))
        ? String(device.port)
        : kind.ports[0]
    if (!kind.directions) {
        return { port }
    }
    const directions = kind.directions.map(([, value]) => value)
    return {
        port,
        direction: directions.includes(String(device.direction))
            ? String(device.direction)
            : directions[0],
    }
}

/** `, direction=-1` for a reversed motor, nothing otherwise. */
const directionArgument = (direction) =>
    direction === '-1' ? ', direction=-1' : ''

/**
 * The kinds of device there are. Each has a label, the cheatsheet entry its
 * help button opens, its ports, the fields it has besides its name, the
 * name a new one starts with, how it is written in Python, and how a saved
 * one is cleaned.
 */
export const deviceKinds = {
    drive_motor: {
        label: 'drive motor',
        help: 'motorSpin',
        base: 'motor',
        ports: DRIVE_PORTS,
        directions: DIRECTIONS,
        fields: ['port', 'direction'],
        code: ({ name, port, direction }) =>
            `${name} = drive_motor(port=${port}${directionArgument(direction)})`,
        clean(device) {
            return cleanPortAndDirection(this, device)
        },
    },
    drivetrain: {
        label: 'drivetrain',
        help: 'driveFor',
        base: 'robot',
        /** Made from drive motors, so it is set up after them. */
        order: 1,
        fields: ['motors'],
        /**
         * `robot = drivetrain(left, right)`: the motors in order, the
         * first, third... on the left and the second, fourth... on the
         * right.
         */
        code: ({ name, motors }) =>
            // a motor not picked yet is left out (the Issues list has it)
            `${name} = drivetrain(${motors.filter(Boolean).join(', ')})`,
        /**
         * @param {object} device As saved or typed. A motor group (make's
         *     motor_group, from before drivetrain came back) loads as a
         *     drivetrain of its motors, its ratios dropped; an older
         *     drivetrain saved with `left` and `right` loads as those two.
         * @returns {{motors: string[]}} Its motors by name, in order (blank
         *     when none is picked).
         */
        clean(device) {
            const motors = Array.isArray(device.motors)
                ? device.motors
                : [device.left, device.right]
            return {
                motors: motors.map((motor) =>
                    cleanName(typeof motor === 'object' ? motor?.name : motor),
                ),
            }
        },
    },
    variable: {
        label: 'variable',
        help: 'varSet',
        base: 'count',
        /** Set after the devices, last at the top of the program. */
        order: 2,
        fields: ['value'],
        code: ({ name, value }) => `${name} = ${value}`,
        /**
         * @param {object} device As saved or typed.
         * @returns {{value: string}} The number it starts at.
         */
        clean(device) {
            const value = Number(device.value)
            return { value: Number.isFinite(value) ? String(value) : '0' }
        },
    },
}

/** The devices of each workspace. */
const devicesByWorkspace = new WeakMap()
/** @type {Set<(workspace: object) => void>} Told when a workspace's devices change. */
const watchers = new Set()

const notify = (workspace) => {
    for (const watcher of watchers) {
        watcher(workspace)
    }
}

/**
 * @param {object} workspace A Blockly workspace.
 * @returns {object[]} Its devices, in order; empty when it has none.
 */
export const getDevices = (workspace) => devicesByWorkspace.get(workspace) ?? []

/**
 * Replaces a workspace's devices and tells the watchers.
 * @param {object} workspace A Blockly workspace.
 * @param {object[]} devices The devices, each { kind, name, ...the kind's fields }.
 */
export const setDevices = (workspace, devices) => {
    devicesByWorkspace.set(workspace, devices.map(cleanDevice).filter(Boolean))
    notify(workspace)
}

/**
 * Runs a function whenever any workspace's devices change, including when
 * they are loaded with a program.
 * @param {(workspace: object) => void} watcher
 * @returns {() => void} Stops watching.
 */
export const watchDevices = (watcher) => {
    watchers.add(watcher)
    return () => watchers.delete(watcher)
}

/**
 * Makes a learner's name a Python name: spaces become underscores, anything
 * else that is not a letter, digit or underscore goes, and a name cannot
 * start with a digit.
 * @param {string} name
 * @returns {string} The cleaned name; empty if nothing usable was typed.
 */
export const cleanName = (name) =>
    String(name ?? '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\p{L}\p{N}_]/gu, '')
        .replace(/^\d+/, '')

/**
 * Device kinds by an old name: for a while make called a drivetrain a
 * motor group (motor_group(motors, ratios)).
 */
export const OLD_KINDS = { motor_group: 'drivetrain' }

/**
 * Checks one device as saved or typed, filling in anything missing.
 * @param {object} device
 * @returns {object|null} The device, or null if it is not one we know.
 */
export const cleanDevice = (device) => {
    const kindName = OLD_KINDS[device?.kind] ?? device?.kind
    const kind = deviceKinds[kindName]
    if (!kind) {
        return null
    }
    return {
        kind: kindName,
        name: cleanName(device.name),
        ...kind.clean(device),
    }
}

/**
 * A name for a new device that no device has yet: motor, motor2, motor3...
 * @param {object[]} devices The devices there are.
 * @param {string} base The name to start from.
 * @returns {string}
 */
export const nextName = (devices, base) => {
    const taken = new Set(devices.map((device) => device.name))
    if (!taken.has(base)) {
        return base
    }
    let n = 2
    while (taken.has(`${base}${n}`)) {
        n += 1
    }
    return `${base}${n}`
}

/**
 * The first of the kind's ports that no device is on yet, or the first
 * port when they are all taken.
 * @param {object[]} devices The devices there are.
 * @param {string} kindName The kind of device.
 * @returns {string}
 */
export const nextPort = (devices, kindName) => {
    const ports = deviceKinds[kindName].ports
    const taken = new Set(
        devices.filter((device) => device.port).map((device) => device.port),
    )
    return ports.find((port) => !taken.has(port)) ?? ports[0]
}

/**
 * The devices without one of them: those made from it (a drivetrain from a
 * motor) lose it and are left blank there, to be picked again.
 * @param {object[]} devices
 * @param {number} index Which device goes.
 * @returns {object[]} The devices left.
 */
export const removeDevice = (devices, index) => {
    const left = devices.filter((_, i) => i !== index)
    const name = devices[index]?.name
    // another device of the same name still stands in for it
    const gone = left.some((device) => device.name === name) ? '' : name
    return gone ? renameMotor(left, gone, '') : left
}

/**
 * The devices with a drive motor's name changed in every drivetrain made
 * from it (to blank, when the motor is gone).
 * @param {object[]} devices
 * @param {string} from The motor's old name.
 * @param {string} to Its new name.
 * @returns {object[]}
 */
export const renameMotor = (devices, from, to) =>
    devices.map((device) =>
        device.kind === 'drivetrain'
            ? {
                  ...device,
                  motors: device.motors.map((motor) =>
                      motor === from ? to : motor,
                  ),
              }
            : device,
    )

/**
 * The Python that sets the devices up, to go between the import and the
 * blocks' code.
 * @param {object[]} devices
 * @returns {string} One line per named device and a blank line after, or
 *     nothing when there are no devices.
 */
export const devicesCode = (devices) => {
    // a drivetrain is made from motors, so the motors come first, and the
    // variables come last
    // cleaned first, so a device saved in an older shape still writes
    // today's line
    const lines = devices
        .map(cleanDevice)
        .filter((device) => device?.name)
        .sort(
            (a, b) =>
                (deviceKinds[a.kind].order ?? 0) -
                (deviceKinds[b.kind].order ?? 0),
        )
        .map((device) => deviceKinds[device.kind].code(device))
    return lines.length ? lines.join('\n') + '\n\n' : ''
}

// Devices are saved and loaded with the rest of the workspace. A higher
// priority than Blockly's own serializers means they load before the blocks
// and are cleared after them.
serialization.registry.register('devices', {
    priority: 110,
    save: (workspace) => {
        const devices = getDevices(workspace)
        return devices.length ? devices : null
    },
    load: (state, workspace) => {
        setDevices(workspace, Array.isArray(state) ? state : [])
    },
    clear: (workspace) => {
        if (getDevices(workspace).length) {
            setDevices(workspace, [])
        }
    },
})
