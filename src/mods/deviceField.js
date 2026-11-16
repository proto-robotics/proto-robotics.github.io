/*
 * A dropdown of the devices a program has set up (helpers/devicesHelper.js)
 * for the blocks that act on one: "Spin [motor ▾] at 100 power". It is a
 * grid dropdown like the other choices on the blocks, and lists the devices
 * of one kind by name, as the Devices section has them at the moment it
 * opens.
 *
 * Its value is the name, which is what the Python needs. A block saved
 * before the Devices section existed, or whose device was removed since,
 * keeps the name it has: it is shown as it is and offered along with the
 * devices there are. A block taken from the flyout starts on the first
 * device of its kind (or the second, for a drivetrain's right motor). With
 * no devices of its kind yet it is blank (the value ''), and the block
 * linter (blockLinter.js) marks the block until a device is picked.
 */

import * as Blockly from 'blockly'
import { FieldGridDropdown } from '@blockly/field-grid-dropdown'

import { cleanName, getDevices } from '../helpers/devicesHelper'

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

    /** @returns {Array<[string, string]>} The choices: devices, then the
     *     current name if it is not one of them, or blank when there are
     *     none. */
    deviceOptions() {
        const names = this.names()
        const value = this.getValue()
        if (value && !names.includes(value)) {
            names.push(value)
        }
        return names.length ? names.map((name) => [name, name]) : [BLANK]
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
 * Points the blocks that use a device by one name at another, as one
 * undoable change. For the Devices section, when a device is renamed, or
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
