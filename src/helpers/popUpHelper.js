import { button, div, img, on, tag } from 'ellipsi'

export const closePopUpEvent = 'close-pop-up'

export const PopUp = (...children) => {
    const closePopUp = () => {
        if (Dialog.open) {
            Dialog.close()
            return
        }

        Dialog.remove()
    }

    const CloseButton = button(
        img({
            src: '/images/cancel.svg',
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
