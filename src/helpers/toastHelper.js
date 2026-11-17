/*
 * Toasts: a short message in the top right corner, under the toolbar, that
 * goes away on its own. A success has a check mark, a failure an x, a note
 * (such as the click mode) an i. A new toast stacks under any still
 * showing, unless it shares a key with one: then it takes that one's place.
 * A click on one closes it.
 */

import { button, div, on, tag } from 'ellipsi'

import { getRoot } from './rootHelper'

/** How long a toast stays, in milliseconds. */
const SHOW_FOR = 4000
/** How long it takes to fade out. */
const FADE = 250

/** The mark each kind of toast shows. */
const MARKS = { success: '✓', error: '✕', info: 'i' }

let Stack = null

/** The corner the toasts stack in, made the first time one shows. */
const stack = () => {
    if (!Stack?.isConnected) {
        Stack = div({
            class: 'toast-stack',
            role: 'status',
            'aria-live': 'polite',
        })
        getRoot().appendChild(Stack)
    }
    return Stack
}

/**
 * Shows a toast.
 * @param {'success'|'error'|'info'} kind A check mark, an x, or an i.
 * @param {string} text What happened, in a few words.
 * @param {string} [detail] A second, smaller line.
 * @param {object} [options]
 * @param {string} [options.key] A toast with the same key is replaced.
 */
export const showToast = (kind, text, detail, { key } = {}) => {
    if (key) {
        for (const Old of stack().querySelectorAll('.toast')) {
            if (Old.dataset.key === key) {
                Old.remove()
            }
        }
    }
    const Toast = button(
        { type: 'button', class: `toast toast-${kind}`, title: 'Close' },
        tag(
            'span',
            { class: 'toast-mark', 'aria-hidden': 'true' },
            MARKS[kind] ?? MARKS.info,
        ),
        tag(
            'span',
            { class: 'toast-text' },
            tag('b', text),
            ...(detail ? [tag('span', { class: 'toast-detail' }, detail)] : []),
        ),
        on('click', () => hide()),
    )
    if (key) {
        Toast.dataset.key = key
    }
    let timer = 0
    const hide = () => {
        clearTimeout(timer)
        Toast.classList.add('leaving')
        setTimeout(() => Toast.remove(), FADE)
    }
    stack().appendChild(Toast)
    timer = setTimeout(hide, SHOW_FOR)
}
