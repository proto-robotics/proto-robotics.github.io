/*
 * Click modes: what a click on a block does. Normal picks it; Multi-select
 * (the plugin's icon over the canvas) picks more than one; Disable (a
 * button by Note) turns the block off or back on, so it is left out of the
 * program without being deleted. One mode at a time: turning one on turns
 * the other off. A toast says which mode clicks are in after each change.
 */

import * as Blockly from 'blockly'
import { button, on, tag } from 'ellipsi'
import { inMultipleSelectionModeWeakMap } from '@mit-app-inventor/blockly-plugin-workspace-multiselect'

import { showToast } from '../helpers/toastHelper'
import { dragLocks } from './mods'

/** What the toast says for each mode. */
const MODE_TOASTS = {
    normal: ['Click Mode: Normal', 'A click picks one block.'],
    multiselect: [
        'Click Mode: Multi-Select',
        'Click blocks to pick more than one, or drag a box around them.',
    ],
    disable: [
        'Click Mode: Disable',
        'Click a block to turn it off or back on. Press Disable again to stop.',
    ],
}

/** @param {keyof MODE_TOASTS} mode */
const announce = (mode) =>
    showToast('info', ...MODE_TOASTS[mode], { key: 'click-mode' })

/**
 * Turns a block off, or back on. A shadow (a number in a slot) stands for
 * the block it is in. The change can be undone.
 * @param {Blockly.Block} block The block clicked.
 */
export const toggleBlockDisabled = (block) => {
    let target = block
    while (target?.isShadow()) {
        target = target.getParent()
    }
    if (!target) {
        return
    }
    const reason = Blockly.constants.MANUALLY_DISABLED
    Blockly.Events.setGroup(true)
    target.setDisabledReason(!target.hasDisabledReason(reason), reason)
    Blockly.Events.setGroup(false)
}

/**
 * Multi-select's selection box (DragSelect) starts on any press in the
 * canvas, so a press on a block both dragged the block and drew a box.
 * The box now starts only on the empty canvas; a press on a block or a
 * note is left to Blockly, which drags it.
 * @param {object|null} dragSelect The plugin's DragSelect.
 */
const onlyBoxFromBackground = (dragSelect) => {
    const interaction = dragSelect?.Interaction
    if (!interaction?._canInteract) {
        return
    }
    const canInteract = interaction._canInteract.bind(interaction)
    interaction._canInteract = (event) =>
        !event.target?.closest?.('.blocklyBlockCanvas, .blocklyBubbleCanvas') &&
        canInteract(event)
}

/**
 * With Multi-select on, nothing moves: a press on a block or a note never
 * reaches Blockly, so it cannot start a drag. Its release picks that block
 * or note in or out of the selection (DragSelect did that before, but it
 * no longer starts on blocks; see onlyBoxFromBackground). Once Multi-select
 * is off, a drag moves the whole selection, as the plugin does.
 * @param {object|undefined} controls The plugin's controls.
 * @param {Blockly.WorkspaceSvg} workspace The workspace.
 * @returns {() => void} Puts the canvas back as it was.
 */
const selectByClicking = (controls, workspace) => {
    const group = controls?.multiDraggable
    if (!group) {
        return () => {}
    }
    const inMode = () => inMultipleSelectionModeWeakMap.get(workspace)
    const byId = (id) =>
        workspace.getBlockById(id) ?? workspace.getCommentById(id)

    // the selected item pressed (a block inside a selected stack counts
    // as that stack), or null
    const selectedPressed = (target) => {
        let node = target.closest?.('[data-id]')
        while (node) {
            if (group.dragSelection.has(node.dataset.id)) {
                return byId(node.dataset.id)
            }
            node = node.parentElement?.closest('[data-id]')
        }
        return null
    }
    // the item a click picks in or out: a selected one around the press,
    // or else the block (not a number in its slot) or note pressed
    const clickedItem = (target) => {
        const selected = selectedPressed(target)
        if (selected) {
            return selected
        }
        let item = byId(target.closest?.('[data-id]')?.dataset.id)
        while (item?.isShadow?.()) {
            item = item.getParent()
        }
        return item ?? null
    }
    // Blockly's own pick of the clicked block, set right after a click
    const showSelection = () => {
        const size = group.dragSelection.size
        if (size > 1) {
            Blockly.common.setSelected(group)
        } else if (size === 1) {
            Blockly.common.setSelected(
                byId(group.dragSelection.values().next().value),
            )
        } else {
            // (setSelected(null) throws in Blockly 12)
            Blockly.getFocusManager().focusTree(workspace)
        }
    }

    const Canvas = workspace.getSvgGroup()
    const onPress = (event) => {
        if (!inMode()) {
            return
        }
        // a box drag on the empty canvas still reaches Blockly, which
        // would drag whatever block is selected (say, the last one taken
        // from the toolbox) along with the box
        dragLocks.add(workspace)
        const unlock = () => {
            dragLocks.delete(workspace)
            document.removeEventListener('pointerup', unlock, true)
            document.removeEventListener('pointercancel', unlock, true)
        }
        document.addEventListener('pointerup', unlock, true)
        document.addEventListener('pointercancel', unlock, true)
        if (
            !event.target.closest?.('.blocklyBlockCanvas, .blocklyBubbleCanvas')
        ) {
            return
        }
        // kept from Blockly (and the plugin), so no drag starts; and from
        // the browser, which would focus the canvas behind a note's top
        // bar, and the plugin clears the selection when that happens
        event.stopPropagation()
        if (!event.target.closest('textarea, input')) {
            event.preventDefault()
        }
        if (event.button !== 0) {
            return
        }
        const item = clickedItem(event.target)
        if (!item) {
            return
        }
        // a click picks; a drag does nothing
        const { clientX, clientY } = event
        document.addEventListener(
            'pointerup',
            (up) => {
                const moved = Math.hypot(
                    up.clientX - clientX,
                    up.clientY - clientY,
                )
                if (moved < 5 && inMode()) {
                    controls.updateDraggables_(item)
                    showSelection()
                }
            },
            { once: true },
        )
    }
    Canvas.addEventListener('pointerdown', onPress, true)

    return () => {
        Canvas.removeEventListener('pointerdown', onPress, true)
        dragLocks.delete(workspace)
    }
}

