/*
 * Devices: the motors and drivetrains a program sets up at its top
 * (helpers/devicesHelper.js). A "Devices" button pinned to the bottom right
 * of the workspace opens them in a pop-up: a card per device
 * (deviceCard.js) and buttons to add a drive motor or a drivetrain. The
 * devices live with the workspace; the pop-up is a view of them, drawn
 * again whenever they change.
 */

import { button, div, on, p, tag } from 'ellipsi'

import { categoryIcon } from '../assets'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import {
    deviceKinds,
    getDevices,
    nextName,
    nextPort,
    setDevices,
    watchDevices,
} from '../helpers/devicesHelper'
import { closePopUpEvent, PopUp } from '../helpers/popUpHelper'
import { getRoot } from '../helpers/rootHelper'
import { deviceCard } from './deviceCard'
import { renameDeviceInBlocks } from './deviceField'

/**
 * @param {object[]} devices
 * @returns {string[]} The drive motors among them, by name.
 */
const motorNames = (devices) =>
    devices
        .filter((device) => device.kind === 'drive_motor' && device.name)
        .map((device) => device.name)

/**
 * @param {object[]} devices
 * @returns {string} How many of each kind: "2 drive motors, 1 drivetrain".
 */
export const devicesSummary = (devices) =>
    Object.keys(deviceKinds)
        .map((kindName) => {
            const n = devices.filter((d) => d.kind === kindName).length
            const label = deviceKinds[kindName].label
            return n ? `${n} ${label}${n === 1 ? '' : 's'}` : ''
        })
        .filter(Boolean)
        .join(', ')

/**
 * The devices of a workspace, editable: a card per device and the add
 * buttons. Draws itself again when the devices change, from here or from a
 * program loading.
 * @param {object} workspace The program's workspace.
 * @param {object} [options]
 * @param {(blockName: string) => void} [options.onHelp] A card's help
 *     button was pressed, for the cheatsheet entry of this name.
 * @returns {{element: HTMLElement, destroy: () => void}}
 */
export const devicesEditor = (workspace, { onHelp } = {}) => {
    const devices = () => getDevices(workspace)
    const update = (list) => setDevices(workspace, list)

    const List = div({ class: 'toolbox-devices-list', role: 'list' })
    const Empty = p(
        { class: 'toolbox-devices-empty' },
        'Devices are set up at the top of your program, so your blocks ',
        'can use them by name.',
    )

    const row = (device, index) => {
        const kind = deviceKinds[device.kind]
        return deviceCard(
            device,
            {
                onChange: ({ renamedFrom, ...patch }) => {
                    update(
                        devices().map((other, i) => {
                            if (i === index) {
                                return { ...other, ...patch }
                            }
                            // a drivetrain made from a renamed motor follows the new name
                            if (
                                renamedFrom !== undefined &&
                                other.kind === 'drivetrain'
                            ) {
                                return {
                                    ...other,
                                    left:
                                        other.left === renamedFrom
                                            ? patch.name
                                            : other.left,
                                    right:
                                        other.right === renamedFrom
                                            ? patch.name
                                            : other.right,
                                }
                            }
                            return other
                        }),
                    )
                    // the blocks using the device follow its new name
                    if (renamedFrom !== undefined) {
                        renameDeviceInBlocks(workspace, renamedFrom, patch.name)
                    }
                },
                onRemove: () => update(devices().filter((_, i) => i !== index)),
                onHelp: () => onHelp?.(kind.help),
            },
            { motors: motorNames(devices()) },
        )
    }

    const draw = () => {
        const list = devices()
        List.replaceChildren(...list.map(row))
        Empty.hidden = list.length > 0
        List.hidden = list.length === 0
    }

    const element = div(
        { class: 'toolbox-devices devices-editor' },
        Empty,
        List,
        div(
            { class: 'toolbox-devices-adds' },
            button(
                'Add drive motor',
                { type: 'button', class: 'toolbox-devices-add' },
                on('click', () => {
                    const list = devices()
                    update([
                        ...list,
                        {
                            kind: 'drive_motor',
                            name: nextName(list, 'motor'),
                            port: nextPort(list, 'drive_motor'),
                            direction: '1',
                        },
                    ])
                }),
            ),
            button(
                'Add drivetrain',
                { type: 'button', class: 'toolbox-devices-add' },
                on('click', () => {
                    const list = devices()
                    const motors = motorNames(list)
                    update([
                        ...list,
                        {
                            kind: 'drivetrain',
                            name: nextName(list, 'drivetrain'),
                            left: motors[0] ?? 'left',
                            right: motors[1] ?? motors[0] ?? 'right',
                            drift: '1',
                        },
                    ])
                }),
            ),
        ),
    )

    draw()
    const stop = watchDevices((changed) => {
        if (changed === workspace) {
            draw()
        }
    })
    return { element, destroy: stop }
}

/**
 * The Devices button, for the bottom right of the workspace. It shows how
 * many devices there are and opens them in a pop-up.
 * @param {() => object|null} getWorkspace The program's workspace now (the
 *     workspace is rebuilt when the layout changes).
 * @returns {{element: HTMLElement, destroy: () => void}}
 */
export const devicesButton = (getWorkspace) => {
    const Count = tag('span', { class: 'devices-button-count' })
    const icon = categoryIcon('devices')

    const open = () => {
        const workspace = getWorkspace()
        if (!workspace) {
            return
        }
        let Dialog = null
        const editor = devicesEditor(workspace, {
            // the cheatsheet opens beside the editor, so the pop-up closes first
            onHelp: (blockName) => {
                Dialog?.dispatchEvent(new Event(closePopUpEvent))
                document.dispatchEvent(
                    new CustomEvent(openCheatSheetDrawerEvent, {
                        detail: { blockName },
                    }),
                )
            },
        })
        Dialog = PopUp(
            tag('h2', { class: 'devices-dialog-title' }, 'Devices'),
            editor.element,
        )
        Dialog.classList.add('devices-dialog')
        Dialog.addEventListener('close', editor.destroy)
        getRoot().appendChild(Dialog)
    }

    const Button = button(
        {
            type: 'button',
            class: 'devices-button',
            'aria-haspopup': 'dialog',
        },
        icon &&
            tag('img', { src: icon, alt: '', class: 'devices-button-icon' }),
        tag('span', 'Devices'),
        Count,
        on('click', open),
    )

    const count = () => {
        const workspace = getWorkspace()
        const n = workspace ? getDevices(workspace).length : 0
        Count.textContent = n ? String(n) : ''
        Count.hidden = n === 0
        Button.setAttribute(
            'aria-label',
            n
                ? `Devices: ${devicesSummary(getDevices(workspace))}`
                : 'Devices: none yet',
        )
    }
    count()
    const stop = watchDevices(count)
    return { element: Button, destroy: stop }
}
