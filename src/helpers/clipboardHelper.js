/*
 * The clipboard: stacks of blocks a learner keeps to put down again and
 * again, made for a touch screen, where copy and paste are hard to reach.
 * Drop a stack on the clipboard (or "Copy to Clipboard" in a block's menu)
 * and it keeps a copy, newest first. Tap it to open it, then drag a stack
 * out as many times as you like: it stays open until you tap the canvas.
 * Each stack has an x above it that takes it off the clipboard.
 *
 * It is the backpack plugin (@blockly/workspace-backpack) with its own
 * picture, a remove button per stack, and a flyout that stays open.
 * There is one clipboard, not one per program: every editor shows the same
 * contents, kept in localStorage, so they carry from one lesson or project
 * to the next and between editors open on the same page or in other tabs.
 */

import * as Blockly from 'blockly'
import { Backpack, backpackChange } from '@blockly/workspace-backpack'

/** Where the shared clipboard's contents are kept. */
const STORAGE_KEY = 'protoClipboard'
/** Where the backpack it replaced kept its contents. */
const OLD_STORAGE_KEY = 'protoBackpack'

// the plugin's menu entries, in the clipboard's words
Blockly.Msg['COPY_TO_BACKPACK'] = 'Copy to Clipboard'
Blockly.Msg['EMPTY_BACKPACK'] = 'Clear the Clipboard'

/** The clipboard's pictures, the gray of the other canvas controls. */
const clipboardSvg = (lines) =>
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
            '<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">' +
            '<rect x="10" y="10" width="44" height="51" rx="6" fill="white"/>' +
            '<rect x="21" y="3.5" width="22" height="14" rx="4.5" fill="white"/>' +
            '<rect x="20" y="13" width="24" height="7" rx="2" fill="black"/>' +
            '<rect x="19" y="2" width="26" height="17" rx="5.5" fill="none" stroke="black" stroke-width="2.4"/>' +
            '<circle cx="32" cy="8.5" r="2.6" fill="black"/>' +
            lines +
            '<rect x="21" y="3.5" width="22" height="14" rx="4.5" fill="white"/>' +
            '<circle cx="32" cy="8.5" r="2.6" fill="black"/>' +
            '</mask></defs>' +
            '<rect width="64" height="64" fill="#A8ACB1" mask="url(#m)"/>' +
            '</svg>',
    )
const EMPTY_PICTURE = clipboardSvg('')
const FULL_PICTURE = clipboardSvg(
    '<rect x="17" y="24.5" width="5" height="5" rx="1.2" fill="black"/>' +
        '<rect x="26" y="25.5" width="20" height="3" rx="1.5" fill="black"/>' +
        '<rect x="17" y="34.5" width="5" height="5" rx="1.2" fill="black"/>' +
        '<rect x="26" y="35.5" width="20" height="3" rx="1.5" fill="black"/>' +
        '<rect x="17" y="44.5" width="5" height="5" rx="1.2" fill="black"/>' +
        '<rect x="26" y="45.5" width="13" height="3" rx="1.5" fill="black"/>',
)

/** The clipboard's size on the canvas, in pixels. */
const SIZE = 48

/** The clipboards mounted on this page, kept in step with each other. */
const mounted = new Set()

/**
 * @param {unknown} items
 * @returns {string[]} The serialized stacks among them.
 */
const stacksOf = (items) =>
    Array.isArray(items) ? items.filter((item) => typeof item === 'string') : []

/**
 * @returns {string[]} The shared contents, one serialized stack per item,
 *     newest first. A backpack kept from before the clipboard carries over.
 */
const readContents = () => {
    try {
        const kept = localStorage.getItem(STORAGE_KEY)
        if (kept !== null) {
            return stacksOf(JSON.parse(kept))
        }
        return stacksOf(JSON.parse(localStorage.getItem(OLD_STORAGE_KEY)))
    } catch {
        return []
    }
}

/** @param {string[]} items The contents to keep. */
const writeContents = (items) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
        // storage is off (a private window): the clipboard still works for
        // this page, it just is not kept
    }
}

const sameContents = (a, b) =>
    a.length === b.length && a.every((item, i) => item === b[i])

