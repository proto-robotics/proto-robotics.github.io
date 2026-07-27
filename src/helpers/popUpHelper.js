import { button, div, img, on, tag } from 'ellipsi'

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
            src: '/assets/images/cancel.svg',
            alt: 'Close dialog',
        }),
        { type: 'button', class: 'popup-close-button' },
        on('click', () => Dialog.dispatchEvent(new Event(closePopUpEvent))),
    )

    const Dialog = tag(
        'dialog',
        { class: 'popup-dialog' },
        div(
            { class: 'popup-content' },
            CloseButton,
            children,
        ),
        on(closePopUpEvent, closePopUp),
        on('close', () => Dialog.remove()),
    )

    queueMicrotask(() => {
        if (!Dialog.isConnected || Dialog.open) {
            return
        }

        Dialog.showModal()
    })

    return Dialog
}
