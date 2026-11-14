/*
 * The Devices section of the toolbox: a panel in the flyout, under the
 * "Devices" heading, where the motors a program sets up are added and
 * edited. Like the search field (searchField.js) it is a flyout item of its
 * own kind, `devices_panel`, so it is laid out, scrolled and clipped with
 * the blocks; the HTML sits in an SVG foreignObject drawn back up to full
 * size against the flyout's zoom. The devices themselves live with the
 * workspace (helpers/devicesHelper.js); the panel is a view of them.
 */

import * as Blockly from 'blockly'
import { button, div, on, p, tag } from 'ellipsi'

import { helpIcon } from '../assets'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import {
    cleanName,
    deviceKinds,
    getDevices,
    nextName,
    nextPort,
    setDevices,
    watchDevices,
} from '../helpers/devicesHelper'
import { renameDeviceInBlocks } from './deviceField'

/** The flyout item kind, as named in a category's contents. */
export const DEVICES_PANEL_KIND = 'devices_panel'

/** The toolbox category that holds the panel. */
export const devicesCategory = {
    kind: 'category',
    name: 'Devices',
    colour: '#5f6b7a',
    contents: [{ kind: DEVICES_PANEL_KIND }],
}

/** The panel's width on screen, in pixels, and its height before measuring. */
const PANEL_WIDTH = 250
const MIN_HEIGHT = 40

/** Pointer and key events the panel keeps to itself: Blockly must not start
 * a flyout drag from a tap on a select, nor see a Backspace in the name. */
const KEPT_EVENTS = [
    'pointerdown',
    'mousedown',
    'touchstart',
    'keydown',
    'keyup',
]

