/*
 * A block the editor does not have loads as a stand-in that keeps it
 * (src/libraries/unknownBlocks.js): nothing is lost, the program says
 * which block cannot run here, and an editor that has it loads it again.
 */
import { describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'

import { defineBlocks } from './program'
import { standInForUnknown, UNKNOWN_BLOCK, UNKNOWN_VALUE, unknownMessage } from '../src/libraries/unknownBlocks'
import { lintBlocks } from '../src/mods/blockLinter'

defineBlocks()

const known = (types) => (type) => Boolean(Blockly.Blocks[type]) && types.has(type)
const program = (blocks) => ({ blocks: { languageVersion: 0, blocks } })

describe('stand-ins', () => {
    const forward = { type: 'forward', fields: { squares: 2 } }

    test('a block the editor lacks becomes a stand-in that keeps it, with the blocks under it still real', () => {
        const state = program([{ ...forward, x: 10, y: 20, next: { block: { type: 'wait' } } }])
        const [top] = standInForUnknown(state, known(new Set(['wait']))).blocks.blocks
        expect(top.type).toBe(UNKNOWN_BLOCK)
        expect(top.extraState.original).toEqual(forward)
        expect(top.x).toBe(10)
        expect(top.next.block.type).toBe('wait')
    })

    test('one in a slot stands in as a value', () => {
        const state = program([{ type: 'if', inputs: { function: { block: { type: 'carAtFlag' } } } }])
        const [top] = standInForUnknown(state, known(new Set(['if']))).blocks.blocks
        expect(top.inputs.function.block.type).toBe(UNKNOWN_VALUE)
    })

    test('an editor that has the block loads the real one again', () => {
        const hidden = standInForUnknown(program([forward]), known(new Set(['wait'])))
        const back = standInForUnknown(hidden, () => true)
        expect(back.blocks.blocks[0]).toEqual(forward)
    })

    test('the linter says the block cannot run here', () => {
        const workspace = new Blockly.Workspace()
        Blockly.serialization.workspaces.load(standInForUnknown(program([forward]), known(new Set())), workspace)
        const messages = lintBlocks(workspace).map((problem) => problem.message)
        expect(messages).toContain(unknownMessage('forward'))
        // and it saves the block it keeps
        expect(Blockly.serialization.workspaces.save(workspace).blocks.blocks[0].extraState.original).toEqual(forward)
        workspace.dispose()
    })
})
