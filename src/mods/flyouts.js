/*
 * The editor's flyouts, both built on @blockly/continuous-toolbox: one
 * always-open flyout that scrolls through every category, which the toolbox
 * tabs jump around in. The column is the plugin's own flyout at a fixed
 * zoom; the row is a port of it onto Blockly's horizontal flyout for the
 * phone layout, where the toolbox runs across the top of the canvas.
 * Registered in mods.js, chosen in blocklyHelper.js.
 */

import * as Blockly from 'blockly'
import {
    ContinuousFlyout,
    ContinuousToolbox,
} from '@blockly/continuous-toolbox'

import { keepingSearchFocus } from './searchField.js'

/**
 * The zoom the flyouts are always drawn at. Blockly's flyouts follow the
 * workspace zoom by default; ours stay put so zooming the canvas does not
 * resize the toolbox. Keep in step with the flyout label size in styles.css
 * (.blocklyFlyoutLabelText) and the cheatsheet previews
 * (cheatSheetPreviewHelper.js).
 */
export const FLYOUT_SCALE = 0.65

/** The continuous flyout as a column beside the toolbox, at a fixed zoom. */
export class ContinuousColumnFlyout extends ContinuousFlyout {
    getFlyoutScale() {
        return FLYOUT_SCALE
    }

    /**
     * The flyout's width is only final once its contents are drawn, and the
     * canvas controls (minimap, "blocks left" pill) are placed from it, so
     * lay the workspace out again after every redraw. A redraw must not
     * take the cursor out of the search field (searchField.js).
     */
    show(contents) {
        keepingSearchFocus(this, () => super.show(contents))
        this.targetWorkspace?.resize()
    }
}

/**
 * The row flyout's metrics: room is added after the last category so that
 * it too can be scrolled to the start (the plugin's ContinuousFlyoutMetrics,
 * for a row instead of a column).
 */
class ContinuousRowFlyoutMetrics extends Blockly.FlyoutMetricsManager {
    getScrollMetrics(getWorkspaceCoordinates, cachedView, cachedContent) {
        const scrollMetrics = super.getScrollMetrics(
            getWorkspaceCoordinates,
            cachedView,
            cachedContent,
        )
        const contentMetrics =
            cachedContent || this.getContentMetrics(getWorkspaceCoordinates)
        const viewMetrics =
            cachedView || this.getViewMetrics(getWorkspaceCoordinates)
        if (scrollMetrics) {
            scrollMetrics.width += this.flyout_.calculateEndPadding(
                contentMetrics,
                viewMetrics,
            )
        }
        return scrollMetrics
    }
}

/**
 * The continuous flyout as a row under the toolbox, for the phone layout.
 * The plugin's ContinuousFlyout is a column (it extends VerticalFlyout), so
 * this carries its logic over to Blockly's HorizontalFlyout, with x for y;
 * the plugin's ContinuousToolbox drives it as it would the column. Blocks
 * are laid out in columns within the row rather than in one long line.
 */
export class ContinuousRowFlyout extends Blockly.HorizontalFlyout {
    /** Where the animated scroll is heading, in pixels, while it runs. */
    scrollTarget = undefined

    /** Category name to its start position in the flyout (workspace units). */
    scrollPositions = new Map()

    /** How much of the remaining distance each animation step covers. */
    scrollAnimationFraction = 0.3

    autoClose = false

    constructor(workspaceOptions) {
        super(workspaceOptions)
        this.getWorkspace().setMetricsManager(
            new ContinuousRowFlyoutMetrics(this.getWorkspace(), this),
        )
        this.getWorkspace().addChangeListener((event) => {
            if (event.type === Blockly.Events.VIEWPORT_CHANGE) {
                this.selectCategoryByScrollPosition(
                    -this.getWorkspace().scrollX,
                )
            }
        })
        this.setRecyclingEnabled(true)
    }

    getFlyoutScale() {
        return FLYOUT_SCALE
    }

    /** @returns {ContinuousToolbox|null} The toolbox this flyout belongs to. */
    getParentToolbox() {
        const toolbox = this.targetWorkspace.getToolbox()
        return toolbox instanceof ContinuousToolbox ? toolbox : null
    }

    /** Notes where each category's heading landed after a render. */
    recordScrollPositions() {
        this.scrollPositions.clear()
        for (const item of this.getContents()) {
            if (!this.toolboxItemIsLabel(item)) {
                continue
            }
            const label = item.getElement()
            this.scrollPositions.set(
                label.getButtonText(),
                Math.max(0, label.getPosition().x - this.GAP_X / 2),
            )
        }
    }

    /**
     * @param {Blockly.FlyoutItem} item A flyout item.
     * @returns {boolean} Whether it is one of the category headings.
     */
    toolboxItemIsLabel(item) {
        const element = item.getElement()
        return Boolean(
            item.getType() === 'label' &&
                element instanceof Blockly.FlyoutButton &&
                element.isLabel() &&
                this.getParentToolbox()?.getCategoryByName(
                    element.getButtonText(),
                ),
        )
    }

    /**
     * @param {string} name A category name.
     * @returns {number|null} Its start position, in workspace units.
     */
    getCategoryScrollPosition(name) {
        return this.scrollPositions.get(name) ?? null
    }

