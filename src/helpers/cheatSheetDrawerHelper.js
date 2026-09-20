/*
 * Adds cheatsheet-specific navigation to the generic drawer. Cheatsheet
 * content is supplied by the caller.
 */

import { createDrawer, openDrawer } from './drawerHelper'

/** Event dispatched to open the cheatsheet drawer at a block or item. */
export const openCheatSheetDrawerEvent = 'open-cheatsheet-drawer'

/**
 * Scrolls the drawer panel to a numbered cheatsheet item.
 * @param {HTMLElement} drawer The cheatsheet drawer element.
 * @param {number} elementNumber The item number to reveal.
 * @returns {boolean} Whether the target item was found.
 */
function scrollCheatSheetDrawerToElementNumber(drawer, elementNumber) {
    const panel = drawer.querySelector('#cheatsheet-drawer-panel')
    const target = drawer.querySelector(
        `[data-cheatsheet-element-number="${elementNumber}"]`,
    )

    if (!panel || !target) {
        return false
    }

    const panelBox = panel.getBoundingClientRect()
    const targetBox = target.getBoundingClientRect()
    panel.scrollTo({
        top: panel.scrollTop + targetBox.top - panelBox.top - 8,
        behavior: 'smooth',
    })

    return true
}

/**
 * Scrolls the drawer to the item documented for a Blockly block.
 * @param {HTMLElement} drawer The cheatsheet drawer element.
 * @param {string} blockName The Blockly block name.
 * @param {Record<string, number>} blockLookup Maps block names to item numbers.
 * @returns {boolean} Whether the block has a documented item.
 */
function scrollCheatSheetDrawerToBlockName(drawer, blockName, blockLookup) {
    const elementNumber = blockLookup?.[blockName]
    if (elementNumber === undefined) {
        return false
    }

    return scrollCheatSheetDrawerToElementNumber(drawer, elementNumber)
}

/**
 * Creates the slide-out cheatsheet drawer and wires its tab toggle.
 * @param {() => Node} createContent Creates the drawer's cheatsheet content.
 * @param {object} options Drawer configuration.
 * @param {Record<string, number>} [options.blockLookup={}] Maps block names to items.
 * @returns {HTMLElement} The configured cheatsheet drawer element.
 */
export default function createCheatSheetDrawer(
    createContent,
    { blockLookup = {} } = {},
) {
    const { drawer } = createDrawer({
        elementName: 'cheatsheet-drawer',
        tabId: 'cheatsheet-drawer-tab',
        panelId: 'cheatsheet-drawer-panel',
        tabLabel: 'Cheatsheet',
        panelContent: createContent(),
    })

    document.addEventListener(openCheatSheetDrawerEvent, (event) => {
        openDrawer(drawer)

        requestAnimationFrame(() => {
            if (event.detail?.elementNumber !== undefined) {
                scrollCheatSheetDrawerToElementNumber(
                    drawer,
                    event.detail.elementNumber,
                )
                return
            }

            if (event.detail?.blockName) {
                scrollCheatSheetDrawerToBlockName(
                    drawer,
                    event.detail.blockName,
                    blockLookup,
                )
            }
        })
    })

    return drawer
}
