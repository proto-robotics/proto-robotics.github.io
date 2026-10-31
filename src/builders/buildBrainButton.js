/*
 * The "Send to Brain" button in the toolbar (the brain is the robot's
 * controller, which shows up as a USB drive; see brainHelper.js). The first
 * time it reads "Connect Brain", explains what to do, and asks for the
 * drive; after that it writes the program straight to the drive. It is
 * always there: unplugged, it says so and offers to pick a drive again;
 * where the browser cannot write to a drive, it says that when clicked.
 */

import { button, on, tag } from 'ellipsi'

import {
    BrainState,
    connectBrain,
    sendToBrain,
    watchBrain,
} from '../helpers/brainHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'

/**
 * Walks the learner through connecting the brain, then opens the folder
 * dialog from the popup's own button (the dialog may only open from a
 * click).
 * @returns {Promise<FileSystemDirectoryHandle|null>} The drive, or null
 *     when the popup was closed instead.
 */
const connectBrainWithHelp = () =>
    new Promise((resolve) => {
        let handle = null
        const Trouble = tag('p', { class: 'popup-trouble', role: 'alert' })
        Trouble.hidden = true
        const ChooseButton = button(
            'Choose the Brain',
            { type: 'button' },
            on('click', async () => {
                ChooseButton.disabled = true
                Trouble.hidden = true
                try {
                    handle = await connectBrain()
                    Dialog.dispatchEvent(new Event(closePopUpEvent))
                } catch (error) {
                    // a cancelled dialog is no trouble; anything else is
                    // said in the popup, since the picker gave no sign
                    if (error.name !== 'AbortError') {
                        Trouble.textContent =
                            'The folder could not be opened here. ' +
                            (error.message || '')
                        Trouble.hidden = false
                    }
                } finally {
                    ChooseButton.disabled = false
                }
            }),
        )
        const Dialog = PopUp(
            tag('h2', 'Sending to the brain'),
            tag(
                'ol',
                { class: 'popup-steps' },
                tag(
                    'li',
                    'Plug the brain into this device with its USB cable ',
                    'and turn it on.',
                ),
                tag(
                    'li',
                    'Wait until it shows up as a drive, the way a USB ',
                    'stick does.',
                ),
                tag(
                    'li',
                    'Press Choose the Brain. In the window that opens, ',
                    'select that drive and allow access to it.',
                ),
            ),
            tag(
                'p',
                'This is only needed once. From then on Send to Brain ',
                'sends your program straight to it.',
            ),
            Trouble,
            ChooseButton,
        )
        // the dialog's close event, not the content's (PopUp hands its
        // children to the content element)
        Dialog.addEventListener('close', () => resolve(handle))
        document.body.appendChild(Dialog)
    })

/**
 * Explains why nothing could be sent (the unplugged case has its own popup).
 * @param {Error} error What sendToBrain threw.
 * @returns {string} A sentence for the learner.
 */
const describeSendError = (error) =>
    error.name === 'NotAllowedError'
        ? 'The browser was not allowed to write to the brain.'
        : error.message

/**
 * Builds the Send to Brain button.
 * @param {object} options
 * @param {() => string} options.getProjectName The project's name, for
 *     the files that carry it.
 * @param {(projectName: string) => {name: string, text: string}[]}
 *     options.getProjectFiles The files to write (EditorMode.getProjectFiles
 *     of the current editor).
 * @returns {HTMLButtonElement} The button.
 */
export const buildBrainButton = ({ getProjectName, getProjectFiles }) => {
    /** @type {FileSystemDirectoryHandle|null} The remembered drive. */
    let brainHandle = null
    /** Set where the browser cannot write to a drive. */
    let unsupported = false

    const explainUnsupported = () => {
        document.body.appendChild(
            PopUp(
                'This browser does not support sending programs ',
                'to the brain, or has it switched off. ',
                'Chrome and Edge support it. ',
                'Save still downloads the project.',
            ),
        )
    }

    const send = async () => {
        if (!brainHandle) {
            brainHandle = await connectBrainWithHelp()
            watch.refresh()
            if (!brainHandle) {
                return // the popup was closed
            }
        }
        const projectName = getProjectName() || 'proto'
        await sendToBrain(brainHandle, getProjectFiles(projectName))
        BrainButton.textContent = 'Sent'
        setTimeout(() => {
            BrainButton.textContent = 'Send to Brain'
        }, 1500)
    }

    /**
     * The drive is not there: say so, and offer another pick (the way out
     * of a wrong pick, too). The pick must start from the popup's own
     * button, a click.
     */
    const explainMissing = () => {
        const ChooseButton = button(
            'Choose a Different Drive',
            { type: 'button' },
            on('click', async () => {
                ChooseButton.disabled = true
                try {
                    brainHandle = await connectBrain()
                    watch.refresh()
                    Dialog.dispatchEvent(new Event(closePopUpEvent))
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        throw error
                    }
                } finally {
                    ChooseButton.disabled = false
                }
            }),
        )
        const Dialog = PopUp(
            'The brain is not plugged in. Plug it in and press Send to ',
            'Brain again, or pick its drive afresh.',
            ChooseButton,
        )
        document.body.appendChild(Dialog)
    }

    const BrainButton = button(
        'Send to Brain',
        { type: 'button', id: 'brain-button' },
        on('click', async () => {
            if (unsupported) {
                explainUnsupported()
                return
            }
            BrainButton.disabled = true
            try {
                await send()
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    explainMissing()
                } else if (error.name !== 'AbortError') {
                    document.body.appendChild(
                        PopUp(
                            'The program could not be sent. ' +
                                describeSendError(error),
                        ),
                    )
                }
                watch.refresh()
            } finally {
                BrainButton.disabled = false
            }
        }),
    )
    BrainButton.hidden = true

    const watch = watchBrain((state, handle) => {
        brainHandle = handle
        unsupported = state === BrainState.UNSUPPORTED
        BrainButton.hidden = false
        BrainButton.textContent =
            state === BrainState.NONE ? 'Connect Brain' : 'Send to Brain'
    })

    return BrainButton
}
