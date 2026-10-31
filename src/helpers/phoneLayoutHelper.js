/*
 * The phone layout: a narrow portrait window (a phone held upright, or a
 * desktop window dragged tall and thin). The block editor then puts its
 * toolbox across the top, the cheatsheet drawer along the bottom, and lets
 * the toolbar wrap. The body carries the `phone-layout` class so the CSS
 * and the JavaScript agree on when it applies.
 */

/** The media query that defines the phone layout. */
export const phoneLayoutQuery = '(max-width: 760px) and (orientation: portrait)'

const mediaQuery = window.matchMedia(phoneLayoutQuery)

/** @returns {boolean} Whether the window currently has the phone layout. */
export const isPhoneLayout = () => mediaQuery.matches

/**
 * Keeps the body's `phone-layout` class in step with the window. Call once
 * when the page is built.
 */
export const watchPhoneLayout = () => {
    const apply = () =>
        document.body.classList.toggle('phone-layout', mediaQuery.matches)
    apply()
    mediaQuery.addEventListener('change', apply)
}

/**
 * Runs a callback whenever the window enters or leaves the phone layout.
 * @param {(phone: boolean) => void} callback Receives the new state.
 * @returns {() => void} Stops listening.
 */
export const onPhoneLayoutChange = (callback) => {
    const listener = (event) => callback(event.matches)
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
}
