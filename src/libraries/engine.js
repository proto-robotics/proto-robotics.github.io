/*
 * The block engine. The editor has no blocks of its own: everything about
 * blocks comes from libraries, spliced together into one block set per
 * editor. The IDE's page uses [core, make] (core/, make/); a host site
 * passes its own list through the library build (src/lib.js), such as
 * core plus a sandbox world's library.
 *
 * A library (all optional but `name` and `categories`):
 *   name        what it is called, for messages
 *   brain       true for a library of the real robot: its editors get Send to Brain
 *   preamble    the program's first line (core: `from make import *`)
 *   categories  [{ name, color, icon, hidden, devices, entries }]: blocks and
 *               cheatsheet examples, made with the kit (kit.js). A category
 *               named like one an earlier library has adds its blocks to
 *               it; the first one sets its color, icon and place
 *   devices     { kind: DeviceKind }: what the Devices pop-up sets up
 *   hides       block types of earlier libraries to leave out (a world that
 *               cannot show them)
 *   renames     { blocks: {old: new}, devices: {old: new}, migrate(state) }
 *               for old programs: migrate first, then the renames
 *   lint        { zeroTime: {type: message}, longTime: [type],
 *               emptySlot: {type: [severity, message]} } for its blocks
 *   takenNames  Python names the program must not use for a device
 *   vocab       Python names its blocks write, for the line editor
 *
 * Splicing registers the blocks with Blockly (through @protorobotics/jenga)
 * and records them in a registry of every library seen on the page. Facts
 * about one block type or device kind (is it a step, its number slots, how
 * to lint it) are read from the registry; what an editor offers (toolbox,
 * cheatsheet, Devices) from its block set.
 */

import { FieldImage, FieldNumber } from 'blockly'
import { Order, pythonGenerator } from 'blockly/python'
import { processJengaTower } from '@protorobotics/jenga'

import { helpIcon } from '../assets'
import { addVocab } from '../data/vocab'
import { openCheatSheetDrawerEvent } from '../helpers/cheatSheetDrawerHelper'
import { filterToolbox } from '../helpers/editorParamsHelper'
import { deviceKinds, deviceRenames } from '../helpers/devicesHelper'
import { numberShadows, field, numberOut, block } from './kit'

/**
 * @typedef {object} DeviceKind
 * @property {string} label What it is called: "drive motor".
 * @property {'devices'|'variables'} group Which row of the pop-up it is in.
 * @property {string} help The cheatsheet entry its help button opens.
 * @property {string} base The name a new one starts from.
 * @property {string} [preview] Its name in a cheatsheet block's picture.
 * @property {string} [picture] Its picture's URL.
 * @property {number} [order] Where its line goes in the program (later after).
 * @property {string[]} [ports] Its ports.
 * @property {(device: object) => string} code Its line of Python.
 * @property {(device: object) => object} clean A saved one, checked.
 * @property {(devices: object[]) => object} fresh A new one.
 * @property {(device: object, change: Function, context: object) => HTMLElement[]} card
 *     The middle of its card: what it is and how it is set up.
 * @property {(device: object, from: string, to: string) => object} [renameMotor]
 *     Itself with a device it is made from renamed.
 */

/**
 * @typedef {object} Library
 * @property {string} name
 * @property {object[]} categories
 */

// ---- the registry: every library spliced on this page -----------------------

/** Device kinds by name, from every library, and old kind names to today's (devicesHelper.js holds them). */
export { deviceKinds, deviceRenames }
/** Old block types to today's. */
export const blockRenames = {}
/** The libraries' own migrations of old programs, in order. */
export const migrations = []
/** Block types that are steps: they only belong in loops. */
export const stepBlockTypes = new Set()
/** Block types that run what is inside them again and again. */
export const loopBlockTypes = new Set()
/** Each block type's number slots: slot name to the slot's hidden number block type. */
export const numberSlots = {}
/** The hidden number block types. */
export const numberShadowTypes = new Set()
/** Lint rules by block type. */
export const lintRules = { zeroTime: {}, longTime: new Set(), emptySlot: {} }
/** Every category's color and icon, by name, for the toolbox tabs. */
export const categoryLooks = {}
/** Every block entry by type, with its category, for describing a block. */
export const blockEntries = {}

const registered = new WeakSet()

