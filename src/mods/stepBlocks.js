/*
 * Step blocks (`step: true` in library.js): a motion block with no time,
 * which runs make's 0.05 second default and so only means something inside
 * a loop, where it runs again and again. They look different (a dashed
 * edge, the protoStepBlock class, styles.css) and a drag that would leave
 * one outside every loop does not connect (StepConnectionChecker). A step
 * dropped on the open canvas connects to nothing, so no checker sees it;
 * the block linter marks it instead (blockLinter.js).
 */

import * as Blockly from 'blockly'

import { loopBlockTypes, stepBlockTypes } from '../data/library'

/** How see-through a default number in a slot is (1 is solid). */
const SHADOW_OPACITY = '0.5'

/** The class a step block's SVG group carries, for its dashed edge. */
export const STEP_CLASS = 'protoStepBlock'

/**
 * @param {object|null} block
 * @returns {boolean} Whether the block sits in a loop's slot, at any depth.
 */
export const insideLoop = (block) => {
    for (let parent = block?.getSurroundParent(); parent; ) {
        if (loopBlockTypes.has(parent.type)) {
            return true
        }
        parent = parent.getSurroundParent()
    }
    return false
}

/**
 * The step blocks in a stack that no loop in the stack encloses: the ones
 * that would be outside every loop if the stack sat at the top level.
 * @param {object} top The first block of the stack.
 * @returns {object[]}
 */
export const looseSteps = (top) => {
    const found = []
    const walk = (first) => {
        for (let block = first; block; block = block.getNextBlock()) {
            if (stepBlockTypes.has(block.type)) {
                found.push(block)
            }
            // whatever is inside a loop is fine
            if (loopBlockTypes.has(block.type)) {
                continue
            }
            for (const input of block.inputList) {
                const child = input.connection?.targetBlock()
                if (
                    child &&
                    input.type === Blockly.inputs.inputTypes.STATEMENT
                ) {
                    walk(child)
                }
            }
        }
    }
    walk(top)
    return found
}

/**
 * Would a block dragged by connection `a` sit inside a loop once it
 * connects to `b`?
 * @param {object} a The dragged block's connection.
 * @param {object} b The connection it would join.
 * @returns {boolean}
 */
const landsInLoop = (a, b) => {
    const target = b.getSourceBlock()
    if (b.type === Blockly.ConnectionType.NEXT_STATEMENT) {
        // a statement slot of the target, or the target's own next
        const slot = target.inputList.find((input) => input.connection === b)
        if (slot && loopBlockTypes.has(target.type)) {
            return true
        }
    }
    return insideLoop(target)
}

/**
 * Whether a dragged stack may join a connection: not if that would leave
 * one of its step blocks outside every loop.
 * @param {object} a The dragged stack's connection: its top, or, dropped
 *     above another block, its last block's bottom.
 * @param {object} b The connection it would join.
 * @returns {boolean}
 */
export const stepConnectionAllowed = (a, b) => {
    const dragged = a.getSourceBlock().getRootBlock()
    return !looseSteps(dragged).length || landsInLoop(a, b)
}

/**
 * Blockly's connection checker, refusing a drag that would leave a step
 * block outside every loop. Loading a saved program is not a drag, so it
 * is never refused; the linter marks what is out of place.
 */
export class StepConnectionChecker extends Blockly.ConnectionChecker {
    doDragChecks(a, b, distance) {
        return super.doDragChecks(a, b, distance) && stepConnectionAllowed(a, b)
    }
}

/** Registers the checker and the step blocks' look. Call once, before any inject. */
export const registerStepBlocks = () => {
    Blockly.registry.register(
        Blockly.registry.Type.CONNECTION_CHECKER,
        Blockly.registry.DEFAULT,
        StepConnectionChecker,
        true,
    )
    const initSvg = Blockly.BlockSvg.prototype.initSvg
    Blockly.BlockSvg.prototype.initSvg = function () {
        initSvg.call(this)
        if (stepBlockTypes.has(this.type)) {
            Blockly.utils.dom.addClass(this.getSvgRoot(), STEP_CLASS)
        }
    }
    // the striped fill: Blockly paints a block's colour onto its path
    // whenever it draws it, so the stripes go on after
    const applyColour = Blockly.BlockSvg.prototype.applyColour
    Blockly.BlockSvg.prototype.applyColour = function () {
        applyColour.call(this)
        // a default number in a slot (a shadow) takes the colour of the
        // block it sits in, so only its white number box shows
        const parent = this.isShadow() ? this.getParent() : null
        if (parent) {
            const path = this.pathObject?.svgPath
            path?.setAttribute(
                'fill',
                stepBlockTypes.has(parent.type)
                    ? `url(#${stripesFor(parent.getColour())})`
                    : parent.getColour(),
            )
            // partly see-through: the slot is a hole in the block, so the
            // canvas lightens it and it reads as a place to drop a variable
            path?.setAttribute('fill-opacity', SHADOW_OPACITY)
            return
        }
        if (stepBlockTypes.has(this.type)) {
            const path = this.pathObject?.svgPath
            const colour = this.getColour()
            if (path && colour) {
                path.setAttribute('fill', `url(#${stripesFor(colour)})`)
            }
        }
        // its default numbers may have been drawn before it had its colour
        // (a new block makes them while it is being built): paint them again
        for (const child of this.getChildren(false)) {
            if (child.isShadow() && child.rendered) {
                child.applyColour()
            }
        }
    }
}

/** Where the stripe patterns live: one hidden SVG for the whole page. */
let patternDefs = null

/**
 * A pattern of the block's colour with faint white diagonal stripes, made
 * once per colour. Every SVG on the page (the workspace, the toolbox
 * flyout, a dragged block) can fill with it by id.
 * @param {string} colour The block's colour, like #f2737b.
 * @returns {string} The pattern's id.
 */
const stripesFor = (colour) => {
    const id = `protoStepStripes-${colour.replace(/[^\w]/g, '')}`
    if (document.getElementById(id)) {
        return id
    }
    if (!patternDefs?.isConnected) {
        const svg = Blockly.utils.dom.createSvgElement(Blockly.utils.Svg.SVG, {
            width: 0,
            height: 0,
            'aria-hidden': 'true',
            style: 'position: absolute; width: 0; height: 0',
        })
        patternDefs = Blockly.utils.dom.createSvgElement('defs', {}, svg)
        document.body.appendChild(svg)
    }
    const pattern = Blockly.utils.dom.createSvgElement(
        'pattern',
        {
            id,
            width: 10,
            height: 10,
            patternUnits: 'userSpaceOnUse',
            patternTransform: 'rotate(45)',
        },
        patternDefs,
    )
    Blockly.utils.dom.createSvgElement(
        'rect',
        { width: 10, height: 10, fill: colour },
        pattern,
    )
    Blockly.utils.dom.createSvgElement(
        'rect',
        { width: 4, height: 10, fill: '#fff', 'fill-opacity': 0.28 },
        pattern,
    )
    return id
}
