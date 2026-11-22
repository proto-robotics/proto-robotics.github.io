/*
 * Devices and variables: what a program sets up at its top
 * (helpers/devicesHelper.js). One button, pinned to the bottom of the
 * toolbox column and drawn like a category tab, opens them in a pop-up: a
 * row per kind the editor's libraries offer (the core library's drive
 * motors, drivetrains and variables), each with a card per item
 * (deviceCard.js) and a tile that adds one. They live with the workspace;
 * the pop-up is a view of them, drawn again whenever they change.
 */

import { button, div, on, p, tag } from 'ellipsi'

import { categoryIcon } from '../assets'
import { blockSet } from '../libraries/engine'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import {
    deviceKinds,
    getDevices,
    removeDevice,
    setDevices,
    watchDevices,
    renameMotor,
} from '../helpers/devicesHelper'
import {
    closeOnClickOutside,
    closePopUpEvent,
    PopUp,
} from '../helpers/popUpHelper'
import { getRoot } from '../helpers/rootHelper'
import { deviceCard } from './deviceCard'
import { renameDeviceInBlocks } from './deviceField'

/**
 * The kinds the editor's libraries offer, devices first and then
 * variables, each group in its libraries' order.
 * @returns {string[]}
 */
const offeredKinds = () => {
    const kinds = Object.entries(blockSet().deviceKinds)
    return [
        ...kinds.filter(([, kind]) => kind.group !== 'variables'),
        ...kinds.filter(([, kind]) => kind.group === 'variables'),
    ].map(([name]) => name)
}

/**
 * @param {object[]} devices
 * @param {string[]} kinds The kinds to count.
 * @returns {string} How many of each kind: "2 drive motors, 1 drivetrain".
 */
const devicesSummary = (devices, kinds) =>
    kinds
        .map((kindName) => {
            const n = devices.filter((d) => d.kind === kindName).length
            const label = deviceKinds[kindName].label
            return n ? `${n} ${label}${n === 1 ? '' : 's'}` : ''
        })
        .filter(Boolean)
        .join(', ')

/**
 * The devices (or variables) of a workspace, editable: a row per kind, each
 * a picture and a grid of cards with an add tile. Draws itself again when
 * they change, from here or from a program loading.
 * @param {object} workspace The program's workspace.
 * @param {object} [options]
 * @param {string[]} [options.kinds] The kinds to show, a row each.
 * @param {string} [options.intro] The line above the rows.
 * @param {(blockName: string) => void} [options.onHelp] A card's help
 *     button was pressed, for the cheatsheet entry of this name.
 * @returns {{element: HTMLElement, destroy: () => void}}
 */
