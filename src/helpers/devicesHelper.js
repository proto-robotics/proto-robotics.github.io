/*
 * The devices a program sets up before its blocks run, each a name and
 * what its kind needs (a drive motor its port and direction, a variable
 * the number it starts at); the kinds come from the libraries. They are
 * part of the workspace's state (a
 * Blockly serializer under the key `devices`), so they save and load with
 * the blocks, in local storage and in a project file, and the generated
 * Python starts with one line per device, in make's own words
 * (`arm = drive_motor(port=0)`, from make import *).
 */

import { serialization } from 'blockly'

/**
 * The kinds of device there are, by name, from every library spliced on
 * the page (src/libraries/engine.js fills it in; each library brings its
 * own, see src/libraries/core/devices.js). Nothing here knows a kind.
 * @type {Record<string, import('../libraries/engine').DeviceKind>}
 */
export const deviceKinds = {}

/** Device kinds by an old name, from the libraries' renames. */
export const deviceRenames = {}

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
 * Checks one device as saved or typed, filling in anything missing.
 * @param {object} device
 * @returns {object|null} The device, or null if it is not one we know.
 */
export const cleanDevice = (device) => {
    const kindName = deviceRenames[device?.kind] ?? device?.kind
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
 * The first of these ports that no device is on yet, or the first port
 * when they are all taken.
 * @param {object[]} devices The devices there are.
 * @param {string[]} ports A kind's ports.
 * @returns {string}
 */
export const nextPort = (devices, ports) => {
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
 * The devices with a device's name changed in every device made from it,
 * such as a drivetrain from its motors (to blank, when it is gone). Each
 * kind says how, with its `renameMotor`.
 * @param {object[]} devices
 * @param {string} from The old name.
 * @param {string} to The new name.
 * @returns {object[]}
 */
export const renameMotor = (devices, from, to) =>
    devices.map(
        (device) => deviceKinds[device.kind]?.renameMotor?.(device, from, to) ?? device,
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
