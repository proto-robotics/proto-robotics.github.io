/*
 * The top bar shared by the coding page and the cheatsheet page: the logo
 * with a tagline, the page's own controls, the copyright, and pill links.
 * Styled after the main PROTO site (public-website/src/styles/site.css),
 * corner mosaics included. In the phone layout the controls fold into a
 * menu behind a hamburger button.
 */

import { a, button, img, span, tag } from 'ellipsi'

import { protoLogo } from '../assets'
import {
    COOL_PALETTE,
    WARM_PALETTE,
    createMosaic,
} from '../helpers/mosaicHelper'

/** The main PROTO site, where the logo links to. */
const siteHome = 'https://protorobotics.org/'

/** The hamburger: three lines. */
const menuIcon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
    '<path d="M4 7h16M4 12h16M4 17h16"/></svg>'

/**
 * Publishes the header's height as `--header-height` on the root element,
 * so fixed drawers can start right under it however the bar wraps.
 * @param {HTMLElement} headerElement The page header.
 */
export const watchHeaderHeight = (headerElement) => {
    const update = () => {
        document.documentElement.style.setProperty(
            '--header-height',
            `${headerElement.getBoundingClientRect().height}px`,
        )
    }
    new ResizeObserver(update).observe(headerElement)
    requestAnimationFrame(update)
}

/**
 * Builds the menu button and wires it to the controls' panel: it opens and
 * closes the panel, and the panel closes after any of its buttons is used,
 * on Escape, and on a tap elsewhere (styles.css shows the button, and
 * folds the panel away, in the phone layout only).
 * @param {HTMLElement} nav The bar.
 * @param {HTMLElement} panel The controls' panel.
 * @returns {HTMLButtonElement} The menu button.
 */
const buildMenuToggle = (nav, panel) => {
    const MenuToggle = button({
        type: 'button',
        class: 'site-nav__menu',
        'aria-label': 'Menu',
        'aria-controls': panel.id,
        'aria-expanded': 'false',
    })
    MenuToggle.innerHTML = menuIcon

    const setOpen = (open) => {
        nav.classList.toggle('menu-open', open)
        MenuToggle.setAttribute('aria-expanded', String(open))
    }
    MenuToggle.addEventListener('click', () =>
        setOpen(!nav.classList.contains('menu-open')),
    )
    panel.addEventListener('click', (event) => {
        if (event.target.closest('button')) {
            setOpen(false)
        }
    })
    // in the capture phase: Blockly keeps pointer events on its canvas
    // from reaching the document
    document.addEventListener(
        'pointerdown',
        (event) => {
            if (!nav.contains(event.target)) {
                setOpen(false)
            }
        },
        true,
    )
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setOpen(false)
        }
    })
    return MenuToggle
}

/**
 * Builds the top bar.
 * @param {object} options
 * @param {string} options.tagline Short uppercase label next to the logo.
 * @param {HTMLElement[]} [options.controls] Elements placed after the brand,
 *     such as the editor's toolbar. On a phone they sit in the menu.
 * @param {{label: string, href: string}[]} [options.links] Pill links on
 *     the far right.
 * @returns {HTMLElement} The nav element.
 */
export const buildSiteNav = ({ tagline, controls = [], links = [] }) => {
    const Controls = span(
        { class: 'site-nav__controls', id: 'site-nav-controls' },
        ...controls,
    )
    const nav = tag(
        'nav',
        { class: 'site-nav', 'aria-label': 'Site' },
        // the corner mosaics, same settings as the main site's nav
        createMosaic({
            side: 'left',
            widthFraction: 0.26,
            minCols: 7,
            maxCols: 34,
            rows: 4,
            seed: 77,
            palette: WARM_PALETTE,
        }),
        createMosaic({
            side: 'right',
            widthFraction: 0.21,
            minCols: 6,
            maxCols: 28,
            rows: 4,
            seed: 42,
            palette: COOL_PALETTE,
        }),
        a(
            {
                href: siteHome,
                target: '_self',
                class: 'site-nav__brand',
                'aria-label': 'PROTO Robotics home',
            },
            img({ src: protoLogo, alt: 'PROTO', class: 'site-nav__logo' }),
            span({ class: 'site-nav__brand-text' }, tagline),
        ),
        Controls,
        span(
            { class: 'site-nav__copy' },
            `© ${new Date().getFullYear()} PROTO Robotics LLC`,
        ),
        span(
            { class: 'site-nav__actions' },
            ...links.map(({ label, href }) =>
                a({ href, target: '_self', class: 'nav-btn' }, label),
            ),
        ),
    )
    if (controls.length) {
        nav.appendChild(buildMenuToggle(nav, Controls))
    }
    return nav
}