/** Shows the shared contents in every mounted clipboard that differs. */
const showEverywhere = (items) => {
    for (const clipboard of mounted) {
        if (!sameContents(clipboard.getContents(), items)) {
            clipboard.setContents(items)
        }
    }
}

// another tab changed the clipboard
window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
        showEverywhere(readContents())
    }
})

/**
 * The plugin's backpack as a clipboard: its own pictures, a remove button
 * above each stack, and a flyout that stays open while stacks are dragged
 * out of it.
 */
class Clipboard extends Backpack {
    constructor(workspace, options) {
        super(workspace, options)
        // the plugin sizes its picture and drop area from these
        this.WIDTH_ = SIZE
        this.HEIGHT_ = SIZE
    }

    /**
     * A plain flyout. The plugin builds its flyout from the class
     * registered for the toolbox, which here is the continuous toolbox's:
     * that one recycles blocks by type and selects toolbox categories as it
     * scrolls, neither of which suits a clipboard. This one does not close
     * when a stack is dragged out of it, so a stack can be put down again
     * and again.
     */
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
        this.flyout_.autoClose = false
        workspace
            .getParentSvg()
            .parentNode?.appendChild(
                this.flyout_.createDom(Blockly.utils.Svg.SVG),
            )
        this.flyout_.init(workspace)

        // Blockly hides its pop-ups and flyouts (autoHide, below) as a
        // stack is taken out of this one and put down; while a press that
        // started on the flyout lasts, and just after, they stay.
        this.pressing_ = false
        const flyoutSvg = this.flyout_.svgGroup_
        flyoutSvg?.addEventListener(
            'pointerdown',
            () => {
                this.pressing_ = true
            },
            true,
        )
        this.onPointerUp_ = () => {
            if (this.pressing_) {
                setTimeout(() => {
                    this.pressing_ = false
                })
            }
        }
        window.addEventListener('pointerup', this.onPointerUp_, true)
        window.addEventListener('pointercancel', this.onPointerUp_, true)
    }

    /**
     * Closes the clipboard when Blockly hides its pop-ups (a tap on the
     * canvas), but not while a stack is being taken out of it.
     */
    autoHide(onlyClosePopups) {
        if (this.pressing_) {
            return
        }
        super.autoHide(onlyClosePopups)
    }

    dispose() {
        window.removeEventListener('pointerup', this.onPointerUp_, true)
        window.removeEventListener('pointercancel', this.onPointerUp_, true)
        super.dispose()
    }

    /** The clipboard's picture. */
    createDom() {
        super.createDom()
        const image = this.svgImg_
        image.setAttribute('x', '0')
        image.setAttribute('y', '0')
        image.setAttribute('width', `${SIZE}px`)
        image.setAttribute('height', `${SIZE}px`)
        image.classList.add('blocklyClipboard')
        this.showPicture()
    }

    /**
     * The plugin listens for mouse events, which a browser only sends after
     * a touch nothing cancelled, and Blockly cancels touches on the canvas:
     * a tap could do nothing. Pointer events come from mouse, touch and pen
     * alike. A tap on the clipboard opens it.
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

    /**
     * Where a stack can be dropped: the picture and a margin round it. The
     * plugin works it out from its own sprite's offsets, which this
     * picture does not have.
     */
    getClientRect() {
        if (!this.svgImg_) {
            return null
        }
        const box = this.svgImg_.getBoundingClientRect()
        const margin = this.HOTSPOT_MARGIN_
        return new Blockly.utils.Rect(
            box.top - margin,
            box.bottom + margin,
            box.left - margin,
            box.right + margin,
        )
    }

    /**
     * Takes a copy of a dropped stack. A stack straight from the toolbox
     * (made in this same drag) is copied and then goes, rather than being
     * left on the canvas where the drag began.
     */
    onDrop(dragElement) {
        super.onDrop(dragElement)
        const group = Blockly.Events.getGroup()
        const fresh =
            dragElement instanceof Blockly.BlockSvg &&
            group &&
            this.created_?.group === group &&
            this.created_.ids.has(dragElement.id)
        if (fresh) {
            // after the drag puts it back, in the drag's own undo step
            setTimeout(() => {
                if (dragElement.isDisposed()) {
                    return
                }
                Blockly.Events.setGroup(group)
                try {
                    dragElement.dispose(false)
                } finally {
                    Blockly.Events.setGroup(false)
                }
            })
        }
    }

    /**
     * Notes the blocks made in each step (a drag out of the toolbox makes
     * its block in the drag's step), for onDrop.
     * @param {object} event A workspace event.
     */
    noteCreated(event) {
        if (event.type !== Blockly.Events.BLOCK_CREATE || !event.group) {
            return
        }
        if (this.created_?.group !== event.group) {
            this.created_ = { group: event.group, ids: new Set() }
        }
        for (const id of event.ids ?? [event.blockId]) {
            this.created_.ids.add(id)
        }
    }

    /**
     * What the open clipboard shows: each stack under a button that takes
     * it off. The buttons' callbacks are registered on the workspace by
     * position, afresh each time it is drawn.
     * @returns {object[]} Flyout contents.
     */
    flyoutContents() {
        return this.contents_.flatMap((item, index) => {
            // a stack kept from the old blocks has types no block has now,
            // and would break the flyout: it is left out until removed
            const types = [...item.matchAll(/"type":"([^"]+)"/g)].map(
                (m) => m[1],
            )
            if (types.some((type) => !Blockly.Blocks[type])) {
                return []
            }
            const key = `clipboardRemove${index}`
            this.workspace_.registerButtonCallback(key, () =>
                this.removeItem(item),
            )
            return [
                {
                    kind: 'button',
                    text: '✕ Remove',
                    callbackkey: key,
                    'web-class': 'blocklyClipboardRemove',
                },
                JSON.parse(item),
            ]
        })
    }

    /** Opens the clipboard, each stack with its remove button. */
    open() {
        super.open()
        if (this.isOpen()) {
            this.flyout_.show(this.flyoutContents())
        }
    }

    /** Shows the stacks again after a change; closes when none are left. */
    maybeRefreshFlyoutContents() {
        if (!this.isOpen()) {
            return
        }
        if (!this.getCount()) {
            this.close()
            return
        }
        this.flyout_.show(this.flyoutContents())
    }

    onContentChange() {
        super.onContentChange()
        this.showPicture()
    }

    /** The full or empty picture. */
    showPicture() {
        if (!this.svgImg_) {
            return
        }
        this.svgImg_.setAttributeNS(
            Blockly.utils.dom.XLINK_NS,
            'xlink:href',
            this.getCount() > 0 ? FULL_PICTURE : EMPTY_PICTURE,
        )
    }
}

