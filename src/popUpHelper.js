import { button, img, on, shadow, slot, tag } from 'ellipsi'

export const closePopUpEvent = 'close-pop-up'

export const PopUp = (...children) => {
    const CloseButton = button(
        { part: 'close-button' },
        // img({ src: '', alt: 'Pop-up close button', height: '32' }),
        'x',
        on('click', () => PopUp.dispatchEvent(new Event(closePopUpEvent))),
    )

    const PopUp = tag(
        'pop-up',
        children,
        shadow(CloseButton, slot()),
        on(closePopUpEvent, () => PopUp.remove()),
    )

    return PopUp
}
