/*
 * One device's card: its name, then what it is, then a remove button and a
 * help button. The middle comes from its kind (its library's `card`): a
 * drive motor's "is a drive motor on port [0] in direction [clockwise]", a
 * drivetrain's motors a line each. The Devices pop-up (devicesDialog.js)
 * draws one per device; the library build (src/lib.js, mountDeviceCard)
 * puts one on a host's page on its own, so a lesson shows the real thing.
 */

import { button, div, on, tag } from 'ellipsi'

import { helpIcon } from '../assets'
import { cleanName, deviceKinds } from '../helpers/devicesHelper'

/**
 * Builds a device's card.
 * @param {{kind: string, name: string}} device With the kind's fields.
 * @param {object} [handlers] Leave one out and its control is not drawn.
 * @param {(patch: object) => void} [handlers.onChange] A field changed: the
 *     new value of it, or a name (cleaned) with `renamedFrom`.
 * @param {() => void} [handlers.onRemove] The remove button was pressed.
 * @param {() => void} [handlers.onHelp] The help button was pressed.
 * @param {object} [context]
 * @param {object[]} [context.devices] The program's devices, for a kind made
 *     from others (a drivetrain picks its motors from them).
 * @returns {HTMLElement}
 */
export const deviceCard = (
    device,
    { onChange, onRemove, onHelp } = {},
    { devices = [] } = {},
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

    const fields = kind.card(device, change, { devices })
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
