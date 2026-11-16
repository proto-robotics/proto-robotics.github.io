/*
 * Devices: the motors and drivetrains a program sets up at its top
 * (helpers/devicesHelper.js). A "Devices" button pinned to the bottom of
 * the toolbox column, drawn like a category tab, opens them in a pop-up: a card per device
 * (deviceCard.js) and buttons to add a drive motor or a drivetrain. The
 * devices live with the workspace; the pop-up is a view of them, drawn
 * again whenever they change.
 */

import { button, div, on, p, tag } from 'ellipsi'

import { categoryIcon, deviceIcon } from '../assets'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import {
    deviceKinds,
    getDevices,
    nextName,
    nextPort,
    removeDevice,
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
 * The devices of a workspace, editable: a row per kind (drive motors,
 * drivetrains), each a picture and a grid of cards with an add tile. Draws itself again when the devices change, from here or from a
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

    const card = (device, index) => {
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
                onRemove: () => {
                    const list = devices()
                    const gone = list[index]?.name
                    // what used it is left blank, to be picked again
                    // (unless another device has its name)
                    const blank = !list.some(
                        (other, i) => i !== index && other.name === gone,
                    )
                    update(removeDevice(list, index))
                    if (blank) {
                        renameDeviceInBlocks(workspace, gone, '')
                    }
                },
                onHelp: () => onHelp?.(kind.help),
            },
            { motors: motorNames(devices()) },
        )
    }

    /** A new device of each kind, given the devices there are. */
    const fresh = {
        drive_motor: (list) => ({
            kind: 'drive_motor',
            name: nextName(list, 'motor'),
            port: nextPort(list, 'drive_motor'),
            direction: '1',
        }),
        drivetrain: (list) => {
            const motors = motorNames(list)
            return {
                kind: 'drivetrain',
                name: nextName(list, 'drivetrain'),
                left: motors[0] ?? '',
                right: motors[1] ?? '',
                drift: '1',
            }
        },
    }

    // One row per kind: its picture and name on the left, and on the right
    // a box of its cards that fills left to right and wraps into a grid,
    // ending in a tile that adds another.
    const rows = Object.keys(fresh).map((kindName) => {
        const kind = deviceKinds[kindName]
        const Box = div({ class: 'devices-row-box', role: 'list' })
        const Add = button(
            { type: 'button', class: 'devices-add-tile' },
            tag(
                'span',
                { class: 'devices-add-plus', 'aria-hidden': 'true' },
                '+',
            ),
            tag('span', `Add ${kind.label}`),
            on('click', () => {
                const list = devices()
                update([...list, fresh[kindName](list)])
            }),
        )
        const picture = deviceIcon(kindName)
        const Row = div(
            { class: 'devices-row' },
            div(
                { class: 'devices-row-head' },
                picture &&
                    tag('img', {
                        src: picture,
                        alt: '',
                        class: 'devices-row-picture',
                    }),
                tag('span', { class: 'devices-row-name' }, `${kind.label}s`),
            ),
            Box,
        )
        return { kindName, Box, Add, Row }
    })

    const draw = () => {
        const list = devices()
        for (const { kindName, Box, Add } of rows) {
            Box.replaceChildren(
                ...list
                    .map((device, index) => ({ device, index }))
                    .filter(({ device }) => device.kind === kindName)
                    .map(({ device, index }) => card(device, index)),
                Add,
            )
        }
    }

    const element = div(
        { class: 'toolbox-devices devices-editor' },
        p(
            { class: 'toolbox-devices-empty' },
            'Devices are set up at the top of your program, so your blocks ',
            'can use them by name.',
        ),
        ...rows.map(({ Row }) => Row),
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
 * The Devices button, for the bottom of the toolbox column, as wide as the
 * column. It shows how many devices there are and opens them in a pop-up.
 * @param {() => object|null} getWorkspace The program's workspace now (the
 *     workspace is rebuilt when the layout changes).
 * @returns {{element: HTMLElement, show: () => void, destroy: () => void}}
 */
export const devicesButton = (getWorkspace) => {
    const Count = tag('span', { class: 'devices-button-count' })
    const icon = categoryIcon('devices')

    // the open pop-up, if any: the button closes it again
    let Dialog = null
    const close = () => Dialog?.dispatchEvent(new Event(closePopUpEvent))

    const open = () => {
        if (Dialog) {
            close()
            return
        }
        const workspace = getWorkspace()
        if (!workspace) {
            return
        }
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
        Dialog.addEventListener('close', () => {
            editor.destroy()
            Dialog = null
        })
        // a click outside the pop-up closes it. It is modal, so its
        // backdrop takes every click outside it (the button's too), and
        // they reach the dialog itself, outside its box.
        Dialog.addEventListener('click', (event) => {
            if (event.target !== Dialog) {
                return
            }
            const box = Dialog.getBoundingClientRect()
            const inside =
                event.clientX >= box.left &&
                event.clientX <= box.right &&
                event.clientY >= box.top &&
                event.clientY <= box.bottom
            if (!inside) {
                close()
            }
        })
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

    // as wide as the toolbox column, which is as wide as its widest tab;
    // the workspace (and its toolbox) is rebuilt when the layout changes
    let watched = null
    const sizer = new ResizeObserver(() => fit())
    const fit = () => {
        const toolbox = getWorkspace()?.getToolbox?.()
        const column = toolbox?.HtmlDiv ?? null
        if (column !== watched) {
            sizer.disconnect()
            if (column) {
                sizer.observe(column)
            }
            watched = column
        }
        const width = column?.offsetWidth
        if (width) {
            Button.style.setProperty('--toolbox-width', `${width}px`)
        }
    }
    const frame = requestAnimationFrame(fit)
    window.addEventListener('resize', fit)

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
    return {
        element: Button,
        /** Opens the pop-up, if it is not open. */
        show: () => {
            if (!Dialog) {
                open()
            }
        },
        destroy: () => {
            stop()
            cancelAnimationFrame(frame)
            window.removeEventListener('resize', fit)
            sizer.disconnect()
        },
    }
}
