/*
 * The toolbox's tabs. Both the ordinary categories and the search category
 * (@blockly/toolbox-search) are drawn as the continuous toolbox draws them,
 * a bubble over a small label, with the category's own icon from
 * assets/images/category-icons where it has one. Registered in mods.js.
 */

import * as Blockly from 'blockly'
import { ContinuousCategory } from '@blockly/continuous-toolbox'
// registers its category under SEARCH_CATEGORY_KIND; it exports nothing
import '@blockly/toolbox-search'

import { categoryIcon } from '../assets'
import { SEARCH_FIELD_KIND, searchFieldOf } from './searchField.js'

/** The kind the search plugin registers its category as. */
export const SEARCH_CATEGORY_KIND = 'search'

/** The plugin's category class, from the registry (its package exports none). */
const ToolboxSearchCategory = Blockly.registry.getClass(
    Blockly.registry.Type.TOOLBOX_ITEM,
    SEARCH_CATEGORY_KIND,
)

/**
 * Creates a toolbox tab's icon: the category's own bubble, when it has one.
 * @param {string} name The category's name.
 * @returns {HTMLImageElement|null} The icon, or null for a category without.
 */
export const createCategoryIcon = (name) => {
    const icon = categoryIcon(name)
    if (!icon) {
        return null
    }
    const image = document.createElement('img')
    image.className = 'categoryBubble categoryIcon'
    image.src = icon
    image.alt = ''
    image.draggable = false
    return image
}

/**
 * The toolbox tab with the category's own icon in place of the continuous
 * toolbox's colour dot; a category without an icon keeps the dot.
 */
export class ProtoCategory extends ContinuousCategory {
    createIconDom_() {
        return createCategoryIcon(this.name_) ?? super.createIconDom_()
    }
}

/**
 * The search category as a tab like the others. The plugin draws its field
 * in the tab; here the field is the first item of the category's section
 * in the flyout (searchField.js), and selecting the tab (a tap, or Ctrl+B)
 * scrolls there and puts the cursor in it.
 */
export class ProtoSearchCategory extends ToolboxSearchCategory {
    /** The plugin puts its own field in the row; this row is a plain tab. */
    createDom_() {
        return Blockly.ToolboxCategory.prototype.createDom_.call(this)
    }

    /** The plugin focuses its own field; this tab is focused like any. */
    getFocusableElement() {
        return Blockly.ToolboxCategory.prototype.getFocusableElement.call(this)
    }

    /** The field, then whatever the plugin lists: matches or a hint. */
    getContents() {
        return [{ kind: SEARCH_FIELD_KIND }, ...super.getContents()]
    }

    /**
     * The plugin's "Type to search for blocks" and "No matching blocks
     * found" lines are flyout labels like the category headings; they are
     * marked so styles.css can show them as hints.
     */
    matchBlocks() {
        super.matchBlocks()
        for (const item of super.getContents()) {
            if (item.kind === 'label') {
                item['web-class'] = 'search-hint'
            }
        }
    }

    /** Selecting the tab puts the cursor in the field, once the focus
     * manager has finished with the tab itself. */
    onNodeFocus() {
        super.onNodeFocus()
        setTimeout(() => {
            searchFieldOf(this.parentToolbox_.getFlyout())?.focus()
        })
    }

    /** The plugin empties its field here; the query is kept instead, and
     * Escape clears it. */
    onNodeBlur() {}
}

// the tab's looks, as the continuous toolbox draws them
for (const method of ['createLabelDom_', 'addColourBorder_', 'setSelected']) {
    ProtoSearchCategory.prototype[method] = ContinuousCategory.prototype[method]
}
ProtoSearchCategory.prototype.createIconDom_ =
    ProtoCategory.prototype.createIconDom_
