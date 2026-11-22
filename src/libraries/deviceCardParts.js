/*
 * Parts a device kind's card is made of (its `card` in a library): a
 * select and a number box that call back with the new value. The card
 * itself (name, remove and help buttons) is mods/deviceCard.js.
 */

import { on, tag } from 'ellipsi'

/**
 * A select with these choices.
 * @param {Array<[string, string]>} choices [label, value] pairs.
 * @param {string} value The chosen value.
 * @param {(value: string) => void} onPick
 * @param {string} label What the select is for, for assistive tech.
 * @returns {HTMLSelectElement}
 */
export const select = (choices, value, onPick, label) => {
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
 * A box for a number, taken when the learner leaves it.
 * @param {string} value
 * @param {(value: string) => void} onPick
 * @param {string} label
 * @returns {HTMLInputElement}
 */
export const numberBox = (value, onPick, label) => {
    const element = tag('input', {
        type: 'number',
        step: 'any',
        value,
        'aria-label': label,
        class: 'toolbox-device-number',
    })
    element.addEventListener('change', () => onPick(element.value))
    return element
}
