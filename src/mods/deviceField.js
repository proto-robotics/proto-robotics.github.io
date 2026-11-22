/*
 * A dropdown of the devices a program has set up (helpers/devicesHelper.js)
 * for the blocks that act on one: "Spin [motor ▾] at 100 power". It is a
 * grid dropdown like the other choices on the blocks, and lists the devices
 * of one kind by name, as the Devices pop-up has them at the moment it
 * opens.
 *
 * Its value is the name, which is what the Python needs. A block saved
 * before Devices existed, or whose device was removed since,
 * keeps the name it has: it is shown as it is and offered along with the
 * devices there are. A block taken from the flyout starts on the first
 * device of its kind (or the one its `nth` asks for). With
 * no devices of its kind yet it is blank (the value ''), and the block
 * linter (blockLinter.js) marks the block until a device is picked.
 */

import * as Blockly from 'blockly'
import { FieldGridDropdown } from '@blockly/field-grid-dropdown'

import { cleanName, deviceKinds, getDevices } from '../helpers/devicesHelper'

/**
 * Fired on the document when a dropdown's "+ Add a drive motor" choice is
 * picked; the block editor opens the Devices pop-up (buildBlockMode.js).
 */
export const openDevicesEvent = 'open-devices'

/** The value of the "+ Add a ..." choice: never a name (names are Python names). */
const ADD = '+add'

/** What a blank field shows: a gap the width of a short name. */
const BLANK_LABEL = ' '.repeat(6)

/** The choice for no device. */
const BLANK = [BLANK_LABEL, '']

export class FieldDevice extends FieldGridDropdown {
    /**
     * @param {string} kind The kind of device to list, a key of deviceKinds.
     * @param {object} [options]
     * @param {number} [options.nth=0] Which device a new block starts on,
     *     when there are that many: 0 for the first, 1 for the second.
     */
    constructor(kind, { nth = 0 } = {}) {
        super([BLANK], undefined, { columns: 1 })
        this.kind = kind
        this.nth = nth
        // a value given from outside (a saved program, the flyout's block
        // being copied to the workspace) is kept; only a fresh block starts
        // on a device
        this.given = false
        this.setOptions(() => this.deviceOptions())
    }

    /**
     * @returns {object|null} The workspace whose devices the block uses:
     *     for a block in a flyout, the workspace the flyout serves.
     */
    programWorkspace() {
        const workspace = this.getSourceBlock()?.workspace ?? null
        return workspace?.isFlyout ? workspace.targetWorkspace : workspace
    }

    /** @returns {string[]} The names of the devices of the kind, in order. */
    names() {
        const workspace = this.programWorkspace()
        if (!workspace) {
            return []
        }
        return getDevices(workspace)
            .filter((device) => device.kind === this.kind && device.name)
            .map((device) => device.name)
    }

    /** @returns {Array<[string, string]>} The choices: the devices, then
     *     the current name if it is not one of them, then "+ Add a drive
     *     motor", which opens the Devices pop-up. With no devices the add
     *     choice is all there is, so an empty dropdown says what to do. */
    deviceOptions() {
        const names = this.names()
        const value = this.getValue()
        if (value && !names.includes(value)) {
            names.push(value)
        }
        const label = deviceKinds[this.kind]?.label ?? 'device'
        return [
            ...names.map((name) => [name, name]),
            [`+ Add ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`, ADD],
        ]
    }

    /**
     * With nothing picked the field shows blank. Blockly takes the first
     * choice as the one shown when the value is not among them, which
     * would show "+ Add a drive motor" as if it were picked.
     */
    render_() {
        if (!this.getValue()) {
            this.selectedOption = BLANK
        }
        super.render_()
    }

    getText_() {
        return this.getValue() ? super.getText_() : BLANK_LABEL
    }

    /** @returns {boolean} Whether no device is picked. */
    isBlank() {
        return !this.getValue()
    }

    /** Puts a fresh block on a device, once it is on a workspace. */
    init() {
        super.init()
        if (this.given) {
            return
        }
        const names = this.names()
        if (names.length) {
            this.setValue(names[Math.min(this.nth, names.length - 1)])
        }
    }

    loadState(state) {
        this.given = true
        super.loadState(state)
    }

    fromXml(element) {
        this.given = true
        super.fromXml(element)
    }

    /** Any usable name is a value, whether or not it is a device now,
     *  and so is blank. */
    doClassValidation_(newValue) {
        if (newValue === '' || newValue == null) {
            return ''
        }
        // "+ Add a ...": open the Devices pop-up and keep what was picked
        if (newValue === ADD) {
            if (this.getSourceBlock()) {
                setTimeout(() =>
                    document.dispatchEvent(new Event(openDevicesEvent)),
                )
            }
            return null
        }
        return cleanName(newValue) || null
    }

    doValueUpdate_(newValue) {
        super.doValueUpdate_(newValue)
        if (this.selectedOption?.[1] !== newValue) {
            this.selectedOption = newValue ? [newValue, newValue] : BLANK
        }
    }

    /** As many columns as the other dropdowns on the blocks: up to four. */
    showEditor_(event) {
        const columns = Math.min(this.getOptions(false).length, 4)
        if (columns !== this.columns) {
            this.setColumns(columns)
        }
        super.showEditor_(event)
    }
}

/**
 * A field factory for a block template, as library.js wants them.
 * @param {string} kind The kind of device, a key of deviceKinds.
 * @param {object} [options] See FieldDevice.
 * @returns {() => FieldDevice}
 */
export const deviceField = (kind, options) => () =>
    new FieldDevice(kind, options)

/**
 * Puts the toolbox's blocks on the devices there are now. A toolbox block
 * picks its device when the toolbox is built, so without this it kept
 * showing a device (say a drivetrain) after it was removed, or blank after
 * one was added. Each goes on the first device of its kind (or its `nth`
 * one), or blank when there is none.
 * @param {object} workspace The program's workspace.
 */
export const syncToolboxDevices = (workspace) => {
    const flyoutWorkspace = workspace?.getFlyout?.()?.getWorkspace?.()
    if (!flyoutWorkspace) {
        return
    }
    for (const block of flyoutWorkspace.getAllBlocks(false)) {
        for (const input of block.inputList) {
            for (const field of input.fieldRow) {
                if (!(field instanceof FieldDevice)) {
                    continue
                }
                const names = field.names()
                const wanted = names.length
                    ? names[Math.min(field.nth, names.length - 1)]
                    : ''
                if (field.getValue() !== wanted) {
                    field.setValue(wanted)
                }
            }
        }
    }
}

/**
 * Points the blocks that use a device by one name at another, as one
 * undoable change. For the Devices pop-up, when a device is renamed, or
 * removed (to '': the blocks are left blank, to be picked again).
 * @param {object} workspace The program's workspace.
 * @param {string} from The old name.
 * @param {string} to The new name, or '' for none.
 */
export const renameDeviceInBlocks = (workspace, from, to) => {
    if (!from || from === to) {
        return
    }
    Blockly.Events.setGroup(true)
    try {
        for (const block of workspace.getAllBlocks(false)) {
            for (const input of block.inputList) {
                for (const field of input.fieldRow) {
                    if (
                        field instanceof FieldDevice &&
                        field.getValue() === from
                    ) {
                        field.setValue(to)
                    }
                }
            }
        }
    } finally {
        Blockly.Events.setGroup(false)
    }
}
