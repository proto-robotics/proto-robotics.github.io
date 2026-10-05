/*
 * The block cap (`maxBlocks`, see editorParamsHelper.js): a "blocks left"
 * pill over the canvas, and a backstop for the cap itself. Blockly greys
 * out the flyout once the cap is reached, but a paste, an undo, or a loaded
 * save can still push the count over; then the newest blocks go, one at a
 * time, until the count fits, and the pill flashes so the learner sees why.
 */

import { Events } from 'blockly'
import { tag } from 'ellipsi'

/**
 * Creates the capacity pill and its backstop for a capped workspace.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 * @param {number|undefined} maxBlocks The cap; nothing is created without one.
 * @returns {{
 *   element: HTMLElement,
 *   update: () => void,
 *   onEvent: (event: object) => void,
 * }|null} The pill, a refresh of its text, and a feed for workspace events.
 */
export const createBlockCapacity = (blocklyInstance, maxBlocks) => {
    if (!maxBlocks) {
        return null
    }

    const element = tag('div', { id: 'block-capacity', role: 'status' })

    /** @type {Map<string, number>} Block id to the order it was created in. */
    const createdOrder = new Map()
    let createdSequence = 0
    let enforceQueued = false

    /** Refreshes the pill's text from the workspace. */
    const update = () => {
        const workspace = blocklyInstance.workspace
        if (!workspace) {
            return
        }
        const left = Math.max(0, workspace.remainingCapacity())
        element.textContent = `You have ${left} block${left === 1 ? '' : 's'} left.`
        element.classList.toggle('full', left === 0)
    }

    /** Removes the newest blocks until the count fits the cap. */
    const enforce = () => {
        const workspace = blocklyInstance.workspace
        if (!workspace || workspace.remainingCapacity() >= 0) {
            return
        }
        let removed = false
        while (workspace.remainingCapacity() < 0) {
            const newest = workspace
                .getAllBlocks(false)
                .filter((block) => !block.isShadow())
                .sort(
                    (a, b) =>
                        (createdOrder.get(b.id) ?? 0) -
                        (createdOrder.get(a.id) ?? 0),
                )[0]
            if (!newest) {
                break
            }
            newest.dispose(true)
            removed = true
        }
        if (removed) {
            element.classList.remove('over')
            void element.offsetWidth // restarts the flash
            element.classList.add('over')
        }
    }

    /**
     * Records when blocks are created and queues the backstop. Blockly
     * delivers its events in batches, so the backstop runs one tick after
     * the batch: by then every block in it has been recorded and the newest
     * really is the newest.
     * @param {object} event A workspace change event.
     */
    const onEvent = (event) => {
        if (event.type === Events.BLOCK_CREATE) {
            for (const id of event.ids ?? [event.blockId]) {
                createdOrder.set(id, ++createdSequence)
            }
            if (!enforceQueued) {
                enforceQueued = true
                setTimeout(() => {
                    enforceQueued = false
                    if (!blocklyInstance.workspace?.isDragging()) {
                        enforce()
                    }
                })
            }
        } else if (event.type === Events.BLOCK_DELETE) {
            for (const id of event.ids ?? [event.blockId]) {
                createdOrder.delete(id)
            }
        }
    }

    return { element, update, onEvent }
}