/**
 * Adds the shared clipboard to an editable workspace.
 * @param {Blockly.WorkspaceSvg} workspace The workspace.
 * @returns {() => void} Detaches the clipboard from the shared contents.
 */
export const addSharedClipboard = (workspace) => {
    const clipboard = new Clipboard(workspace, {
        // an empty clipboard has nothing to show
        allowEmptyBackpackOpen: false,
        // the contents are shared, so they are not saved with the program
        skipSerializerRegistration: true,
        // each stack's own button takes it off
        contextMenu: { removeFromBackpack: false },
    })
    clipboard.init()
    clipboard.setContents(readContents())
    const noteCreated = (event) => clipboard.noteCreated(event)
    workspace.addChangeListener(noteCreated)
    mounted.add(clipboard)

    // Blockly fires its events after the change, so the contents are
    // compared rather than the event's origin: an edit here differs from
    // what is kept, and the copies shown elsewhere then match it.
    const onChange = (event) => {
        if (event.type !== backpackChange) {
            return
        }
        const items = clipboard.getContents()
        if (!sameContents(items, readContents())) {
            writeContents(items)
            showEverywhere(items)
        }
    }
    workspace.addChangeListener(onChange)
    return () => {
        workspace.removeChangeListener(onChange)
        workspace.removeChangeListener(noteCreated)
        mounted.delete(clipboard)
    }
}

/**
 * Moves a backpack saved inside an older program onto the clipboard, so
 * nothing kept before is lost.
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
