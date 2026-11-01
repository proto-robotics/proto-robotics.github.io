/*
 * Adds cheatsheet-specific navigation to the generic drawer. Cheatsheet
 * content is supplied by the caller.
 */

import { createDrawer, openDrawer } from './drawerHelper'
import { animateScrollTo } from './scrollHelper'

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
    animateScrollTo(panel, panel.scrollTop + targetBox.top - panelBox.top - 8)

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
 * Creates the slide-out cheatsheet drawer and wires its tab toggle. The
 * content (a Blockly preview for every block) is built the first time the
 * drawer opens, however it is opened: building it up front was most of the
 * editor's start-up time.
 * @param {() => Node} createContent Creates the drawer's cheatsheet content.
 * @param {object} options Drawer configuration.
 * @param {Record<string, number>} [options.blockLookup={}] Maps block names to items.
 * @returns {HTMLElement} The configured cheatsheet drawer element.
 */
export default function createCheatSheetDrawer(
    createContent,
    { blockLookup = {} } = {},
) {
    const { drawer, panel } = createDrawer({
        elementName: 'cheatsheet-drawer',
        tabId: 'cheatsheet-drawer-tab',
        panelId: 'cheatsheet-drawer-panel',
        tabLabel: 'Cheatsheet',
        panelContent: [],
    })

    let built = false
    const ensureContent = () => {
        if (!built) {
            built = true
            panel.replaceChildren(createContent())
        }
    }
    // every way of opening the drawer ends in the `open` class
    new MutationObserver(() => {
        if (drawer.classList.contains('open')) {
            ensureContent()
        }
    }).observe(drawer, { attributes: true, attributeFilter: ['class'] })

    document.addEventListener(openCheatSheetDrawerEvent, (event) => {
        openDrawer(drawer)
        ensureContent()

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
