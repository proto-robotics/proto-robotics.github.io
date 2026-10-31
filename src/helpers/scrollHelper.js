/*
 * Animated scrolling that does not rely on `behavior: 'smooth'`. Chrome on
 * Windows turns native smooth scrolling off when the OS animation setting is
 * off, so the cheatsheet's section jumps would teleport instead of glide.
 */

/** @type {WeakMap<Window|Element, () => void>} Running animation per container. */
const running = new WeakMap()

/** Ease in and out, like the browser's own smooth scroll. */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * Scrolls a container (or the window) to a vertical position over time. A
 * new call on the same container replaces the running animation, and the
 * user's own wheel or touch cancels it.
 * @param {Window|Element} container What scrolls.
 * @param {number} top Target scroll position in pixels.
 * @param {number} [duration=350] Length of the animation in milliseconds.
 */
export function animateScrollTo(container, top, duration = 350) {
    const isWindow = container === window
    const getTop = () => (isWindow ? window.scrollY : container.scrollTop)
    const setTop = (y) => {
        if (isWindow) {
            window.scrollTo(0, y)
        } else {
            container.scrollTop = y
        }
    }

    running.get(container)?.()

    const start = getTop()
    const distance = top - start
    if (Math.abs(distance) < 1) {
        setTop(top)
        return
    }

    let frame = 0
    const stop = () => {
        cancelAnimationFrame(frame)
        container.removeEventListener('wheel', stop)
        container.removeEventListener('touchstart', stop)
        running.delete(container)
    }
    container.addEventListener('wheel', stop, { passive: true })
    container.addEventListener('touchstart', stop, { passive: true })
    running.set(container, stop)

    const startTime = performance.now()
    const step = (now) => {
        const progress = Math.min(1, (now - startTime) / duration)
        setTop(start + distance * easeInOut(progress))
        if (progress < 1) {
            frame = requestAnimationFrame(step)
        } else {
            stop()
        }
    }
    frame = requestAnimationFrame(step)
}
