/*
 * Disable mode (src/mods/clickModes.js): a click turns a block off, and a
 * second click turns it back on. An off block writes no Python.
 */
import { describe, expect, test } from 'vitest'
import { pythonGenerator } from 'blockly/python'

import { toggleBlockDisabled } from '../src/mods/clickModes'
import { block, num, stack, workspaceOf } from './program'

const code = (workspace) => pythonGenerator.workspaceToCode(workspace).trim()

describe('toggleBlockDisabled', () => {
    test('turns a block off, then back on', () => {
        const workspace = workspaceOf([block('wait', { time: 1 })])
        const wait = workspace.getTopBlocks()[0]
        toggleBlockDisabled(wait)
        expect(wait.isEnabled()).toBe(false)
        expect(code(workspace)).toBe('')
        toggleBlockDisabled(wait)
        expect(wait.isEnabled()).toBe(true)
        expect(code(workspace)).toBe('wait(seconds=1)')
        workspace.dispose()
    })

    test('an off block in a stack leaves the others in', () => {
        const workspace = workspaceOf([
            stack(block('wait', { time: 1 }), block('wait', { time: 2 })),
        ])
        const [first] = workspace.getTopBlocks()
        toggleBlockDisabled(first.getNextBlock())
        expect(code(workspace)).toBe('wait(seconds=1)')
        workspace.dispose()
    })

    test('a click on a number turns off the block it is in', () => {
        const workspace = workspaceOf([block('wait', { time: 1 })])
        const wait = workspace.getTopBlocks()[0]
        const number = wait.getChildren().find((child) => child.isShadow())
        expect(number).toBeTruthy()
        toggleBlockDisabled(number)
        expect(wait.isEnabled()).toBe(false)
        workspace.dispose()
    })

})
