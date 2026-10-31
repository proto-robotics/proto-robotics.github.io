/*
 * The minimap (@blockly/workspace-minimap): a small map of the whole
 * program in the canvas's top-left corner, with the visible part marked,
 * shown on request from the bar's Minimap toggle. The plugin draws copies
 * of the blocks, so the map can only exist while the editor is on screen;
 * the controller keeps the wish and applies it once the editor shows.
 */

import { renderManagement, serialization } from 'blockly'
import { PositionedMinimap } from '@blockly/workspace-minimap'

import { getBlocklyState } from './blocklyHelper'
import { isPhoneLayout } from './phoneLayoutHelper'

/**
 * The plugin's positioned minimap, in the canvas's top-left corner: its
 * default spot (top-right) is taken by the backpack and the drawer tabs.
 */
class CornerMinimap extends PositionedMinimap {
    setPosition(metrics) {
        this.left = metrics.absoluteMetrics.left + this.margin
        this.top = metrics.absoluteMetrics.top + this.margin
    }

    /**
     * A fixed size: the plugin's follows the canvas width, so the map would
     * grow and shrink as the code drawer opens and closes. Smaller on a
     * phone, where the full size would cover most of the canvas.
     */
    setSize() {
        const phone = isPhoneLayout()
        this.width = phone ? 132 : 220
        this.height = phone ? 90 : 150
    }
}

/**
 * Makes the minimap's focus region (the box marking the visible part of the
 * canvas) wait for a drawable state. It divides by the map's content size,
 * and during page load, on small windows especially, it runs while the map
 * still has no size or content, filling the console with NaN attribute
 * errors; and on a narrow window with the code drawer open the canvas has a
 * negative visible width, which the box copies. A map fitted at zero size
 * is fitted again.
 * @param {PositionedMinimap} minimap The minimap, after init.
 */
const guardFocusRegion = (minimap) => {
    const region = minimap.focusRegion
    if (!region) {
        return
    }
    const update = region.update.bind(region)
    region.update = () => {
        const map = minimap.minimapWorkspace
        if (!map) {
            return
        }
        const metrics = map.getMetricsManager()
        if (!(metrics.getSvgMetrics().width > 0)) {
            return
        }
        if (!(map.scale > 0)) {
            map.zoomToFit()
        }
        const content = metrics.getContentMetrics(true)
        const view = minimap.primaryWorkspace
            .getMetricsManager()
            .getViewMetrics(true)
        if (
            map.scale > 0 &&
            content.width > 0 &&
            content.height > 0 &&
            view.width > 0 &&
            view.height > 0
        ) {
            update()
        }
    }
}

/**
 * Creates the controller that shows and hides a workspace's minimap.
 * @param {object} blocklyInstance Value returned by createBlocklyInstance.
 *     May be rebuilt (same object, new workspace); the map follows.
 * @param {HTMLElement} container The editor element the map waits for.
 * @returns {{setWanted: (wanted: boolean) => void, apply: () => void}}
 *     `setWanted` turns the map on or off; `apply` re-checks whether the map
 *     can exist (call it when the editor comes on screen).
 */
export const createMinimapController = (blocklyInstance, container) => {
    let wanted = false
    let minimap = null
    /** The instance's cleanup list the removal is registered in. */
    let registeredCleanup = null

    const remove = () => {
        if (!minimap) {
            return
        }
        minimap.dispose()
        // The plugin's dispose leaves two things behind: its entry in the
        // component registry (the next init would throw) and its change
        // listener on the workspace, which keeps mirroring into the disposed
        // map (nulling the map makes it a no-op).
        const components = blocklyInstance.workspace?.getComponentManager()
        if (components?.getComponent(minimap.id)) {
            components.removeComponent(minimap.id)
        }
        minimap.minimapWorkspace = null
        minimap = null
    }

    const create = () => {
        minimap = new CornerMinimap(blocklyInstance.workspace)
        minimap.init()
        guardFocusRegion(minimap)
        // the plugin only mirrors changes, so show the current program
        serialization.workspaces.load(
            getBlocklyState(blocklyInstance),
            minimap.minimapWorkspace,
        )
        renderManagement.finishQueuedRenders().then(() => {
            minimap?.minimapWorkspace?.zoomToFit()
            minimap?.focusRegion?.update()
        })
        if (registeredCleanup !== blocklyInstance.cleanupCallbacks) {
            registeredCleanup = blocklyInstance.cleanupCallbacks
            registeredCleanup.push(remove)
        }
    }

    const apply = () => {
        const canExist = blocklyInstance.workspace && container.isConnected
        if (wanted && !minimap && canExist) {
            create()
        } else if (!wanted && minimap) {
            remove()
        }
    }

    return {
        setWanted: (isWanted) => {
            wanted = isWanted
            apply()
        },
        apply,
    }
}
