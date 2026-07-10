import { button, tag } from 'ellipsi'

export const openCheatSheetDrawerEvent = 'open-cheatsheet-drawer'

function openCheatSheetDrawer(drawer) {
    drawer.classList.add('open')
    drawer.setAttribute('aria-expanded', 'true')
}

function toggleCheatSheetDrawer(drawer) {
    const isOpen = drawer.classList.toggle('open')
    drawer.setAttribute('aria-expanded', String(isOpen))
}

export function scrollCheatSheetDrawerToElementNumber(drawer, elementNumber) {
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

export function scrollCheatSheetDrawerToBlockName(drawer, blockName, blockLookup) {
    const elementNumber = blockLookup?.[blockName]
    if (elementNumber === undefined) {
        return false
    }

    return scrollCheatSheetDrawerToElementNumber(drawer, elementNumber)
}

/**
 * Creates the slide-out cheatsheet drawer and wires its tab toggle.
 */
export default function cheatSheetDrawerHelper(
    createContent,
    { blockLookup = {} } = {},
) {
    const drawer = tag(
        'cheatsheet-drawer',
        { 'aria-expanded': 'false' },
        button({ type: 'button', id: 'cheatsheet-drawer-tab' }, 'Cheatsheet'),
        tag('aside', { id: 'cheatsheet-drawer-panel' }, createContent()),
    )

    const drawerTab = drawer.querySelector('#cheatsheet-drawer-tab')
    drawerTab.addEventListener('click', () => {
        toggleCheatSheetDrawer(drawer)
    })

    document.addEventListener(openCheatSheetDrawerEvent, (event) => {
        openCheatSheetDrawer(drawer)

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