/** The panel: a flyout element positioned and drawn like a block or label. */
class DevicesPanel {
    /**
     * @param {Blockly.IFlyout} flyout The flyout the panel belongs to.
     */
    constructor(flyout) {
        this.flyout = flyout
        this.workspace = flyout.getWorkspace()
        this.position = new Blockly.utils.Coordinate(0, 0)
        this.scale = flyout.getFlyoutScale()
        this.width = PANEL_WIDTH / this.scale
        this.height = MIN_HEIGHT / this.scale
        this.drawn = false

        this.svgGroup = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.G,
            { class: 'blocklyFlyoutDevices' },
            this.workspace.getCanvas(),
        )
        this.frame = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FOREIGNOBJECT,
            { width: this.width, height: this.height },
            this.svgGroup,
        )

        this.List = div({ class: 'toolbox-devices-list', role: 'list' })
        this.Empty = p(
            { class: 'toolbox-devices-empty' },
            'Devices are set up at the top of your program, so your blocks ',
            'can use them by name.',
        )
        // the list folds away, to get to the blocks below sooner
        this.open = true
        this.ToggleText = tag('span')
        this.Toggle = button(
            {
                type: 'button',
                class: 'toolbox-devices-toggle',
                'aria-expanded': 'true',
            },
            tag(
                'span',
                {
                    class: 'toolbox-devices-toggle-arrow',
                    'aria-hidden': 'true',
                },
                '▾',
            ),
            this.ToggleText,
            on('click', () => {
                this.open = !this.open
                this.relayout()
            }),
        )
        this.root = div(
            { class: 'toolbox-devices' },
            this.Empty,
            this.Toggle,
            this.List,
            button(
                'Add drive motor',
                { type: 'button', class: 'toolbox-devices-add' },
                on('click', () => {
                    const devices = this.devices()
                    this.update([
                        ...devices,
                        {
                            kind: 'drive_motor',
                            name: nextName(devices, 'motor'),
                            port: nextPort(devices, 'drive_motor'),
                            direction: '1',
                        },
                    ])
                }),
            ),
        )
        Object.assign(this.root.style, {
            width: `${PANEL_WIDTH}px`,
            transform: `scale(${1 / this.scale})`,
            transformOrigin: '0 0',
        })
        for (const type of KEPT_EVENTS) {
            this.root.addEventListener(type, (event) => event.stopPropagation())
        }
        this.frame.appendChild(this.root)
    }

    /** @returns {object[]} The devices of the workspace the flyout serves. */
    devices() {
        return getDevices(this.flyout.targetWorkspace)
    }

    /**
     * Stores a changed list of devices. The watcher (below) then has the
     * flyout redrawn, which draws the list again.
     * @param {object[]} devices
     */
    update(devices) {
        setDevices(this.flyout.targetWorkspace, devices)
    }

    /**
     * Puts the panel back at the origin for the flyout to lay out, draws
     * the list if the devices have changed, and takes its height.
     */
    reset() {
        this.moveTo(0, 0)
        if (!this.svgGroup.isConnected) {
            this.workspace.getCanvas().appendChild(this.svgGroup)
        }
        // a redraw while a name is being typed would lose the typing
        if (!this.drawn || !this.root.contains(document.activeElement)) {
            this.draw()
        }
        this.measure()
    }

    /** Has the flyout laid out again, and the panel drawn afresh in it. */
    relayout() {
        this.drawn = false
        this.flyout.targetWorkspace.getToolbox()?.refreshSelection()
    }

    /** Draws the list from the workspace's devices. */
    draw() {
        const devices = this.devices()
        this.List.replaceChildren(
            ...devices.map((device, i) => this.row(device, i)),
        )
        this.Empty.hidden = devices.length > 0
        this.Toggle.hidden = devices.length === 0
        this.ToggleText.textContent =
            devices.length === 1
                ? '1 drive motor'
                : `${devices.length} drive motors`
        this.Toggle.setAttribute('aria-expanded', String(this.open))
        this.Toggle.classList.toggle('closed', !this.open)
        this.List.hidden = !this.open || devices.length === 0
        this.drawn = true
    }

    /** Sizes the item to the panel as drawn. */
    measure() {
        const devices = this.devices().length
        // the panel measures nothing while the flyout is hidden
        const estimate = 90 + (this.open ? devices * 92 : 0)
        const shown = this.root.offsetHeight || estimate
        this.height = Math.max(MIN_HEIGHT, shown) / this.scale
        this.frame.setAttribute('height', this.height)
    }

    /**
     * A select element with the given choices.
     * @param {Array<[string, string]>} choices [label, value] pairs.
     * @param {string} value The chosen value.
     * @param {(value: string) => void} onPick
     * @param {string} label What the select is for, for assistive tech.
     * @returns {HTMLSelectElement}
     */
    select(choices, value, onPick, label) {
        const element = tag(
            'select',
            { 'aria-label': label },
            ...choices.map(([text, choice]) =>
                tag('option', { value: choice }, text),
            ),
            on('change', () => onPick(element.value)),
        )
        element.value = value
        return element
    }

    /**
     * One editable device.
     * @param {object} device
     * @param {number} index Its place in the list.
     * @returns {HTMLElement}
     */
    row(device, index) {
        const kind = deviceKinds[device.kind]
        const change = (patch) =>
            this.update(
                this.devices().map((other, i) =>
                    i === index ? { ...other, ...patch } : other,
                ),
            )

        const NameInput = tag('input', {
            type: 'text',
            value: device.name,
            placeholder: 'name',
            'aria-label': 'Device name',
            autocomplete: 'off',
            autocorrect: 'off',
            autocapitalize: 'off',
            spellcheck: 'false',
        })
        // the name is taken when typing stops, not on every keystroke, and
        // the blocks using the device follow it
        NameInput.addEventListener('change', () => {
            const name = cleanName(NameInput.value)
            if (name !== device.name) {
                change({ name })
                renameDeviceInBlocks(
                    this.flyout.targetWorkspace,
                    device.name,
                    name,
                )
            } else {
                NameInput.value = name
            }
        })

        return div(
            { class: 'toolbox-device', role: 'listitem' },
            div(
                { class: 'toolbox-device-head' },
                NameInput,
                button(
                    '×',
                    {
                        type: 'button',
                        class: 'toolbox-device-remove',
                        'aria-label': `Remove ${device.name || kind.label}`,
                        title: 'Remove',
                    },
                    on('click', () =>
                        this.update(
                            this.devices().filter((_, i) => i !== index),
                        ),
                    ),
                ),
            ),
            div(
                { class: 'toolbox-device-fields' },
                tag('span', `is a ${kind.label} on port`),
                this.select(
                    kind.ports.map((port) => [port, port]),
                    device.port,
                    (port) => change({ port }),
                    'Port',
                ),
                tag('span', 'in direction'),
                this.select(
                    kind.directions,
                    device.direction,
                    (direction) => change({ direction }),
                    'Direction',
                ),
                button(
                    {
                        type: 'button',
                        class: 'toolbox-device-help',
                        title: 'Help',
                        'aria-label': `Help with ${kind.label}s`,
                    },
                    tag('img', { src: helpIcon, alt: '' }),
                    on('click', () =>
                        document.dispatchEvent(
                            new CustomEvent(openCheatSheetDrawerEvent, {
                                detail: { blockName: kind.help },
                            }),
                        ),
                    ),
                ),
            ),
        )
    }

    // ---- IBoundedElement ----

    getBoundingRectangle() {
        return new Blockly.utils.Rect(
            this.position.y,
            this.position.y + this.height,
            this.position.x,
            this.position.x + this.width,
        )
    }

    moveBy(dx, dy) {
        this.moveTo(this.position.x + dx, this.position.y + dy)
    }

    moveTo(x, y) {
        this.position.x = x
        this.position.y = y
        this.svgGroup.setAttribute('transform', `translate(${x},${y})`)
    }

    // ---- IRenderedElement ----

    getSvgRoot() {
        return this.svgGroup
    }
}

/** @type {WeakMap<Blockly.IFlyout, DevicesPanel>} One panel per flyout. */
const panels = new WeakMap()

// When a workspace's devices change, by the panel or by a program loading,
// its flyout is drawn again (the plugin debounces this) and the panel with
// it, at its new height.
watchDevices((workspace) => {
    const flyout = workspace.getFlyout?.()
    const panel = flyout && panels.get(flyout)
    if (!panel) {
        return
    }
    panel.drawn = false
    workspace.getToolbox()?.refreshSelection()
})

/**
 * Makes the `devices_panel` items. A flyout gets one panel, kept across its
 * redraws (every show disposes and recreates the items) and removed with
 * the flyout's workspace.
 */
export class DevicesPanelInflater {
    load(state, flyout) {
        let panel = panels.get(flyout)
        if (!panel) {
            panel = new DevicesPanel(flyout)
            panels.set(flyout, panel)
        }
        panel.reset()
        return new Blockly.FlyoutItem(panel, DEVICES_PANEL_KIND)
    }

    gapForItem(state, defaultGap) {
        return defaultGap
    }

    disposeItem() {
        // kept for the next show; it goes with the flyout's workspace
    }

    getType() {
        return DEVICES_PANEL_KIND
    }
}
