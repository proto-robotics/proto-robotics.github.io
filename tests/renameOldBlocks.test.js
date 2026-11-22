/*
 * Programs saved while make's drivetrain was a motor group still load:
 * their old block types are renamed (src/helpers/renamedBlocks.js).
 */
import { describe, expect, test } from 'vitest'

import { currentBlockType, renameOldBlocks } from '../src/helpers/renamedBlocks'
import { setBlockSet, splice } from '../src/libraries/engine'
import { make } from '../src/libraries/make/index'

// the renames come from the libraries
setBlockSet(splice([make]))

const group = (name, ...ratios) => ({
    kind: 'motor_group',
    name,
    motors: ratios.map((ratio, i) => ({ name: `m${i}`, ratio })),
})

describe('renameOldBlocks', () => {
    test('renames motor group blocks to Drive, at the top, inside loops and below', () => {
        const state = {
            devices: [group('robot', '1', '1')],
            blocks: {
                languageVersion: 0,
                blocks: [
                    {
                        type: 'repeatFor',
                        inputs: {
                            input: {
                                block: {
                                    type: 'groupSpinStep',
                                    fields: { name: 'robot', way: 'forward' },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'groupStop',
                                fields: { name: 'robot' },
                            },
                        },
                    },
                    { type: 'groupSpin', fields: { name: 'robot' } },
                ],
            },
        }
        const renamed = renameOldBlocks(state)
        const [loop, loose] = renamed.blocks.blocks
        expect(loop.type).toBe('repeatFor')
        expect(loop.inputs.input.block.type).toBe('driveStep')
        expect(loop.next.block.type).toBe('drivetrainStop')
        expect(loose.type).toBe('driveFor')
        expect(loose.fields).toEqual({ name: 'robot' })
    })

    test.each([
        [['1', '-1'], 'forward', 'right'],
        [['1', '-1'], 'backward', 'left'],
        [['-1', '1'], 'forward', 'left'],
        [['0.5', '-0.5', '0.5', '-0.5'], 'forward', 'right'],
    ])(
        'a motor group with ratios %o spun %s becomes a Turn %s',
        (ratios, way, turn) => {
            const state = {
                devices: [group('turn', ...ratios)],
                blocks: {
                    languageVersion: 0,
                    blocks: [
                        {
                            type: 'groupSpin',
                            fields: { name: 'turn', way, amount: 200 },
                        },
                    ],
                },
            }
            const [renamed] = renameOldBlocks(state).blocks.blocks
            expect(renamed.type).toBe('turnFor')
            expect(renamed.fields).toEqual({
                name: 'turn',
                way: turn,
                amount: 200,
            })
        },
    )

    test('a motor group with uneven ratios drives', () => {
        const state = {
            devices: [group('drift', '1', '0.9')],
            blocks: {
                languageVersion: 0,
                blocks: [{ type: 'groupSpin', fields: { name: 'drift' } }],
            },
        }
        expect(renameOldBlocks(state).blocks.blocks[0].type).toBe('driveFor')
    })

    test('leaves a state with no blocks alone', () => {
        expect(renameOldBlocks(null)).toBe(null)
        expect(renameOldBlocks({ devices: [] })).toEqual({ devices: [] })
    })

    test('names a task gives in old words are brought up to date', () => {
        expect(currentBlockType('motor_group')).toBe('drivetrain')
        expect(currentBlockType('groupSpin')).toBe('driveFor')
        expect(currentBlockType('motorSpin')).toBe('motorSpin')
    })
})
