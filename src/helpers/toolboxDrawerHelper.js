/*
 * The toolbox drawer, phone layout only (phoneLayoutHelper.js). The toolbox
 * runs across the top of the canvas there, its always-open flyout under it,
 * and a tab hanging below pulls both away and back. The tab is in the DOM
 * on every layout; styles.css shows it only on phones.
 */

import { button, on } from 'ellipsi'

/**
 * Creates the toolbox drawer's tab and the logic behind it.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 *     May be rebuilt (same object, new workspace); the tab follows.
 * @param {HTMLElement} editorElement The block editor element. It carries
 *     `--toolbox-height`, the height the toolbox and flyout take up, so the
 *     tab and the code drawer's tab can sit below them.
 * @returns {{Tab: HTMLButtonElement, place: () => void, apply: () => void}}
 *     The tab; `place` re-measures the toolbox (after the flyout opens or
 *     the canvas resizes); `apply` shows or hides the toolbox as the tab
 *     says (after the workspace mounts).
 */
export const createToolboxDrawer = (blocklyInstance, editorElement) => {
    let shown = true

    const Tab = button(
        'Hide Blocks',
        {
            type: 'button',
            id: 'toolbox-drawer-tab',
            class: 'drawer-tab',
            'aria-expanded': 'true',
        },
        on('click', () => {
            shown = !shown
            apply()
        }),
    )

    const place = () => {
        const workspace = blocklyInstance.workspace
        const toolbox = workspace?.getToolbox()
        let height = toolbox && shown ? toolbox.getHeight() : 0
        const flyout = workspace?.getFlyout()
        if (height && flyout?.isVisible()) {
            height += flyout.getHeight()
        }
        editorElement.style.setProperty('--toolbox-height', `${height}px`)
    }

    const apply = () => {
        const workspace = blocklyInstance.workspace
        const toolbox = workspace?.getToolbox()
        if (!toolbox) {
            return
        }
        // the desktop layout's toolbox column always shows
        const visible = shown || !blocklyInstance.phone
        const wasVisible = toolbox.HtmlDiv?.style.display !== 'none'
        // the always-open flyout is separate from the toolbox row
        toolbox.setVisible(visible)
        workspace.getFlyout()?.setVisible(visible)
        workspace.resize()
        if (visible && !wasVisible) {
            // blocks may have changed while it was away
            toolbox.refreshSelection()
        }
        Tab.textContent = visible ? 'Hide Blocks' : 'Show Blocks'
        Tab.setAttribute('aria-expanded', String(visible))
        place()
    }

    return { Tab, place, apply }
}
