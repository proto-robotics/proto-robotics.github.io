/*
 * Programs saved before make's drivetrain became motor_group still load:
 * their old block types are renamed (src/helpers/renamedBlocks.js).
 */
import { describe, expect, test } from 'vitest'

import { renameOldBlocks } from '../src/helpers/renamedBlocks'

describe('renameOldBlocks', () => {
    test('renames old drivetrain blocks, at the top, inside loops and below', () => {
        const state = {
            blocks: {
                languageVersion: 0,
                blocks: [
                    {
                        type: 'repeatFor',
                        inputs: {
                            input: {
                                block: {
                                    type: 'driveStep',
                                    fields: { name: 'robot' },
                                },
                            },
                        },
                        next: {
                            block: {
                                type: 'drivetrainStop',
                                fields: { name: 'robot' },
                            },
                        },
                    },
                    { type: 'driveFor', fields: { name: 'robot' } },
                ],
            },
        }
        const renamed = renameOldBlocks(state)
        const [loop, loose] = renamed.blocks.blocks
        expect(loop.type).toBe('repeatFor')
        expect(loop.inputs.input.block.type).toBe('groupSpinStep')
        expect(loop.next.block.type).toBe('groupStop')
        expect(loose.type).toBe('groupSpin')
        expect(loose.fields).toEqual({ name: 'robot' })
    })

    test('leaves a state with no blocks alone', () => {
        expect(renameOldBlocks(null)).toBe(null)
        expect(renameOldBlocks({ devices: [] })).toEqual({ devices: [] })
    })
})
