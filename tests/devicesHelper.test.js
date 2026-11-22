/*
 * Devices (src/helpers/devicesHelper.js): what a removed motor leaves
 * behind, blank motors on a drivetrain, and old saves.
 */
import { describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'

import { setBlockSet, splice } from '../src/libraries/engine'
import { make } from '../src/libraries/make/index'
import {
    devicesCode,
    nextPort,
    getDevices,
    removeDevice,
    setDevices,
} from '../src/helpers/devicesHelper'

// the device kinds come from the libraries
setBlockSet(splice([make]))

const motor = (name, port = '0') => ({
    kind: 'drive_motor',
    name,
    port,
    direction: '1',
})
/** A drivetrain of these motors, in order. */
const drivetrain = (name, ...motors) => ({ kind: 'drivetrain', name, motors })

/** The devices as they load. */
const loaded = (devices) => {
    const workspace = new Blockly.Workspace()
    setDevices(workspace, devices)
    const result = getDevices(workspace)
    workspace.dispose()
    return result
}

describe('removeDevice', () => {
    test('a drivetrain loses a removed motor and is left blank there', () => {
        const devices = [
            motor('left', '0'),
            motor('right', '1'),
            drivetrain('base', 'left', 'right'),
        ]
        expect(removeDevice(devices, 0)).toEqual([
            motor('right', '1'),
            drivetrain('base', '', 'right'),
        ])
    })

    test('both sides go blank when they used the same motor', () => {
        const devices = [motor('m'), drivetrain('base', 'm', 'm')]
        expect(removeDevice(devices, 0)).toEqual([drivetrain('base', '', '')])
    })

    test('another device of the same name keeps the drivetrain linked', () => {
        const devices = [
            motor('left', '0'),
            motor('left', '1'),
            drivetrain('base', 'left', 'left'),
        ]
        expect(removeDevice(devices, 0)).toEqual([
            motor('left', '1'),
            drivetrain('base', 'left', 'left'),
        ])
    })

    test('removing a drivetrain leaves the motors as they are', () => {
        const devices = [motor('a'), drivetrain('base', 'a', 'a')]
        expect(removeDevice(devices, 1)).toEqual([motor('a')])
    })

    test('the list it was given is not changed', () => {
        const devices = [motor('a'), drivetrain('base', 'a', 'a')]
        removeDevice(devices, 0)
        expect(devices[1].motors[0]).toBe('a')
    })
})

describe('drivetrain motors', () => {
    test('stay blank when set, not filled in with a stand-in name', () => {
        expect(loaded([drivetrain('base', '', '')])[0].motors).toEqual(['', ''])
    })

    test('an old drivetrain with no motors loads with two blank ones', () => {
        expect(
            loaded([{ kind: 'drivetrain', name: 'base' }])[0].motors,
        ).toEqual(['', ''])
    })

    test('an old drivetrain saved with left, right and drift loads as those two motors', () => {
        expect(
            loaded([
                {
                    kind: 'drivetrain',
                    name: 'base',
                    left: 'l',
                    right: 'r',
                    drift: '0.9',
                },
            ]),
        ).toEqual([{ kind: 'drivetrain', name: 'base', motors: ['l', 'r'] }])
    })

    test('a motor group loads as a drivetrain of its motors, its ratios dropped', () => {
        expect(
            loaded([
                {
                    kind: 'motor_group',
                    name: 'turn',
                    motors: [
                        { name: 'l', ratio: '1' },
                        { name: 'r', ratio: '-1' },
                        { name: 'b', ratio: '0.5' },
                    ],
                },
            ]),
        ).toEqual([
            { kind: 'drivetrain', name: 'turn', motors: ['l', 'r', 'b'] },
        ])
    })

    test('the motors come first in the Python', () => {
        expect(
            devicesCode([
                drivetrain('base', 'a', 'b'),
                motor('a'),
                motor('b', '1'),
            ]),
        ).toBe(
            'a = drive_motor(port=0)\n' +
                'b = drive_motor(port=1)\n' +
                'base = drivetrain(a, b)\n\n',
        )
    })
})

describe('every kind of device', () => {
    test("writes its line in make's words", () => {
        expect(
            devicesCode([
                { kind: 'variable', name: 'count', value: '3' },
                {
                    kind: 'drive_motor',
                    name: 'arm',
                    port: '0',
                    direction: '-1',
                },
                drivetrain('robot', 'l', 'r'),
                drivetrain('four', 'fl', 'fr', 'bl', 'br'),
                // a motor not picked yet is left out
                drivetrain('half', 'l', ''),
                // a motor group saved before it was a drivetrain again
                {
                    kind: 'motor_group',
                    name: 'old',
                    motors: [
                        { name: 'l', ratio: '1' },
                        { name: 'r', ratio: '-1' },
                    ],
                },
            ]),
        ).toBe(
            'arm = drive_motor(port=0, direction=-1)\n' +
                'robot = drivetrain(l, r)\n' +
                'four = drivetrain(fl, fr, bl, br)\n' +
                'half = drivetrain(l)\n' +
                'old = drivetrain(l, r)\n' +
                'count = 3\n\n',
        )
    })

    test('a new drive motor takes the first free port', () => {
        expect(
            nextPort([motor('a', '0'), motor('b', '1')], ['0', '1', '2', '3']),
        ).toBe('2')
        expect(nextPort([], ['0', '1', '2', '3'])).toBe('0')
    })

    test('a drive motor on a port the board lacks moves to port 0 when loaded', () => {
        expect(loaded([motor('arm', '9')])[0]).toMatchObject({ port: '0' })
    })

    test('a kind the editor has no more (a servo) is dropped when loaded', () => {
        expect(
            loaded([
                { kind: 'servo', name: 'claw', port: '4' },
                motor('arm'),
            ]).map((d) => d.name),
        ).toEqual(['arm'])
    })
})
