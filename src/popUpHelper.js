import { button, on, shadow, slot, tag } from 'ellipsi'

export const closePopUpEvent = 'close-pop-up'

export const PopUp = (...children) => {
    const CloseButton = button(
        { part: 'close-button' },
        'x',
        on('click', () => PopUp.dispatchEvent(new Event(closePopUpEvent))),
    )

    const PopUp = tag(
        'pop-up',
        children,
        shadow(CloseButton, slot()),
        on(closePopUpEvent, () => PopUp.remove()),
    )

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return
        }

        PopUp.dispatchEvent(new Event(closePopUpEvent))
    })

    return PopUp
}