/** Records a library's facts in the registry, once. */
const register = (library) => {
    if (registered.has(library)) {
        return
    }
    registered.add(library)
    Object.assign(deviceKinds, library.devices ?? {})
    Object.assign(deviceRenames, library.renames?.devices ?? {})
    Object.assign(blockRenames, library.renames?.blocks ?? {})
    if (library.renames?.migrate) {
        migrations.push(library.renames.migrate)
    }
    Object.assign(lintRules.zeroTime, library.lint?.zeroTime ?? {})
    for (const type of library.lint?.longTime ?? []) {
        lintRules.longTime.add(type)
    }
    Object.assign(lintRules.emptySlot, library.lint?.emptySlot ?? {})
    if (library.vocab) {
        addVocab(library.vocab)
    }
    for (const category of library.categories) {
        const look = (categoryLooks[category.name] ??= { color: category.color, icon: category.icon })
        look.icon ??= category.icon
        for (const entry of category.entries) {
            if (entry.entryType === 'example') {
                entry.workspace.blocks.blocks = entry.workspace.blocks.blocks.map(numbersToSlots)
                continue
            }
            blockEntries[entry.name] = { entry, category }
            if (entry.step) stepBlockTypes.add(entry.name)
            if (entry.loop) loopBlockTypes.add(entry.name)
            numberSlots[entry.name] = Object.fromEntries(
                entry.blocklyTemplate
                    .filter((part) => part.blocklyInput?.type === 'Number')
                    .map((part) => [part.blocklyInput.name, part.blocklyInput.shadow]),
            )
        }
    }
}

/**
 * A saved block (and everything in and under it) with its numbers in
 * their slots: a number given as a field ({ power: 50 }) becomes the
 * slot's default block holding it, and a number block in a slot takes the
 * slot's own default type. Examples and tests write numbers as fields.
 * @param {object} blockState
 * @returns {object}
 */
export const numbersToSlots = (blockState) => {
    if (!blockState || typeof blockState !== 'object') {
        return blockState
    }
    const slots = numberSlots[blockState.type] ?? slotsOfEntry(blockState.type)
    const fields = { ...(blockState.fields ?? {}) }
    const inputs = { ...(blockState.inputs ?? {}) }
    for (const [name, shadowType] of Object.entries(slots)) {
        if (typeof fields[name] === 'number') {
            inputs[name] = {
                ...inputs[name],
                shadow: { type: shadowType, fields: { operation: fields[name] } },
            }
            delete fields[name]
        }
    }
    for (const [name, input] of Object.entries(inputs)) {
        inputs[name] = {
            ...input,
            ...(input.block ? { block: numbersToSlots(input.block) } : {}),
        }
    }
    return {
        ...blockState,
        fields,
        ...(Object.keys(inputs).length ? { inputs } : {}),
        ...(blockState.next?.block ? { next: { block: numbersToSlots(blockState.next.block) } } : {}),
    }
}

/** A block's slots before its library is registered (examples are read while registering). */
const pending = {}
const slotsOfEntry = (type) => pending[type] ?? {}

// ---- splicing ---------------------------------------------------------------

/** The hidden number blocks, one per default value the kit has made. */
const numbersCategory = () => ({
    name: 'Numbers',
    color: '#9a9a9a',
    hidden: true,
    entries: [...numberShadows].map(([type, value]) => {
        numberShadowTypes.add(type)
        return block(
            type,
            'A number.',
            [field('operation', () => new FieldNumber(value))],
            (b) => [`${b.getFieldValue('operation')}`, Order.ATOMIC],
            numberOut,
        )
    }),
})

/** A block's entry with the help button that opens its cheatsheet entry. */
const withHelp = (entry) => ({
    ...entry,
    blocklyTemplate: [
        ...entry.blocklyTemplate,
        {
            field: () =>
                new FieldImage(helpIcon, 15, 15, 'Info', () => {
                    document.dispatchEvent(
                        new CustomEvent(openCheatSheetDrawerEvent, { detail: { blockName: entry.name } }),
                    )
                }),
            name: 'info_icon',
        },
    ],
})

/** The block types a saved workspace uses (its blocks, with what is in and under them). */
const typesIn = (blocks) => {
    const types = new Set()
    const walk = (b) => {
        if (!b?.type) return
        types.add(b.type)
        for (const input of Object.values(b.inputs ?? {})) {
            walk(input.block)
            walk(input.shadow)
        }
        walk(b.next?.block)
    }
    blocks.forEach(walk)
    return types
}

/**
 * @typedef {object} BlockSet What one editor offers: its libraries spliced.
 * @property {Library[]} libraries
 * @property {object[]} categories Merged, in order, with only the blocks it has.
 * @property {Set<string>} blockTypes Every block type it has.
 * @property {object} toolbox The full Blockly toolbox, before a page narrows it.
 * @property {object[]} cheatsheet Categories with their blocks and examples, for the cheatsheet.
 * @property {Record<string, DeviceKind>} deviceKinds The kinds its Devices pop-up offers.
 * @property {string} preamble The program's first line.
 * @property {Set<string>} takenNames Names a device must not have.
 * @property {string[]} hiddenCategoryNames Categories left out unless a page asks for them.
 */

/**
 * Splices libraries into one block set: categories of the same name merge
 * (the first sets the color, icon and place), blocks a later library hides
 * go, and examples that need a block the set does not have are left out.
 * Registers the blocks with Blockly, so a block set is ready to mount.
 * @param {Library[]} libraries In order: core first.
 * @returns {BlockSet}
 */
