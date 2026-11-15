/*
 * One device's card, as the Devices section of the toolbox shows it: its
 * name, then "is a drive motor on port [0] in direction [clockwise]", a
 * remove button and a help button. The Devices panel (devicesPanel.js)
 * draws one per device; the library (src/lib.js, mountDeviceCard) puts one
 * on a host's page on its own, so a lesson shows the real thing.
 */

import { button, div, on, tag } from 'ellipsi'

import { helpIcon } from '../assets'
import { cleanName, deviceKinds } from '../helpers/devicesHelper'

/**
 * A select with these choices.
 * @param {Array<[string, string]>} choices [label, value] pairs.
 * @param {string} value The chosen value.
 * @param {(value: string) => void} onPick
 * @param {string} label What the select is for, for assistive tech.
 * @returns {HTMLSelectElement}
 */
const select = (choices, value, onPick, label) => {
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
 * Builds a device's card.
 * @param {{kind: string, name: string, port: string, direction: string}} device
 * @param {object} [handlers] Leave one out and its control is not drawn.
 * @param {(patch: object) => void} [handlers.onChange] A field changed: the
 *     new port or direction, or a name (cleaned) with `renamedFrom`.
 * @param {() => void} [handlers.onRemove] The remove button was pressed.
 * @param {() => void} [handlers.onHelp] The help button was pressed.
 * @returns {HTMLElement}
 */
export const deviceCard = (device, { onChange, onRemove, onHelp } = {}) => {
    const kind = deviceKinds[device.kind]
    const change = onChange ?? (() => {})

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
    NameInput.readOnly = !onChange
    // the name is taken when typing stops, not on every keystroke
    NameInput.addEventListener('change', () => {
        const name = cleanName(NameInput.value)
        if (name !== device.name) {
            change({ name, renamedFrom: device.name })
        } else {
            NameInput.value = name
        }
    })

    const Port = select(
        kind.ports.map((port) => [port, port]),
        device.port,
        (port) => change({ port }),
        'Port',
    )
    const Direction = select(
        kind.directions,
        device.direction,
        (direction) => change({ direction }),
        'Direction',
    )
    Port.disabled = Direction.disabled = !onChange

    return div(
        { class: 'toolbox-device', role: 'listitem' },
        div(
            { class: 'toolbox-device-head' },
            NameInput,
            onRemove &&
                button(
                    '×',
                    {
                        type: 'button',
                        class: 'toolbox-device-remove',
                        'aria-label': `Remove ${device.name || kind.label}`,
                        title: 'Remove',
                    },
                    on('click', onRemove),
                ),
        ),
        div(
            { class: 'toolbox-device-fields' },
            tag('span', `is a ${kind.label} on port`),
            Port,
            tag('span', 'in direction'),
            Direction,
            onHelp &&
                button(
                    {
                        type: 'button',
                        class: 'toolbox-device-help',
                        title: 'Help',
                        'aria-label': `Help with ${kind.label}s`,
                    },
                    tag('img', { src: helpIcon, alt: '' }),
                    on('click', onHelp),
                ),
        ),
    )
}
