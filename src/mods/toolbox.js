/*
 * The continuous toolbox, with a fold: tapping the category that is already
 * selected hides the flyout, so the workspace gets its width back (on an
 * iPad the flyout takes a third of the screen). Tapping any category opens
 * the flyout again, scrolled to that category. Registered in mods.js.
 */

import * as Blockly from 'blockly'
import { ContinuousToolbox } from '@blockly/continuous-toolbox'

export class ProtoToolbox extends ContinuousToolbox {
    /**
     * A tap on a tab. On the open one, with the flyout showing, it folds;
     * any other tap selects as usual (updateFlyout_ opens a folded flyout).
     * @param {PointerEvent} e The pointer event.
     */
    onClick_(e) {
        const id = e.target?.getAttribute?.('id')
        const item = id ? this.getToolboxItemById(id) : null
        if (item && item === this.getSelectedItem() && this.isFlyoutOpen()) {
            // keeps the focus manager from selecting the tab again
            // (Toolbox.onTreeFocus skips while the pointer is down)
            this.mouseDown = true
            this.fold()
            Blockly.Touch.clearTouchIdentifier()
            return
        }
        super.onClick_(e)
    }

    /** @returns {boolean} Whether the flyout is showing. */
    isFlyoutOpen() {
        return Boolean(this.getFlyout()?.isVisible())
    }

    /** Hides the flyout and leaves no tab selected; the workspace widens. */
    fold() {
        const item = this.getSelectedItem()
        if (item) {
            this.deselectItem_(item)
        }
        this.getFlyout()?.hide()
        this.workspace_.resize()
    }

    /** Opens a folded flyout when a tab is picked, then scrolls to it (the plugin's job). */
    updateFlyout_(oldItem, newItem) {
        const wasOpen = this.isFlyoutOpen()
        super.updateFlyout_(oldItem, newItem)
        if (!wasOpen && this.isFlyoutOpen()) {
            this.workspace_.resize()
        }
    }

    /**
     * Where a dragged block is deleted: the flyout while it shows (the
     * plugin's choice), and the tab column while it is folded.
     */
    getClientRect() {
        return this.isFlyoutOpen()
            ? super.getClientRect()
            : Blockly.Toolbox.prototype.getClientRect.call(this)
    }
}
