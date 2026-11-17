/*
 * Devices (src/helpers/devicesHelper.js): what a removed motor leaves
 * behind, and blank motors on a motor group.
 */
import { describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'

import {
    devicesCode,
    nextPort,
    getDevices,
    removeDevice,
    setDevices,
} from '../src/helpers/devicesHelper'

const motor = (name, port = '0') => ({
    kind: 'drive_motor',
    name,
    port,
    direction: '1',
})
/** A motor group of these motors, each at ratio 1 unless given as [name, ratio]. */
const motorGroup = (name, ...motors) => ({
    kind: 'motor_group',
    name,
    motors: motors.map((m) =>
        Array.isArray(m)
            ? { name: m[0], ratio: m[1] }
            : { name: m, ratio: '1' },
    ),
})

describe('removeDevice', () => {
    test('a motor group loses a removed motor and is left blank there', () => {
        const devices = [
            motor('left', '0'),
            motor('right', '1'),
            motorGroup('base', 'left', 'right'),
        ]
        expect(removeDevice(devices, 0)).toEqual([
            motor('right', '1'),
            motorGroup('base', '', 'right'),
        ])
    })

    test('both sides go blank when they used the same motor', () => {
        const devices = [motor('m'), motorGroup('base', 'm', 'm')]
        expect(removeDevice(devices, 0)).toEqual([motorGroup('base', '', '')])
    })

    test('another device of the same name keeps the motor group linked', () => {
        const devices = [
            motor('left', '0'),
            motor('left', '1'),
            motorGroup('base', 'left', 'left'),
        ]
        expect(removeDevice(devices, 0)).toEqual([
            motor('left', '1'),
            motorGroup('base', 'left', 'left'),
        ])
    })

    test('removing a motor group leaves the motors as they are', () => {
        const devices = [motor('a'), motorGroup('base', 'a', 'a')]
        expect(removeDevice(devices, 1)).toEqual([motor('a')])
    })

    test('the list it was given is not changed', () => {
        const devices = [motor('a'), motorGroup('base', 'a', 'a')]
        removeDevice(devices, 0)
        expect(devices[1].motors[0].name).toBe('a')
    })
})

describe('blank motor group motors', () => {
    test('stay blank when set, not filled in with a stand-in name', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [motorGroup('base', '', '')])
        expect(getDevices(workspace)[0].motors).toEqual([
            { name: '', ratio: '1' },
            { name: '', ratio: '1' },
        ])
        workspace.dispose()
    })

    test('a missing motor loads blank', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [{ kind: 'drivetrain', name: 'base' }])
        expect(getDevices(workspace)[0].motors).toEqual([
            { name: '', ratio: '1' },
            { name: '', ratio: '1' },
        ])
        workspace.dispose()
    })

    test('an old drivetrain saved with left, right and drift loads as a motor group of two motors', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [
            {
                kind: 'drivetrain',
                name: 'base',
                left: 'l',
                right: 'r',
                drift: '0.9',
            },
        ])
        expect(getDevices(workspace)[0].kind).toBe('motor_group')
        expect(getDevices(workspace)[0].motors).toEqual([
            { name: 'l', ratio: '1' },
            { name: 'r', ratio: '0.9' },
        ])
        workspace.dispose()
    })

    test('a ratio that is not a number loads as 1', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [motorGroup('base', ['a', 'x'], ['b', '-1'])])
        expect(getDevices(workspace)[0].motors).toEqual([
            { name: 'a', ratio: '1' },
            { name: 'b', ratio: '-1' },
        ])
        workspace.dispose()
    })

    test('the motors come first in the Python', () => {
        expect(
            devicesCode([
                motorGroup('base', 'a', 'b'),
                motor('a'),
                motor('b', '1'),
            ]),
        ).toBe(
            'a = drive_motor(port=0)\n' +
                'b = drive_motor(port=1)\n' +
                'base = motor_group([a, b])\n\n',
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
                motorGroup('robot', 'l', 'r'),
                motorGroup('turn', 'l', ['r', '-1']),
                motorGroup('lift', ['a', '2'], 'b', ['c', '0.5']),
            ]),
        ).toBe(
            'arm = drive_motor(port=0, direction=-1)\n' +
                'robot = motor_group([l, r])\n' +
                'turn = motor_group([l, r], [1, -1])\n' +
                'lift = motor_group([a, b, c], [2, 1, 0.5])\n' +
                'count = 3\n\n',
        )
    })

    test('a new drive motor takes the first free port', () => {
        expect(
            nextPort([motor('a', '0'), motor('b', '1')], 'drive_motor'),
        ).toBe('2')
        expect(nextPort([], 'drive_motor')).toBe('0')
    })

    test('a drive motor on a port the board lacks moves to port 0 when loaded', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [motor('arm', '9')])
        expect(getDevices(workspace)[0]).toMatchObject({ port: '0' })
        workspace.dispose()
    })

    test('a kind the editor has no more (a servo) is dropped when loaded', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [
            { kind: 'servo', name: 'claw', port: '4' },
            motor('arm'),
        ])
        expect(getDevices(workspace).map((d) => d.name)).toEqual(['arm'])
        workspace.dispose()
    })
})
