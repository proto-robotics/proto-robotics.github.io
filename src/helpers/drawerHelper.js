import { button, tag } from 'ellipsi'

/**
 * Sets a drawer's visibility and synchronizes its accessible expanded state.
 * @param {HTMLElement} drawer Drawer element created by {@link createDrawer}.
 * @param {boolean} isOpen Whether the drawer should be open.
 */
export function setDrawerOpen(drawer, isOpen) {
    drawer.classList.toggle('open', isOpen)
    drawer.setAttribute('aria-expanded', String(isOpen))
    drawer
        .querySelector('.drawer-tab')
        ?.setAttribute('aria-expanded', String(isOpen))
}

/**
 * Opens a drawer.
 * @param {HTMLElement} drawer Drawer element created by {@link createDrawer}.
 */
export function openDrawer(drawer) {
    setDrawerOpen(drawer, true)
}

/**
 * Toggles a drawer and returns its new state.
 * @param {HTMLElement} drawer Drawer element created by {@link createDrawer}.
 * @returns {boolean} Whether the drawer is open after toggling.
 */
export function toggleDrawer(drawer) {
    const isOpen = !drawer.classList.contains('open')
    setDrawerOpen(drawer, isOpen)
    return isOpen
}

/**
 * Creates the shared slide-out drawer structure and tab behavior.
 * @param {object} options Drawer configuration.
 * @param {string} options.elementName Custom element name for specialized CSS.
 * @param {string} options.tabId Unique ID for the drawer's tab button.
 * @param {string} options.panelId Unique ID for the drawer's content panel.
 * @param {string} options.tabLabel Initial text displayed by the tab.
 * @param {Node|Node[]} options.panelContent Content placed inside the panel.
 * @returns {{drawer: HTMLElement, tab: HTMLButtonElement, panel: HTMLElement}}
 * Drawer elements for use by feature-specific code.
 */
export function createDrawer({
    elementName,
    tabId,
    panelId,
    tabLabel,
    panelContent,
}) {
    const tabElement = button(
        {
            type: 'button',
            id: tabId,
            'aria-controls': panelId,
            'aria-expanded': 'false',
        },
        tabLabel,
    )
    tabElement.classList.add('drawer-tab')

    const children = Array.isArray(panelContent)
        ? panelContent
        : [panelContent]
    const panel = tag(
        'aside',
        { id: panelId, class: 'drawer-panel' },
        ...children,
    )
    const drawer = tag(
        elementName,
        { class: 'drawer', 'aria-expanded': 'false' },
        tabElement,
        panel,
    )

    tabElement.addEventListener('click', () => {
        toggleDrawer(drawer)
    })

    return { drawer, tab: tabElement, panel }
}
