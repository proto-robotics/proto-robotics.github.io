/*
 * One device's card, as the Devices section of the toolbox shows it: its
 * name, then what it is. A drive motor: "is a drive motor on port [0] in
 * direction [clockwise]". A drivetrain: "is a drivetrain from motors
 * [left] and [right] with drift [1]". Then a remove button and a help
 * button. The Devices panel (devicesPanel.js) draws one per device; the
 * library (src/lib.js, mountDeviceCard) puts one on a host's page on its
 * own, so a lesson shows the real thing.
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
 * The card's middle: what the device is and how it is set up.
 * @param {object} device
 * @param {(patch: object) => void} change
 * @param {string[]} motors The program's drive motors, by name.
 * @returns {Array<HTMLElement>} The parts of the line.
 */
const fieldsOf = (device, change, motors) => {
    const kind = deviceKinds[device.kind]
    if (device.kind === 'drivetrain') {
        // its motors, picked from the program's; one no longer there is kept and shown
        const motorChoices = (current) =>
            [...new Set([...motors, current].filter(Boolean))].map((name) => [
                name,
                name,
            ])
        const Drift = tag('input', {
            type: 'number',
            step: '0.01',
            value: device.drift,
            'aria-label': 'Drift',
            class: 'toolbox-device-number',
        })
        Drift.addEventListener('change', () => change({ drift: Drift.value }))
        return [
            tag('span', 'is a drivetrain from motors'),
            select(
                motorChoices(device.left),
                device.left,
                (left) => change({ left }),
                'Left motor',
            ),
            tag('span', 'and'),
            select(
                motorChoices(device.right),
                device.right,
                (right) => change({ right }),
                'Right motor',
            ),
            tag('span', 'with drift'),
            Drift,
        ]
    }
    return [
        tag('span', `is a ${kind.label} on port`),
        select(
            kind.ports.map((port) => [port, port]),
            device.port,
            (port) => change({ port }),
            'Port',
        ),
        tag('span', 'in direction'),
        select(
            kind.directions,
            device.direction,
            (direction) => change({ direction }),
            'Direction',
        ),
    ]
}

/**
 * Builds a device's card.
 * @param {{kind: string, name: string}} device With the kind's fields.
 * @param {object} [handlers] Leave one out and its control is not drawn.
 * @param {(patch: object) => void} [handlers.onChange] A field changed: the
 *     new value of it, or a name (cleaned) with `renamedFrom`.
 * @param {() => void} [handlers.onRemove] The remove button was pressed.
 * @param {() => void} [handlers.onHelp] The help button was pressed.
 * @param {object} [context]
 * @param {string[]} [context.motors] The program's drive motors by name, for
 *     a drivetrain's choice of motors.
 * @returns {HTMLElement}
 */
export const deviceCard = (
    device,
    { onChange, onRemove, onHelp } = {},
    { motors = [] } = {},
) => {
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

    const fields = fieldsOf(device, change, motors)
    for (const field of fields) {
        if (field.tagName === 'SELECT' || field.tagName === 'INPUT') {
            field.disabled = !onChange
        }
    }

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
            ...fields,
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