const devicesEditor = (
    workspace,
    {
        kinds = offeredKinds(),
        intro = 'Devices are set up at the top of your program, so your blocks can use them by name.',
        onHelp,
    } = {},
) => {
    const devices = () => getDevices(workspace)
    const update = (list) => setDevices(workspace, list)

    const card = (device, index) => {
        const kind = deviceKinds[device.kind]
        return deviceCard(
            device,
            {
                onChange: ({ renamedFrom, ...patch }) => {
                    const changed = devices().map((other, i) =>
                        i === index ? { ...other, ...patch } : other,
                    )
                    // a device made from a renamed one (a drivetrain from
                    // its motors) follows the new name
                    update(
                        renamedFrom !== undefined
                            ? renameMotor(changed, renamedFrom, patch.name)
                            : changed,
                    )
                    // the blocks using it follow its new name
                    if (renamedFrom !== undefined) {
                        renameDeviceInBlocks(workspace, renamedFrom, patch.name)
                    }
                },
                onRemove: () => {
                    const list = devices()
                    const gone = list[index]?.name
                    // what used it is left blank, to be picked again
                    // (unless another one has its name)
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
            { devices: devices() },
        )
    }

    // One row per kind: its picture and name on the left, and on the right
    // a box of its cards that fills left to right and wraps into a grid,
    // ending in a tile that adds another.
    const rows = kinds.map((kindName) => {
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
                update([...list, kind.fresh(list)])
            }),
        )
        const picture = kind.picture
        const Row = div(
            { class: 'devices-row' },
            div(
                { class: 'devices-row-head' },
                picture &&
                    tag('img', {
                        src: picture,
                        alt: '',
                        class: `devices-row-picture devices-row-picture-${kindName}`,
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
        p({ class: 'toolbox-devices-empty' }, intro),
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
 * A button that opens some kinds in a pop-up, and closes it again on a
 * second press or a click outside it. It shows how many there are.
 * @param {() => object|null} getWorkspace The program's workspace now (the
 *     workspace is rebuilt when the layout changes).
 * @param {object} options
 * @param {string} options.title The button's word and the pop-up's heading.
 * @param {string[]} options.kinds The kinds it shows.
 * @param {string} options.intro The pop-up's first line.
 * @param {string} options.className The button's class.
 * @param {string|null} options.icon The button's picture.
 * @returns {{element: HTMLButtonElement, show: () => void, destroy: () => void}}
 */
const listButton = (
    getWorkspace,
    { title, label = title, heading = title, kinds, intro, className, icons },
) => {
    const Count = tag('span', { class: 'devices-button-count' })

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
            kinds,
            intro,
            // the cheatsheet opens beside the editor, so the pop-up closes first
            onHelp: (blockName) => {
                close()
                document.dispatchEvent(
                    new CustomEvent(openCheatSheetDrawerEvent, {
                        detail: { blockName },
                    }),
                )
            },
        })
        Dialog = PopUp(
            tag('h2', { class: 'devices-dialog-title' }, heading),
            editor.element,
        )
        Dialog.classList.add('devices-dialog')
        Dialog.addEventListener('close', () => {
            editor.destroy()
            Dialog = null
        })
        // a click outside the pop-up (the button's too) closes it
        closeOnClickOutside(Dialog)
        getRoot().appendChild(Dialog)
    }

    // its icons overlap into one picture (styles.css)
    const pictures = icons.filter(Boolean)
    const Button = button(
        { type: 'button', class: className, 'aria-haspopup': 'dialog' },
        pictures.length &&
            tag(
                'span',
                { class: 'devices-button-icons', 'aria-hidden': 'true' },
                ...pictures.map((src) =>
                    tag('img', { src, alt: '', class: 'devices-button-icon' }),
                ),
            ),
        tag('span', { class: 'devices-button-label' }, label),
        Count,
        on('click', open),
    )

    const count = () => {
        const workspace = getWorkspace()
        const list = workspace
            ? getDevices(workspace).filter((d) => kinds.includes(d.kind))
            : []
        Count.textContent = list.length ? String(list.length) : ''
        Count.hidden = list.length === 0
        Button.setAttribute(
            'aria-label',
            list.length
                ? `${title}: ${devicesSummary(list, kinds)}`
                : `${title}: none yet`,
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
        destroy: stop,
    }
}

/**
 * The Devices button, for the bottom of the toolbox column, as wide as the
 * column. It shows how many devices and variables there are and opens them
 * in one pop-up.
 * @param {() => object|null} getWorkspace The program's workspace now.
 * @returns {{element: HTMLElement, show: () => void, destroy: () => void}}
 */
export const devicesButton = (getWorkspace) => {
    const list = listButton(getWorkspace, {
        title: 'Devices and Variables',
        // two short lines, to fit the toolbox column
        label: 'Devices &\nVariables',
        kinds: offeredKinds(),
        intro: 'Devices and variables are set up at the top of your program, so your blocks can use them by name. A variable is a number your program remembers; it starts at its value, and Set and Change blocks change it.',
        className: 'devices-button',
        icons: [categoryIcon('devices'), categoryIcon('variables')],
    })
    const Button = list.element

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

    return {
        element: Button,
        show: list.show,
        destroy: () => {
            list.destroy()
            cancelAnimationFrame(frame)
            window.removeEventListener('resize', fit)
            sizer.disconnect()
        },
    }
}
