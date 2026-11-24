/*
 * The toolbox fold (src/mods/toolbox.js): a second tap on the open tab hides
 * the flyout and leaves no tab selected; a tap on any tab opens it again.
 */
import { afterEach, describe, expect, test } from 'vitest'
import * as Blockly from 'blockly'
import 'blockly/blocks'

import { injectMods } from '../src/mods/mods.js'

injectMods()

let workspace
afterEach(() => {
    workspace?.dispose()
    document.body.innerHTML = ''
})

/** A workspace with the editor's toolbox and two categories. */
function editor() {
    const div = document.createElement('div')
    document.body.append(div)
    workspace = Blockly.inject(div, {
        toolbox: {
            kind: 'categoryToolbox',
            contents: [
                { kind: 'category', name: 'Time', contents: [{ kind: 'block', type: 'math_number' }] },
                { kind: 'category', name: 'Flow', contents: [{ kind: 'block', type: 'controls_if' }] },
            ],
        },
        plugins: { toolbox: 'ProtoToolbox', metricsManager: 'ContinuousMetrics', flyoutsVerticalToolbox: 'ContinuousFlyout' },
    })
    return workspace.getToolbox()
}

/** A tap on a tab, the way the toolbox hears it. */
const tap = (toolbox, item) => toolbox.onClick_({ target: item.getClickTarget?.() ?? document.getElementById(item.getId()), button: 0 })

describe('ProtoToolbox', () => {
    test('a second tap on the open tab folds the flyout; a tap on any tab opens it', () => {
        const toolbox = editor()
        const [time, flow] = toolbox.getToolboxItems()
        expect(toolbox.isFlyoutOpen()).toBe(true)
        tap(toolbox, flow)
        expect(toolbox.getSelectedItem()).toBe(flow)
        expect(toolbox.isFlyoutOpen()).toBe(true)

        tap(toolbox, flow)
        expect(toolbox.getSelectedItem()).toBe(null)
        expect(toolbox.isFlyoutOpen()).toBe(false)

        tap(toolbox, time)
        expect(toolbox.getSelectedItem()).toBe(time)
        expect(toolbox.isFlyoutOpen()).toBe(true)
    })

    test('a tap on another tab while open only moves the selection', () => {
        const toolbox = editor()
        const [time, flow] = toolbox.getToolboxItems()
        tap(toolbox, flow)
        tap(toolbox, time)
        expect(toolbox.getSelectedItem()).toBe(time)
        expect(toolbox.isFlyoutOpen()).toBe(true)
    })

    test('a folded toolbox still takes blocks dropped on its tabs', () => {
        const toolbox = editor()
        const [, flow] = toolbox.getToolboxItems()
        tap(toolbox, flow)
        tap(toolbox, flow)
        expect(toolbox.isFlyoutOpen()).toBe(false)
        // the tab column's own rectangle, not the hidden flyout's
        expect(toolbox.getClientRect()).not.toBeNull()
    })
})
