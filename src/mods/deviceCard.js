/*
 * One device's card, as the Devices section of the toolbox shows it: its
 * name, then what it is. A drive motor: "is a drive motor on port [0] in
 * direction [clockwise]". A drivetrain: "is a drivetrain of", then a line
 * per motor, "[left_motor] left", and a button that adds a motor. Then a
 * remove button and a help button. The Devices pop-up (devicesDialog.js) draws one per device; the
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
 * A drivetrain's motors, a line each, picked from the program's drive
 * motors: the first, third... are its left wheels and the second,
 * fourth... its right. Each line has a button that takes the motor out,
 * while there are more than two, and a last button adds one.
 * @param {object} device A drivetrain.
 * @param {(patch: object) => void} change
 * @param {string[]} motors The program's drive motors, by name.
 * @returns {Array<HTMLElement>}
 */
const drivetrainFields = (device, change, motors) => {
    const list = device.motors
    const setMotors = (next) => change({ motors: next })
    // one no longer there is kept and shown, and with none picked the
    // choice is blank
    const motorChoices = (current) => {
        const names = [...new Set([...motors, current].filter(Boolean))]
        const choices = names.map((name) => [name, name])
        return current ? choices : [['', ''], ...choices]
    }
    const lines = list.map((motor, i) => {
        const side = i % 2 === 0 ? 'left' : 'right'
        const Motor = select(
            motorChoices(motor),
            motor,
            (name) => setMotors(list.map((m, j) => (j === i ? name : m))),
            `Motor ${i + 1}, ${side}`,
        )
        // a blank motor, or one that is not a drive motor (any more), is
        // marked, as the Issues list has it (blockLinter.js)
        if (!motors.includes(motor)) {
            Motor.setAttribute('aria-invalid', 'true')
        }
        return div(
            { class: 'toolbox-device-motor' },
            Motor,
            tag('span', side),
            // make needs at least two; null, not false, which would show as text
            list.length > 2
                ? button(
                      '×',
                      {
                          type: 'button',
                          class: 'toolbox-device-motor-remove',
                          'aria-label': `Take ${motor || 'this motor'} out`,
                          title: 'Take this motor out',
                      },
                      on('click', () =>
                          setMotors(list.filter((_, j) => j !== i)),
                      ),
                  )
                : null,
        )
    })
    const unused = motors.find((name) => !list.includes(name))
    return [
        tag('span', 'is a drivetrain of'),
        ...lines,
        button(
            '+ Add a motor',
            { type: 'button', class: 'toolbox-device-motor-add' },
            on('click', () => setMotors([...list, unused ?? ''])),
        ),
    ]
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
        return drivetrainFields(device, change, motors)
    }
    if (device.kind === 'variable') {
        const Value = tag('input', {
            type: 'number',
            step: 'any',
            value: device.value,
            'aria-label': 'Starts at',
            class: 'toolbox-device-number',
        })
        Value.addEventListener('change', () => change({ value: Value.value }))
        return [tag('span', 'is a variable that starts at'), Value]
    }
    const port = [
        tag('span', `is a ${kind.label} on port`),
        select(
            kind.ports.map((port) => [port, port]),
            device.port,
            (port) => change({ port }),
            'Port',
        ),
    ]
    return [
        ...port,
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
    // a device with no name is an error (blockLinter.js)
    if (!device.name) {
        NameInput.setAttribute('aria-invalid', 'true')
    }
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
        const controls = field.matches?.('select, input, button')
            ? [field]
            : [...(field.querySelectorAll?.('select, input, button') ?? [])]
        for (const control of controls) {
            if (control.tagName === 'BUTTON') {
                control.hidden = !onChange
            } else {
                control.disabled = !onChange
            }
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
