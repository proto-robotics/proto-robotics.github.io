/*
 * The devices a program sets up before its blocks run: for now drive
 * motors, each with a name, a port and a direction. They are part of the
 * workspace's state (a Blockly serializer under the key `devices`), so
 * they save and load with the blocks, in local storage and in a project
 * file, and the generated Python starts with one line per device.
 */

import { Events, Workspace, serialization } from 'blockly'

/** The kinds of device there are, with how each one is written in Python. */
export const deviceKinds = {
    drive_motor: {
        label: 'drive motor',
        /** The cheatsheet entry that explains it. */
        help: 'drive_motor',
        ports: ['0', '1', '2', '3'],
        directions: [
            ['clockwise ↻', '1'],
            ['counter-clockwise ↺', '-1'],
        ],
        /**
         * @param {{name: string, port: string, direction: string}} device
         * @returns {string} The line that creates it, as the motor block writes it.
         */
        code: ({ name, port, direction }) =>
            `${name} = make.drive_motor(port=${port}${direction === '-1' ? ', direction=-1' : ''})`,
    },
}

/**
 * The blocks that set a device up before the Devices section did, by type:
 * the kind of device each one is. Programs saved with them, and the
 * cheatsheet's examples, still have them; they are turned into devices when
 * they are loaded (liftDeviceBlocks) or pasted (adoptDeviceBlocks). The
 * fields are the device's: name, port, direction. `largemotor` is the
 * motor block's name from before the make library called it drive_motor;
 * programs saved with it load as drive motors.
 */
const deviceBlocks = { drive_motor: 'drive_motor', largemotor: 'drive_motor' }

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
 * @param {object[]} devices The devices, each { kind, name, port, direction }.
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
const cleanDevice = (device) => {
    const kind = deviceKinds[device?.kind]
    if (!kind) {
        return null
    }
    const port = kind.ports.includes(String(device.port))
        ? String(device.port)
        : kind.ports[0]
    const directions = kind.directions.map(([, value]) => value)
    const direction = directions.includes(String(device.direction))
        ? String(device.direction)
        : directions[0]
    return { kind: device.kind, name: cleanName(device.name), port, direction }
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
 * The first port of the kind that no device of the kind is on yet, or the
 * first port when they are all taken.
 * @param {object[]} devices The devices there are.
 * @param {string} kindName The kind of device.
 * @returns {string}
 */
export const nextPort = (devices, kindName) => {
    const ports = deviceKinds[kindName].ports
    const taken = new Set(
        devices
            .filter((device) => device.kind === kindName)
            .map((device) => device.port),
    )
    return ports.find((port) => !taken.has(port)) ?? ports[0]
}

/**
 * The Python that sets the devices up, to go between the imports and the
 * blocks' code.
 * @param {object[]} devices
 * @returns {string} One line per named device and a blank line after, or
 *     nothing when there are no devices.
 */
export const devicesCode = (devices) => {
    const lines = devices
        .filter((device) => device.name)
        .map((device) => deviceKinds[device.kind].code(device))
    return lines.length ? lines.join('\n') + '\n\n' : ''
}

/**
 * Adds a device to a list unless one of the name is there already.
 * @param {object[]} devices
 * @param {object} device
 */
const addDevice = (devices, device) => {
    if (device.name && !devices.some((other) => other.name === device.name)) {
        devices.push(device)
    }
}

/**
 * Takes the device-setting blocks out of a saved program and puts them
 * among its devices. The rest of each stack keeps its place.
 * @param {object} state A serialized workspace.
 * @returns {object} The state with no such blocks, or the same state if it
 *     had none.
 */
export const liftDeviceBlocks = (state) => {
    const tops = state?.blocks?.blocks
    if (!Array.isArray(tops)) {
        return state
    }
    const devices = [...(state.devices ?? [])]
    let found = false

    const strip = (blockState) => {
        if (!blockState) {
            return blockState
        }
        if (deviceBlocks[blockState.type]) {
            found = true
            const fields = blockState.fields ?? {}
            addDevice(devices, {
                kind: deviceBlocks[blockState.type],
                name: cleanName(fields.name),
                port: fields.port,
                direction: fields.direction,
            })
            const rest = strip(blockState.next?.block)
            if (!rest || blockState.x === undefined) {
                return rest
            }
            // the rest of a top stack takes the block's place
            return { ...rest, x: blockState.x, y: blockState.y }
        }
        const stripped = { ...blockState }
        if (blockState.inputs) {
            stripped.inputs = Object.fromEntries(
                Object.entries(blockState.inputs).map(([name, input]) =>
                    input.block
                        ? [name, { ...input, block: strip(input.block) }]
                        : [name, input],
                ),
            )
        }
        if (blockState.next?.block) {
            const rest = strip(blockState.next.block)
            if (rest) {
                stripped.next = { block: rest }
            } else {
                delete stripped.next
            }
        }
        return stripped
    }

    const blocks = tops.map(strip).filter(Boolean)
    if (!found) {
        return state
    }
    return { ...state, devices, blocks: { ...state.blocks, blocks } }
}

/**
 * A workspace change listener: a device-setting block that turns up on the
 * workspace (pasted, say) becomes a device, and the stack it headed closes
 * up over it.
 * @param {object} event A workspace event.
 */
export const adoptDeviceBlocks = (event) => {
    if (event.type !== Events.BLOCK_CREATE) {
        return
    }
    const workspace = Workspace.getById(event.workspaceId)
    if (!workspace || workspace.isFlyout || workspace.isDragging()) {
        return
    }
    const blocks = (event.ids ?? [])
        .map((id) => workspace.getBlockById(id))
        .filter((block) => block && deviceBlocks[block.type])
    if (!blocks.length) {
        return
    }
    const devices = [...getDevices(workspace)]
    // one undo takes back the paste and this together
    Events.setGroup(event.group || true)
    try {
        for (const block of blocks) {
            addDevice(devices, {
                kind: deviceBlocks[block.type],
                name: cleanName(block.getFieldValue('name')),
                port: block.getFieldValue('port'),
                direction: block.getFieldValue('direction'),
            })
            const next = block.getNextBlock()
            const place = block.getRelativeToSurfaceXY()
            block.dispose(true)
            if (next && !next.getParent() && !next.isDisposed()) {
                const was = next.getRelativeToSurfaceXY()
                next.moveBy(place.x - was.x, place.y - was.y)
            }
        }
    } finally {
        Events.setGroup(false)
    }
    setDevices(workspace, devices)
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
