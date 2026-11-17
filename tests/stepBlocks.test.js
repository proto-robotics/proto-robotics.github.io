/*
 * Step blocks (src/mods/stepBlocks.js): a drag that would leave a step
 * outside every loop does not connect. The rule is tested on its own; the
 * connection checker adds it to Blockly's drag checks.
 */
import { describe, expect, test } from 'vitest'

import { looseSteps, stepConnectionAllowed } from '../src/mods/stepBlocks'
import { block, slot, workspaceOf } from './program'

/** A workspace and a way to find its blocks by a test id kept in a field-free map. */
const setup = (blocks) => {
    const ws = workspaceOf(blocks, [
        { kind: 'drive_motor', name: 'arm', port: '0', direction: '1' },
    ])
    const byType = (type) =>
        ws.getAllBlocks(false).filter((b) => b.type === type)
    return { ws, byType }
}

const step = () =>
    block('motorSpinStep', { name: 'arm', way: 'forward', power: 50 })

describe('where a step block may go', () => {
    const tops = [
        block('wait', { time: 1 }), // a top-level stack
        block(
            'forever',
            {},
            {
                input: slot(
                    block(
                        'if',
                        {},
                        { input: slot(block('wait', { time: 2 })) },
                    ),
                ),
            },
        ),
        step(), // a loose step, to drag
        block('if', {}, { input: slot(step()) }), // an If holding a step, to drag
        block('repeatFor', {}, { input: slot(step()) }), // a loop holding a step, to drag
    ]

    const cases = () => {
        const { ws, byType } = setup(tops)
        const [topWait, waitInIf] = byType('wait').sort(
            (a, b) => a.getFieldValue('time') - b.getFieldValue('time'),
        )
        const forever = byType('forever')[0]
        const [ifInLoop, ifWithStep] = byType('if').sort((a) =>
            a.getSurroundParent() ? -1 : 1,
        )
        const looseStep = byType('motorSpinStep').find((b) => !b.getParent())
        const repeat = byType('repeatFor')[0]
        return {
            ws,
            topWait,
            waitInIf,
            forever,
            ifInLoop,
            ifWithStep,
            looseStep,
            repeat,
        }
    }

    test.each([
        [
            'a step into Forever',
            (c) => [
                c.looseStep.previousConnection,
                c.forever.getInput('input').connection,
            ],
            true,
        ],
        [
            'a step into an If inside Forever',
            (c) => [
                c.looseStep.previousConnection,
                c.ifInLoop.getInput('input').connection,
            ],
            true,
        ],
        [
            'a step after a Wait inside a loop',
            (c) => [c.looseStep.previousConnection, c.waitInIf.nextConnection],
            true,
        ],
        [
            'a step under a top-level Wait',
            (c) => [c.looseStep.previousConnection, c.topWait.nextConnection],
            false,
        ],
        [
            'a step dropped above a top-level Wait',
            (c) => [c.looseStep.nextConnection, c.topWait.previousConnection],
            false,
        ],
        [
            'an If holding a step, under a top-level Wait',
            (c) => [c.ifWithStep.previousConnection, c.topWait.nextConnection],
            false,
        ],
        [
            'a Repeat holding a step, under a top-level Wait',
            (c) => [c.repeat.previousConnection, c.topWait.nextConnection],
            true,
        ],
    ])('%s', (_, pick, allowed) => {
        const c = cases()
        const [a, b] = pick(c)
        expect(stepConnectionAllowed(a, b)).toBe(allowed)
        c.ws.dispose()
    })

    test('a stack with no steps goes anywhere', () => {
        const c = cases()
        const plain = c.ws.newBlock('wait')
        expect(
            stepConnectionAllowed(
                plain.previousConnection,
                c.topWait.nextConnection,
            ),
        ).toBe(true)
        c.ws.dispose()
    })
})

describe('looseSteps', () => {
    test('finds steps no loop in the stack encloses', () => {
        const { ws, byType } = setup([
            block('if', {}, { input: slot(step()) }),
            block('forever', {}, { input: slot(step()) }),
        ])
        expect(looseSteps(byType('if')[0])).toHaveLength(1)
        expect(looseSteps(byType('forever')[0])).toHaveLength(0)
        ws.dispose()
    })
})