    /**
     * Highlights the toolbox tab of the category scrolled to.
     * @param {number} position The flyout's scroll position, in pixels.
     */
    selectCategoryByScrollPosition(position) {
        if (this.scrollTarget) {
            return
        }
        // a unit of slack: the scrollbar lands on whole pixels, and a
        // category scrolled to must count as reached
        const scaledPosition = position / this.getWorkspace().scale + 1
        const entries = [...this.scrollPositions.entries()].reverse()
        for (const [name, start] of entries) {
            if (scaledPosition >= start) {
                this.getParentToolbox()?.selectCategoryByName(name)
                return
            }
        }
    }

    /**
     * Scrolls the flyout, animated.
     * @param {number} position The x to scroll to, in workspace units.
     */
    scrollTo(position) {
        const metrics = this.getWorkspace().getMetrics()
        this.scrollTarget = Math.min(
            position * this.getWorkspace().scale,
            metrics.scrollWidth - metrics.viewWidth,
        )
        this.stepScrollAnimation()
    }

    /**
     * Scrolls the flyout to a category's heading.
     * @param {Blockly.ISelectableToolboxItem} category The category.
     */
    scrollToCategory(category) {
        const position = this.scrollPositions.get(category.getName())
        if (position !== undefined) {
            this.scrollTo(position)
        }
    }

    stepScrollAnimation() {
        if (this.scrollTarget === undefined) {
            return
        }
        const current = -this.getWorkspace().scrollX
        const diff = this.scrollTarget - current
        if (Math.abs(diff) < 1) {
            this.getWorkspace().scrollbar?.setX(this.scrollTarget)
            this.scrollTarget = undefined
            return
        }
        this.getWorkspace().scrollbar?.setX(
            current + diff * this.scrollAnimationFraction,
        )
        requestAnimationFrame(() => this.stepScrollAnimation())
    }

    /** The wheel waits while an animated scroll runs. */
    wheel_(event) {
        if (this.scrollTarget) {
            return
        }
        super.wheel_(event)
    }

    /**
     * The space after the last category, so it too can start at the left
     * edge when scrolled to.
     * @param {Blockly.MetricsManager.ContainerRegion} contentMetrics
     * @param {Blockly.MetricsManager.ContainerRegion} viewMetrics
     * @returns {number} Extra scroll width, in pixels.
     */
    calculateEndPadding(contentMetrics, viewMetrics) {
        if (this.scrollPositions.size === 0) {
            return 0
        }
        const lastPosition =
            ([...this.scrollPositions.values()].pop() ?? 0) *
            this.getWorkspace().scale
        const lastCategoryWidth = contentMetrics.width - lastPosition
        return lastCategoryWidth < viewMetrics.width
            ? viewMetrics.width - lastCategoryWidth
            : 0
    }

    /**
     * Lays the items out in columns: a category starts a column with its
     * heading, and its blocks stack below it and on into further columns
     * while they fit the row's height, which the tallest block sets. The
     * toolbox's own gaps (separator items) give way to the column gaps.
     * @param {Blockly.FlyoutItem[]} contents The items to place.
     */
    layout_(contents) {
        this.workspace_.scale = this.targetWorkspace.scale
        const margin = this.MARGIN
        const items = contents.filter((item) => item.getType() !== 'sep')
        const limit = items.reduce(
            (max, item) =>
                Math.max(
                    max,
                    item.getElement().getBoundingRectangle().getHeight(),
                ),
            0,
        )
        let cursorX = margin + this.tabWidth_
        let cursorY = margin
        let columnWidth = 0
        let columnEmpty = true
        for (const item of items) {
            const element = item.getElement()
            const rect = element.getBoundingRectangle()
            const isLabel = item.getType() === 'label'
            if (
                !columnEmpty &&
                (isLabel || cursorY + rect.getHeight() > margin + limit)
            ) {
                cursorX += columnWidth + this.GAP_X
                cursorY = margin
                columnWidth = 0
            }
            element.moveBy(cursorX - rect.left, cursorY - rect.top)
            cursorY += rect.getHeight() + this.GAP_Y
            columnWidth = Math.max(columnWidth, rect.getWidth())
            if (isLabel) {
                cursorY -= this.GAP_Y / 2
            }
            columnEmpty = false
        }
    }

    /** The row's height comes from the lowest item, since they stack. */
    reflowInternal_() {
        this.workspace_.scale = this.getFlyoutScale()
        const bottom = this.getContents()
            .filter((item) => item.getType() !== 'sep')
            .reduce(
                (max, item) =>
                    Math.max(
                        max,
                        item.getElement().getBoundingRectangle().bottom,
                    ),
                0,
            )
        const height =
            (bottom + this.MARGIN / 2) * this.workspace_.scale +
            Blockly.Scrollbar.scrollbarThickness
        if (this.getHeight() !== height) {
            this.height_ = height
            this.position()
            this.targetWorkspace.resizeContents()
            this.targetWorkspace.recordDragTargets()
        }
    }

    show(flyoutDef) {
        keepingSearchFocus(this, () => super.show(flyoutDef))
        this.recordScrollPositions()
        this.getWorkspace().resizeContents()
        if (!this.getParentToolbox()?.getSelectedItem()) {
            this.selectCategoryByScrollPosition(0)
        }
        this.getRecyclableInflater().emptyRecycledBlocks()
        // the flyout's height is only final now, and the canvas controls
        // are placed below it (as in ContinuousColumnFlyout)
        this.targetWorkspace?.resize()
    }

    setRecyclingEnabled(isEnabled) {
        this.getRecyclableInflater().recyclingEnabled = isEnabled
    }

    /** @returns {object} The plugin's recycling block inflater. */
    getRecyclableInflater() {
        return this.getInflaterForType('block')
    }
}