/**
 * The Disable button, and the wiring between it and Multi-select.
 * @param {() => object} getInstance The Blockly instance (its workspace
 *     and multiselect change when the workspace is rebuilt).
 * @param {HTMLElement} Canvas The element around the canvas, marked while
 *     Disable is on.
 * @returns {{button: HTMLButtonElement, start: () => () => void}} The button,
 *     and start(), run for each new workspace, which returns its cleanup.
 */
export const createClickModes = (getInstance, Canvas) => {
    let disabling = false

    const setDisabling = (on, { quiet = false } = {}) => {
        disabling = on
        DisableButton.setAttribute('aria-pressed', String(on))
        Canvas.classList.toggle('disable-mode', on)
        if (on) {
            // the two modes do not mix
            getInstance()?.multiselect?.controls_?.disableMultiselect(true)
        }
        if (!quiet) {
            announce(on ? 'disable' : 'normal')
        }
    }

    const DisableButton = button(
        {
            type: 'button',
            class: 'disable-button',
            title: 'Disable: click blocks to turn them off or on',
            'aria-pressed': 'false',
        },
        tag('span', { class: 'disable-button-icon', 'aria-hidden': 'true' }),
        tag('span', 'Disable'),
        on('click', () => setDisabling(!disabling)),
    )

    const start = () => {
        const { workspace, multiselect } = getInstance()
        setDisabling(false, { quiet: true })

        const onClick = (event) => {
            if (
                disabling &&
                event.type === Blockly.Events.CLICK &&
                event.targetType === 'block'
            ) {
                const block = workspace.getBlockById(event.blockId)
                if (block) {
                    toggleBlockDisabled(block)
                }
            }
        }
        workspace.addChangeListener(onClick)

        const onKey = (event) => {
            if (event.key === 'Escape' && disabling) {
                setDisabling(false)
            }
        }
        document.addEventListener('keydown', onKey)

        // Multi-select: a toast when its icon turns it on or off (or it
        // goes off on its own), but not while Shift holds it on for a
        // moment (the icon fakes a Shift press, which is not trusted)
        let shift = false
        const onShift = (event) => {
            if (event.key === 'Shift' && event.isTrusted) {
                shift = event.type === 'keydown'
            }
        }
        document.addEventListener('keydown', onShift)
        document.addEventListener('keyup', onShift)
        const controls = multiselect?.controls_
        const update = controls?.updateMultiselectIcon
        // the plugin flips its own `enabled` before this runs, so the
        // last state is kept here
        let shown = false
        if (controls && update) {
            controls.updateMultiselectIcon = function (enable) {
                update.call(this, enable)
                if (shift || shown === enable) {
                    return
                }
                shown = enable
                if (enable && disabling) {
                    setDisabling(false, { quiet: true })
                }
                // a moment later, so turning Disable on (which turns this
                // off) shows only its own toast
                queueMicrotask(() => {
                    if (!disabling) {
                        announce(enable ? 'multiselect' : 'normal')
                    }
                })
            }
        }

        // The plugin ends Multi-select on any Shift release, even when the
        // icon turned it on: a press of Shift then silently put clicks back
        // to Normal, and a box drag scrolled the canvas instead. A Shift
        // release now only ends a Multi-select that Shift started.
        const enableMs = controls?.enableMultiselect
        const disableMs = controls?.disableMultiselect
        let byIconOn = false
        if (controls && enableMs && disableMs) {
            controls.enableMultiselect = function (byIcon = false) {
                if (byIcon) {
                    byIconOn = true
                }
                const result = enableMs.call(this, byIcon)
                onlyBoxFromBackground(this.dragSelect_)
                return result
            }
            controls.disableMultiselect = function (byIcon = false) {
                if (
                    !byIcon &&
                    byIconOn &&
                    window.event?.type === 'keyup' &&
                    window.event.isTrusted
                ) {
                    return
                }
                byIconOn = false
                return disableMs.call(this, byIcon)
            }
        }

        const undoSelectByClicking = selectByClicking(controls, workspace)

        return () => {
            undoSelectByClicking()
            if (controls && enableMs && disableMs) {
                controls.enableMultiselect = enableMs
                controls.disableMultiselect = disableMs
            }
            workspace.removeChangeListener(onClick)
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('keydown', onShift)
            document.removeEventListener('keyup', onShift)
            if (controls && update) {
                controls.updateMultiselectIcon = update
            }
        }
    }

    return { button: DisableButton, start }
}
