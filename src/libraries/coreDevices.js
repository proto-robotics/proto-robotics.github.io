/*
 * The core library's devices: what a program sets up before its blocks
 * run. Each kind holds everything the editor needs about it: its label and
 * picture, the cheatsheet entry its help button opens, the name a new one
 * starts with, its ports and directions, how it is written in Python, how a
 * saved one is cleaned, what a new one looks like, and the middle of its
 * card in the Devices pop-up. Nothing else in the editor knows a kind by
 * name: a library can bring new ones.
 */

import { button, div, on, tag } from 'ellipsi'

import { asset, categoryIcon } from '../assets'
import { cleanName, nextName, nextPort } from '../helpers/devicesHelper'
import { numberBox, select } from './deviceCardParts'

/** The drive ports, for DC motors with encoders. */
const DRIVE_PORTS = ['0', '1', '2', '3']

const DIRECTIONS = [
    ['clockwise ↻', '1'],
    ['counter-clockwise ↺', '-1'],
]

/** `, direction=-1` for a reversed motor, nothing otherwise. */
const directionArgument = (direction) =>
    direction === '-1' ? ', direction=-1' : ''

/** The drive motors among a program's devices, by name. */
const motorNames = (devices) =>
    devices
        .filter((device) => device.kind === 'drive_motor' && device.name)
        .map((device) => device.name)

/**
 * A drivetrain's motors, a line each, picked from the program's drive
 * motors: the first, third... are its left wheels and the second,
 * fourth... its right. Each line has a button that takes the motor out,
 * while there are more than two, and a last button adds one.
 */
const drivetrainCard = (device, change, { devices = [] } = {}) => {
    const motors = motorNames(devices)
    const list = device.motors
    const setMotors = (next) => change({ motors: next })
    // one no longer there is kept and shown, and with none picked the
    // choice is blank
    const motorChoices = (current) => {
        const names = [...new Set([...motors, current].filter(Boolean))]
        const choices = names.map((name) => [name, name])
        return current ? choices : [['', ''], ...choices]
    }
    const lines = list.map((motor, i) => {
        const side = i % 2 === 0 ? 'left' : 'right'
        const Motor = select(
            motorChoices(motor),
            motor,
            (name) => setMotors(list.map((m, j) => (j === i ? name : m))),
            `Motor ${i + 1}, ${side}`,
        )
        // a blank motor, or one that is not a drive motor (any more), is
        // marked, as the Issues list has it (blockLinter.js)
        if (!motors.includes(motor)) {
            Motor.setAttribute('aria-invalid', 'true')
        }
        return div(
            { class: 'toolbox-device-motor' },
            Motor,
            tag('span', side),
            // make needs at least two; null, not false, which would show as text
            list.length > 2
                ? button(
                      '×',
                      {
                          type: 'button',
                          class: 'toolbox-device-motor-remove',
                          'aria-label': `Take ${motor || 'this motor'} out`,
                          title: 'Take this motor out',
                      },
                      on('click', () =>
                          setMotors(list.filter((_, j) => j !== i)),
                      ),
                  )
                : null,
        )
    })
    const unused = motors.find((name) => !list.includes(name))
    return [
        tag('span', 'is a drivetrain of'),
        ...lines,
        button(
            '+ Add a motor',
            { type: 'button', class: 'toolbox-device-motor-add' },
            on('click', () => setMotors([...list, unused ?? ''])),
        ),
    ]
}

/** @type {Record<string, import('./engine').DeviceKind>} */
export const DEVICE_KINDS = {
    drive_motor: {
        label: 'drive motor',
        group: 'devices',
        help: 'motorSpin',
        base: 'motor',
        preview: 'arm',
        picture: asset('images/devices/drive-motor-cartoon.png'),
        ports: DRIVE_PORTS,
        directions: DIRECTIONS,
        code: ({ name, port, direction }) =>
            `${name} = drive_motor(port=${port}${directionArgument(direction)})`,
        clean(device) {
            const port = DRIVE_PORTS.includes(String(device.port))
                ? String(device.port)
                : DRIVE_PORTS[0]
            const values = DIRECTIONS.map(([, value]) => value)
            const direction = values.includes(String(device.direction))
                ? String(device.direction)
                : values[0]
            return { port, direction }
        },
        fresh: (devices) => ({
            kind: 'drive_motor',
            name: nextName(devices, 'motor'),
            port: nextPort(devices, DRIVE_PORTS),
            direction: '1',
        }),
        card: (device, change) => [
            tag('span', 'is a drive motor on port'),
            select(
                DRIVE_PORTS.map((port) => [port, port]),
                device.port,
                (port) => change({ port }),
                'Port',
            ),
            tag('span', 'in direction'),
            select(
                DIRECTIONS,
                device.direction,
                (direction) => change({ direction }),
                'Direction',
            ),
        ],
    },
    drivetrain: {
        label: 'drivetrain',
        group: 'devices',
        help: 'driveFor',
        base: 'robot',
        preview: 'robot',
        picture: asset('images/devices/drivetrain-cartoon.png'),
        /** Made from drive motors, so it is set up after them. */
        order: 1,
        /**
         * `robot = drivetrain(left, right)`: the motors in order, the
         * first, third... on the left and the second, fourth... on the
         * right. A motor not picked yet is left out (the Issues list has it).
         */
        code: ({ name, motors }) =>
            `${name} = drivetrain(${motors.filter(Boolean).join(', ')})`,
        /**
         * Its motors by name, in order (blank when none is picked). An older
         * drivetrain saved with `left` and `right` loads as those two, and a
         * motor group's motors (objects) by their names.
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
        fresh: (devices) => {
            const motors = motorNames(devices)
            return {
                kind: 'drivetrain',
                name: nextName(devices, 'robot'),
                // the first two drive motors, left and right
                motors: [motors[0] ?? '', motors[1] ?? ''],
            }
        },
        card: drivetrainCard,
        /** A drive motor renamed or removed changes in every drivetrain made from it. */
        renameMotor: (device, from, to) => ({
            ...device,
            motors: device.motors.map((motor) => (motor === from ? to : motor)),
        }),
    },
    variable: {
        label: 'variable',
        group: 'variables',
        help: 'varSet',
        base: 'count',
        picture: categoryIcon('variables'),
        /** Set after the devices, last at the top of the program. */
        order: 2,
        code: ({ name, value }) => `${name} = ${value}`,
        clean(device) {
            const value = Number(device.value)
            return { value: Number.isFinite(value) ? String(value) : '0' }
        },
        fresh: (devices) => ({
            kind: 'variable',
            name: nextName(devices, 'count'),
            value: '0',
        }),
        card: (device, change) => [
            tag('span', 'is a variable that starts at'),
            numberBox(device.value, (value) => change({ value }), 'Starts at'),
        ],
    },
}
