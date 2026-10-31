/*
 * The toolbox's search field as a flyout item. Blockly's flyouts are built
 * from items of registered kinds (block, label, button, separator), each
 * made by a flyout inflater; the variables category's "Create variable"
 * button is one. This adds a kind of its own, `search_field`, so the field
 * is laid out, scrolled, and clipped with the blocks of the "Search"
 * section instead of being pinned over them. The HTML input sits inside an
 * SVG foreignObject, drawn back up to full size against the flyout's zoom.
 *
 * The search category (ProtoSearchCategory in categories.js) lists the
 * field first in its section and reads the query from it. The field lives
 * on across the flyout's redraws, which happen on every keystroke, so the
 * cursor stays in it (see keepingSearchFocus).
 */

import * as Blockly from 'blockly'

/** The flyout item kind, as named in a category's contents. */
export const SEARCH_FIELD_KIND = 'search_field'

/** The id the search plugin gives its category (and its own field). */
export const SEARCH_CATEGORY_ID = 'toolbox-search-input'

/** The field's size on screen, in pixels. */
const FIELD_WIDTH = 150
const FIELD_HEIGHT = 24

/**
 * The search category of a flyout's toolbox, if it has one.
 * @param {Blockly.IFlyout} flyout The flyout.
 * @returns {object|null} The category (a ToolboxSearchCategory).
 */
export const findSearchCategory = (flyout) =>
    flyout.targetWorkspace
        .getToolbox()
        ?.getToolboxItems()
        .find((item) => item.getId() === SEARCH_CATEGORY_ID) ?? null

/**
 * The field: a flyout element (positioned and drawn like a block or a
 * label) that Blockly can also focus, so the focus manager treats a click
 * into it as focus on this item rather than on the flyout's root.
 */
export class SearchField {
    /**
     * @param {Blockly.IFlyout} flyout The flyout the field belongs to.
     */
    constructor(flyout) {
        this.flyout = flyout
        this.workspace = flyout.getWorkspace()
        this.position = new Blockly.utils.Coordinate(0, 0)

        // the flyout draws everything at its zoom; the field is sized in
        // workspace units to come out at FIELD_WIDTH by FIELD_HEIGHT on
        // screen, and the input inside is scaled back up to match
        const scale = flyout.getFlyoutScale()
        this.width = FIELD_WIDTH / scale
        this.height = FIELD_HEIGHT / scale

        this.svgGroup = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.G,
            { class: 'blocklyFlyoutSearch' },
            this.workspace.getCanvas(),
        )
        const frame = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FOREIGNOBJECT,
            { width: this.width, height: this.height },
            this.svgGroup,
        )
        this.input = document.createElement('input')
        this.input.type = 'search'
        this.input.id = Blockly.utils.idGenerator.getNextUniqueId()
        this.input.className = 'toolbox-search-field'
        this.input.placeholder = 'Search'
        this.input.setAttribute('aria-label', 'Search blocks')
        this.input.autocomplete = 'off'
        Object.assign(this.input.style, {
            width: `${FIELD_WIDTH}px`,
            height: `${FIELD_HEIGHT}px`,
            transform: `scale(${1 / scale})`,
            transformOrigin: '0 0',
        })
        frame.appendChild(this.input)

        // typing searches; Escape empties the field and its results. The
        // keys stay in the field: Blockly's own shortcuts (Delete, say)
        // must not see them.
        this.input.addEventListener('keydown', (event) => {
            event.stopPropagation()
        })
        this.input.addEventListener('keyup', (event) => {
            event.stopPropagation()
            if (event.key === 'Escape') {
                this.input.value = ''
            }
            findSearchCategory(this.flyout)?.matchBlocks()
        })
    }

    /** Puts the field back at the origin for the flyout to lay out. */
    reset() {
        this.moveTo(0, 0)
        if (!this.svgGroup.isConnected) {
            this.workspace.getCanvas().appendChild(this.svgGroup)
        }
    }

    /** Puts the cursor in the field. */
    focus() {
        this.input.focus({ preventScroll: true })
    }

    // ---- IBoundedElement ----

    getBoundingRectangle() {
        return new Blockly.utils.Rect(
            this.position.y,
            this.position.y + this.height,
            this.position.x,
            this.position.x + this.width,
        )
    }

    moveBy(dx, dy) {
        this.moveTo(this.position.x + dx, this.position.y + dy)
    }

    moveTo(x, y) {
        this.position.x = x
        this.position.y = y
        this.svgGroup.setAttribute('transform', `translate(${x},${y})`)
    }

    // ---- IRenderedElement ----

    getSvgRoot() {
        return this.svgGroup
    }

    // ---- IFocusableNode ----

    getFocusableElement() {
        return this.input
    }

    getFocusableTree() {
        return this.workspace
    }

    // nothing happens on focus or blur: the query is kept until Escape
    onNodeFocus() {}

    onNodeBlur() {}

    canBeFocused() {
        return true
    }
}

/** @type {WeakMap<Blockly.IFlyout, SearchField>} One field per flyout. */
const fields = new WeakMap()

/**
 * Makes the `search_field` items. A flyout gets one field, kept across its
 * redraws (the flyout disposes and recreates its items on every show, which
 * happens on every keystroke of a search) and removed with the flyout's
 * workspace.
 */
export class SearchFieldInflater {
    load(state, flyout) {
        let field = fields.get(flyout)
        if (!field) {
            field = new SearchField(flyout)
            fields.set(flyout, field)
        }
        field.reset()
        // the category reads its query from this field
        const category = findSearchCategory(flyout)
        if (category) {
            category.searchField = field.input
        }
        return new Blockly.FlyoutItem(field, SEARCH_FIELD_KIND)
    }

    gapForItem(state, defaultGap) {
        return defaultGap
    }

    disposeItem() {
        // kept for the next show; it goes with the flyout's workspace
    }

    getType() {
        return SEARCH_FIELD_KIND
    }
}

/**
 * The search field of a flyout, once it has been shown.
 * @param {Blockly.IFlyout} flyout The flyout.
 * @returns {SearchField|null} Its field.
 */
export const searchFieldOf = (flyout) => fields.get(flyout) ?? null

/**
 * Redraws a flyout without losing the cursor in its search field. A show
 * hides the flyout first, which blurs the field; the cursor and selection
 * are put back afterwards.
 * @param {Blockly.IFlyout} flyout The flyout being redrawn.
 * @param {() => void} redraw The redraw itself.
 */
export const keepingSearchFocus = (flyout, redraw) => {
    const field = fields.get(flyout)
    const input = field?.input
    const hadFocus = Boolean(input) && document.activeElement === input
    const selection = hadFocus
        ? [input.selectionStart, input.selectionEnd]
        : null
    redraw()
    if (hadFocus && input.isConnected) {
        input.focus({ preventScroll: true })
        if (selection[0] !== null) {
            input.setSelectionRange(selection[0], selection[1])
        }
    }
}
