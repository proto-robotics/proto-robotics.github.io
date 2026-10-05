/*
 * Our changes to Blockly, registered once before the first workspace is
 * created (injectMods): the block renderer, the always-open toolbox with
 * its flyouts (flyouts.js), the toolbox tabs (categories.js) and the search
 * field in the flyout (searchField.js), the metrics that make room for the
 * flyout, and the dragger that scrolls the canvas. Block shapes are the
 * renderer's business; everything else here is chrome.
 */

import * as Blockly from 'blockly'
import {
    ContinuousMetrics,
    registerContinuousToolbox,
} from '@blockly/continuous-toolbox'
import { ScrollBlockDragger } from '@blockly/plugin-scroll-options'

import {
    ProtoCategory,
    ProtoSearchCategory,
    SEARCH_CATEGORY_KIND,
} from './categories.js'
import { ContinuousColumnFlyout, ContinuousRowFlyout } from './flyouts.js'
import { ProtoRenderer } from './proto_renderer/proto_renderer.js'
import { SEARCH_FIELD_KIND, SearchFieldInflater } from './searchField.js'

export { SEARCH_CATEGORY_KIND } from './categories.js'

/**
 * The continuous toolbox's metrics (which leave room for the always-open
 * flyout) plus the content-metrics cache the scroll-options plugin needs
 * while a block is being dragged. Each plugin wants to be the workspace's
 * only metrics manager, so this one does both jobs (same code as the
 * plugin's ScrollMetricsManager).
 */
class ProtoMetrics extends ContinuousMetrics {
    useCachedContentMetrics = false
    contentMetrics = null

    /**
     * A hidden flyout takes no room. The plugin assumes its flyout is
     * always open; the phone layout's toolbox drawer closes it.
     */
    getFlyoutMetrics(own) {
        const metrics = super.getFlyoutMetrics(own)
        const flyout = this.workspace_.getFlyout(own)
        if (flyout && !flyout.isVisible()) {
            metrics.width = 0
            metrics.height = 0
        }
        return metrics
    }

    getContentMetrics() {
        if (this.useCachedContentMetrics && this.contentMetrics) {
            return this.contentMetrics
        }
        this.contentMetrics = super.getContentMetrics()
        return this.contentMetrics
    }
}

/**
 * The scroll-options dragger (wheel scrolling mid-drag, and the canvas
 * scrolling along when a block is dragged to an edge), except that edge
 * scrolling pauses while the pointer is near a drop target: the trash, the
 * backpack, and the flyout all sit on the edges, and the canvas would
 * scroll away from under them.
 */
class ProtoBlockDragger extends ScrollBlockDragger {
    /** How far around a drop target edge scrolling already stays off. */
    static NO_SCROLL_MARGIN = 60

    onDrag(event, totalDelta) {
        const nearTarget = this.workspace
            .getComponentManager()
            .getComponents(
                Blockly.ComponentManager.Capability.DRAG_TARGET,
                true,
            )
            .some((target) => {
                const rect = target.getClientRect()
                if (!rect) {
                    return false
                }
                const margin = ProtoBlockDragger.NO_SCROLL_MARGIN
                return (
                    event.clientX >= rect.left - margin &&
                    event.clientX <= rect.right + margin &&
                    event.clientY >= rect.top - margin &&
                    event.clientY <= rect.bottom + margin
                )
            })
        ScrollBlockDragger.edgeScrollEnabled = !nearTarget
        if (nearTarget) {
            this.stopAutoScrolling()
        }
        super.onDrag(event, totalDelta)
    }
}

/**
 * Blockly's text fields are edited in a plain <input>; phone keyboards
 * autocorrect and capitalise names in it (a "motor" becomes "Motor").
 * Every such input is told not to, the way CodeMirror's content already is.
 */
const quietTextFieldKeyboards = () => {
    const widgetCreate = Blockly.FieldTextInput.prototype.widgetCreate_
    Blockly.FieldTextInput.prototype.widgetCreate_ = function () {
        const input = widgetCreate.call(this)
        input.setAttribute('autocorrect', 'off')
        input.setAttribute('autocapitalize', 'off')
        input.setAttribute('autocomplete', 'off')
        input.setAttribute('spellcheck', 'false')
        return input
    }
}

/** Registers every Blockly modification. Call once, before any inject. */
export function injectMods() {
    Blockly.blockRendering.register('proto_renderer', ProtoRenderer)
    quietTextFieldKeyboards()

    // The always-open toolbox: every category's blocks in one scrolling
    // flyout (see editorPlugins in blocklyHelper.js).
    registerContinuousToolbox()
    // after the plugin, which registers its own category class
    Blockly.registry.register(
        Blockly.registry.Type.TOOLBOX_ITEM,
        Blockly.ToolboxCategory.registrationName,
        ProtoCategory,
        true,
    )
    // The search category (see searchCategory in blocklyHelper.js), as a
    // tab like the others, with its field as an item in the flyout.
    Blockly.registry.register(
        Blockly.registry.Type.TOOLBOX_ITEM,
        SEARCH_CATEGORY_KIND,
        ProtoSearchCategory,
        true,
    )
    Blockly.registry.register(
        Blockly.registry.Type.FLYOUT_INFLATER,
        SEARCH_FIELD_KIND,
        SearchFieldInflater,
    )
    Blockly.registry.register(
        Blockly.registry.Type.FLYOUTS_VERTICAL_TOOLBOX,
        'ProtoColumnFlyout',
        ContinuousColumnFlyout,
    )
    Blockly.registry.register(
        Blockly.registry.Type.FLYOUTS_HORIZONTAL_TOOLBOX,
        'ProtoRowFlyout',
        ContinuousRowFlyout,
    )
    Blockly.registry.register(
        Blockly.registry.Type.METRICS_MANAGER,
        'ProtoMetrics',
        ProtoMetrics,
    )
    Blockly.registry.register(
        Blockly.registry.Type.BLOCK_DRAGGER,
        'ProtoBlockDragger',
        ProtoBlockDragger,
        true,
    )
}
