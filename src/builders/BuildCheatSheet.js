/*
 * Builds only the standalone cheatsheet page shell. Reusable cheatsheet
 * rendering belongs to buildCheatSheetContent.js.
 */

import { tag } from 'ellipsi'

import { buildCheatSheetContent } from './buildCheatSheetContent'
import { buildSiteNav } from './buildSiteChrome'

/**
 * Builds the standalone cheatsheet page around the reusable cheatsheet content.
 * @returns {HTMLElement[]} Top-level page elements.
 */
export default function BuildCheatSheet() {
    const content = buildCheatSheetContent()
    const codingHomePath = window.location.pathname
    const navbar = buildSiteNav({
        tagline: 'Cheatsheet',
        links: [{ label: 'Back to the Editor', href: codingHomePath }],
    })
    const page = tag('div', { class: 'cheatsheet-page' })
    const header = tag('header', { class: 'cheatsheet-page-header' }, navbar)
    const updateStickyOffset = () => {
        page.style.setProperty(
            '--cheatsheet-sticky-offset',
            `${header.getBoundingClientRect().height}px`,
        )
    }
    const headerResizeObserver = new ResizeObserver(updateStickyOffset)
    headerResizeObserver.observe(header)

    requestAnimationFrame(updateStickyOffset)

    page.append(header, content)
    return [page]
}
