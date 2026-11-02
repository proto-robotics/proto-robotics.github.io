/*
 * The backpack: blocks a learner keeps to use again ("Copy to Backpack" in
 * a block's menu, or drop a stack on it). There is one backpack, not one
 * per program: every editor shows the same contents, kept in localStorage,
 * so they carry from one lesson or project to the next and between editors
 * open on the same page or in other tabs. Long-press (or right-click) a
 * block in the open backpack for "Remove from Backpack", or the backpack
 * itself for "Empty the Backpack".
 */

import * as Blockly from 'blockly'
import { Backpack, backpackChange } from '@blockly/workspace-backpack'

/** Where the shared backpack's contents are kept. */
const STORAGE_KEY = 'protoBackpack'

/** The backpacks mounted on this page, kept in step with each other. */
const mounted = new Set()

/**
 * @returns {string[]} The shared contents, one serialized stack per item.
 */
const readContents = () => {
    try {
        const items = JSON.parse(localStorage.getItem(STORAGE_KEY))
        return Array.isArray(items)
            ? items.filter((item) => typeof item === 'string')
            : []
    } catch {
        return []
    }
}

/** @param {string[]} items The contents to keep. */
const writeContents = (items) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
        // storage is off (a private window): the backpack still works for
        // this page, it just is not kept
    }
}

const sameContents = (a, b) =>
    a.length === b.length && a.every((item, i) => item === b[i])

/** Shows the shared contents in every mounted backpack that differs. */
const showEverywhere = (items) => {
    for (const backpack of mounted) {
        if (!sameContents(backpack.getContents(), items)) {
            backpack.setContents(items)
        }
    }
}

// another tab changed the backpack
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
        showEverywhere(readContents())
    }
})

/**
 * The plugin's backpack, with a plain flyout. The plugin builds its flyout
 * from the class registered for the toolbox, which here is the continuous
 * toolbox's flyout. That flyout recycles blocks by type, keeping one spare
 * of each, so a backpack holding three or more stacks that start with the
 * same block left the extra copies piled at the flyout's corner each time it
 * opened, more every time, until the editor fell over. That flyout also
 * selects toolbox categories as it scrolls, which a backpack has none of.
 */
class ProtoBackpack extends Backpack {
    initFlyout() {
        const workspace = this.workspace_
        const options = new Blockly.Options({
            scrollbars: true,
            parentWorkspace: workspace,
            rtl: workspace.RTL,
            oneBasedIndex: workspace.options.oneBasedIndex,
            renderer: workspace.options.renderer,
            rendererOverrides: workspace.options.rendererOverrides || undefined,
            move: { scrollbars: true },
        })
        // on the side opposite the toolbox, as the plugin places it
        const { Position } = Blockly.utils.toolbox
        if (workspace.horizontalLayout) {
            options.toolboxPosition =
                workspace.toolboxPosition === Position.TOP
                    ? Position.BOTTOM
                    : Position.TOP
            this.flyout_ = new Blockly.HorizontalFlyout(options)
        } else {
            options.toolboxPosition =
                workspace.toolboxPosition === Position.RIGHT
                    ? Position.LEFT
                    : Position.RIGHT
            this.flyout_ = new Blockly.VerticalFlyout(options)
        }
        workspace
            .getParentSvg()
            .parentNode?.appendChild(
                this.flyout_.createDom(Blockly.utils.Svg.SVG),
            )
        this.flyout_.init(workspace)
    }

    /**
     * The plugin listens for mouse events, which a browser only sends after
     * a touch nothing cancelled, and Blockly cancels touches on the canvas:
     * a tap on the backpack could do nothing. Pointer events come from
     * mouse, touch and pen alike.
     */
    attachListeners() {
        if (!this.svgGroup_) {
            return
        }
        this.addEvent(
            this.svgGroup_,
            'pointerdown',
            this,
            this.blockMouseDownWhenOpenable,
        )
        this.addEvent(this.svgGroup_, 'pointerup', this, this.onClick)
        this.addEvent(this.svgGroup_, 'pointerover', this, this.onMouseOver)
        this.addEvent(this.svgGroup_, 'pointerout', this, this.onMouseOut)
    }
}

/**
 * Adds the shared backpack to an editable workspace.
 * @param {Blockly.WorkspaceSvg} workspace The workspace.
 * @returns {() => void} Detaches the backpack from the shared contents.
 */
export const addSharedBackpack = (workspace) => {
    const backpack = new ProtoBackpack(workspace, {
        useFilledBackpackImage: true,
        // the contents are shared, so they are not saved with the program
        skipSerializerRegistration: true,
    })
    backpack.init()
    backpack.setContents(readContents())
    mounted.add(backpack)

    // Blockly fires its events after the change, so the contents are
    // compared rather than the event's origin: an edit here differs from
    // what is kept, and the copies shown elsewhere then match it.
    const onChange = (event) => {
        if (event.type !== backpackChange) {
            return
        }
        const items = backpack.getContents()
        if (!sameContents(items, readContents())) {
            writeContents(items)
            showEverywhere(items)
        }
    }
    workspace.addChangeListener(onChange)
    return () => {
        workspace.removeChangeListener(onChange)
        mounted.delete(backpack)
    }
}

/**
 * Moves a backpack saved inside an older program into the shared one, so
 * nothing kept before the backpack was shared is lost.
 * @param {object} state Blockly serialization state.
 * @returns {object} The state without its `backpack` entry.
 */
export const takeSavedBackpack = (state) => {
    if (!Array.isArray(state?.backpack)) {
        return state
    }
    const { backpack: saved, ...rest } = state
    const items = readContents()
    for (const block of saved) {
        const item = JSON.stringify(block)
        if (!items.includes(item)) {
            items.push(item)
        }
    }
    writeContents(items)
    showEverywhere(items)
    return rest
}
