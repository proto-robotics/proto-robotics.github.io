import { button, div, img, on, tag } from 'ellipsi'

import { cancelIcon } from '../assets'

/** Event used to request that a popup dialog closes. */
export const closePopUpEvent = 'close-pop-up'

/**
 * Creates and opens a modal popup containing the supplied elements.
 * @param {...Node|string} children Content shown inside the dialog.
 * @returns {HTMLDialogElement} The opened dialog element.
 */
export const PopUp = (...children) => {
    /** Closes an open dialog, or removes one that has not opened yet. */
    const closePopUp = () => {
        if (Dialog.open) {
            Dialog.close()
            return
        }

        Dialog.remove()
    }

    const CloseButton = button(
        img({
            src: cancelIcon,
            alt: 'Close dialog',
        }),
        { type: 'button', class: 'popup-close-button' },
        on('click', () => Dialog.dispatchEvent(new Event(closePopUpEvent))),
    )

    const Dialog = tag(
        'dialog',
        { class: 'popup-dialog' },
        div({ class: 'popup-content' }, CloseButton, children),
        on(closePopUpEvent, closePopUp),
        on('close', () => Dialog.remove()),
    )

    queueMicrotask(() => {
        if (!Dialog.isConnected || Dialog.open) {
            return
        }

        Dialog.showModal()
        // start on the first control rather than the close button, which
        // would otherwise open with a focus ring on it
        Dialog.querySelector(
            'input, textarea, select, button:not(.popup-close-button)',
        )?.focus()
    })

    return Dialog
}

/**
 * Makes sure the project has a name before it is saved. An unnamed project
 * gets a popup asking for one; the name is written into the field (and its
 * change event fired, so it is remembered like a typed name).
 * @param {HTMLInputElement} ProjectNameInput Project-name field.
 * @returns {Promise<boolean>} Whether the project now has a name.
 */
export const ensureProjectName = (ProjectNameInput) => {
    if (ProjectNameInput.value.trim()) {
        return Promise.resolve(true)
    }

    return new Promise((resolve) => {
        let settled = false
        const settle = (named) => {
            if (!settled) {
                settled = true
                resolve(named)
            }
        }

        const NameInput = tag('input', {
            type: 'text',
            placeholder: 'Project name...',
            'aria-label': 'Project name',
        })
        const submit = () => {
            const name = NameInput.value.trim()
            if (!name) {
                NameInput.focus()
                return
            }
            ProjectNameInput.value = name
            ProjectNameInput.dispatchEvent(new Event('change'))
            settle(true)
            Dialog.dispatchEvent(new Event(closePopUpEvent))
        }
        NameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                submit()
            }
        })

        const Dialog = PopUp(
            'Give your project a name before saving.',
            NameInput,
            button('Save', on('click', submit)),
        )
        Dialog.addEventListener('close', () => settle(false))
        document.body.appendChild(Dialog)
    })
}
