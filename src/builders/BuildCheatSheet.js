/*
 * Builds only the standalone cheatsheet page shell. Reusable cheatsheet
 * rendering belongs to buildCheatSheetContent.js.
 */

import { a, img, tag } from 'ellipsi'

import { buildCheatSheetContent } from './buildCheatSheetContent'
import { protoLogo } from '../assets'

/**
 * Builds the standalone cheatsheet page around the reusable cheatsheet content.
 * @returns {HTMLElement[]} Top-level page elements.
 */
export default function BuildCheatSheet() {
    const content = buildCheatSheetContent()
    const codingHomePath = window.location.pathname
    const navbar = tag(
        'nav',
        a(
            { href: 'https://protorobotics.org/index.html', target: '_self' },
            img({
                src: protoLogo,
                alt: 'The PROTO logo',
                height: '32',
            }),
        ),
        a({ href: codingHomePath, target: '_self' }, 'Home'),
    )
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