export const splice = (libraries) => {
    const numbers = { name: 'numbers', categories: [numbersCategory()] }
    const all = [...libraries, numbers]
    for (const library of all) {
        for (const category of library.categories) {
            for (const entry of category.entries) {
                if (entry.entryType !== 'example') {
                    pending[entry.name] = Object.fromEntries(
                        entry.blocklyTemplate
                            .filter((part) => part.blocklyInput?.type === 'Number')
                            .map((part) => [part.blocklyInput.name, part.blocklyInput.shadow]),
                    )
                }
            }
        }
    }
    all.forEach(register)

    const hidden = new Set(libraries.flatMap((library) => library.hides ?? []))
    const merged = []
    for (const library of all) {
        for (const category of library.categories) {
            let into = merged.find((c) => c.name === category.name)
            if (!into) {
                into = { name: category.name, color: category.color, icon: category.icon, hidden: category.hidden, devices: [], entries: [] }
                merged.push(into)
            }
            into.devices.push(...(category.devices ?? []))
            into.entries.push(...category.entries.filter((entry) => entry.entryType === 'example' || !hidden.has(entry.name)))
        }
    }
    const blockTypes = new Set(
        merged.flatMap((category) => category.entries.filter((e) => e.entryType !== 'example').map((e) => e.name)),
    )
    // an example that needs a block this set does not have would not load
    const categories = merged.map((category) => ({
        ...category,
        entries: category.entries.filter(
            (entry) => entry.entryType !== 'example' || [...typesIn(entry.workspace.blocks.blocks)].every((t) => blockTypes.has(t)),
        ),
    }))

    const blocksOf = (category) => category.entries.filter((entry) => entry.entryType !== 'example')
    const { toolbox } = processJengaTower(
        categories.map((category) => ({
            name: category.name,
            color: category.color,
            entries: blocksOf(category).map((entry) => (category.hidden ? entry : withHelp(entry))),
        })),
        pythonGenerator,
    )
    const cheatsheet = categories
        .filter((category) => !category.hidden)
        .map((category) => ({
            name: category.name,
            color: category.color,
            entries: blocksOf(category).map(withHelp),
            examples: category.entries.filter((entry) => entry.entryType === 'example'),
        }))

    const set = {
        libraries,
        categories,
        blockTypes,
        toolbox,
        cheatsheet,
        deviceKinds: Object.assign({}, ...libraries.map((library) => library.devices ?? {})),
        preamble: libraries.find((library) => library.preamble)?.preamble ?? '',
        takenNames: new Set(libraries.flatMap((library) => library.takenNames ?? [])),
        hiddenCategoryNames: categories.filter((category) => category.hidden).map((category) => category.name),
    }
    latest = set
    return set
}

/**
 * The toolbox a page asks for: the set's toolbox narrowed to these
 * categories or block types. Hidden categories (the number blocks) only
 * come in when asked for by name or by one of their blocks.
 * @param {BlockSet} set
 * @param {{toolbox?: string[], blocks?: string[]}} [narrow]
 * @returns {object} A Blockly toolbox.
 */
export const toolboxOf = (set, { toolbox, blocks } = {}) =>
    filterToolbox(set.toolbox, {
        categories: toolbox ?? null,
        blocks: blocks ?? null,
        hidden: set.hiddenCategoryNames,
    })

/**
 * Whether a page's toolbox offers blocks that use devices, so its editor
 * gets the Devices button: a category that
 * says which device kinds its blocks use (`devices` on a category), or a
 * device kind named in `blocks`.
 */
export const usesDevices = (set, { toolbox, blocks }) => {
    if (!Object.keys(set.deviceKinds).length) {
        return false
    }
    if (blocks?.some((type) => type in set.deviceKinds)) {
        return true
    }
    return set.categories.some(
        (category) =>
            category.devices?.length &&
            (toolbox
                ? toolbox.some((name) => name.toLowerCase() === category.name.toLowerCase())
                : blocks
                  ? category.entries.some((entry) => blocks.includes(entry.name))
                  : true),
    )
}

// ---- the editor's block set --------------------------------------------------

let active = null
/** The last block set spliced: what a page with only read-only views works from. */
let latest = null

/**
 * The block set of the full editor on the page (there is one), for the
 * parts that work for it: the Devices pop-up, the cheatsheet, the linter.
 * @param {BlockSet} set
 */
export const setBlockSet = (set) => {
    active = set
}

/** @returns {BlockSet} The full editor's block set, or, on a page with only read-only views, the last one spliced. */
export const blockSet = () => {
    if (!active && latest) {
        return latest
    }
    if (!active) {
        throw new Error('No block set yet: splice the libraries and setBlockSet() before building an editor.')
    }
    return active
}
