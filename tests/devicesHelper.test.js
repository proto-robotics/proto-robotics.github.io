/*
 * Devices (src/helpers/devicesHelper.js): what a removed motor leaves
 * behind, and blank motors on a drivetrain.
 */
import { describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'

import {
    devicesCode,
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
const drivetrain = (name, left, right) => ({
    kind: 'drivetrain',
    name,
    left,
    right,
    drift: '1',
})

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
        expect(devices[1].left).toBe('a')
    })
})

describe('blank drivetrain motors', () => {
    test('stay blank when set, not filled in with a stand-in name', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [drivetrain('base', '', '')])
        expect(getDevices(workspace)[0]).toMatchObject({ left: '', right: '' })
        workspace.dispose()
    })

    test('a missing motor loads blank', () => {
        const workspace = new Blockly.Workspace()
        setDevices(workspace, [{ kind: 'drivetrain', name: 'base' }])
        expect(getDevices(workspace)[0]).toMatchObject({
            left: '',
            right: '',
            drift: '1',
        })
        workspace.dispose()
    })

    test('the motors come first in the Python', () => {
        expect(
            devicesCode([
                drivetrain('base', 'a', 'b'),
                motor('a'),
                motor('b', '1'),
            ]),
        ).toBe(
            'a = make.drive_motor(port=0)\n' +
                'b = make.drive_motor(port=1)\n' +
                'base = make.drivetrain(a, b)\n\n',
        )
    })
})
