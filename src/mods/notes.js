/*
 * Notes: sticky notes on the canvas (Blockly's workspace comments), each of
 * which can point at a block. Hover near a note's edge and a handle shows
 * at the nearest of its snap points (a quarter, half and three quarters
 * along each side); drag the handle onto a block and the note is linked to
 * it, drawn as a line from that point on the note to the block's nearest
 * edge. Drop it on the open canvas to unlink. A linked note's text goes
 * into the block's Python as a comment.
 *
 * Blockly saves the notes themselves; the links are saved beside them
 * under `noteLinks`, as [{ note, block, side, t }].
 */

import * as Blockly from 'blockly'
import { pythonGenerator } from 'blockly/python'

const { Coordinate, Size } = Blockly.utils
const svg = (name, attributes, parent) =>
    Blockly.utils.dom.createSvgElement(name, attributes, parent)

/** Where along each side a note's snap points are. */
const SNAP_FRACTIONS = [0.25, 0.5, 0.75]
const SIDES = ['top', 'right', 'bottom', 'left']
/** How close to a note's edge, in screen pixels, its handle shows. */
const EDGE_BAND = 14

/** @type {WeakMap<object, Map<string, {block: string, side: string, t: number}>>} */
const linksByWorkspace = new WeakMap()
const linksOf = (workspace) => {
    let links = linksByWorkspace.get(workspace)
    if (!links) {
        links = new Map()
        linksByWorkspace.set(workspace, links)
    }
    return links
}

// ---- geometry, in workspace units ------------------------------------------

/** @returns {{x: number, y: number, w: number, h: number}} */
const noteRect = (note) => {
    const { x, y } = note.getRelativeToSurfaceXY()
    const { width, height } = note.getSize()
    return { x, y, w: width, h: height }
}

/** The block's own outline, without the blocks under it or inside it. */
const blockRect = (block) => {
    const { left, top, right, bottom } =
        block.getBoundingRectangleWithoutChildren()
    return { x: left, y: top, w: right - left, h: bottom - top }
}

/** The point a fraction `t` along one side of a rectangle. */
const pointOn = (rect, side, t) => {
    switch (side) {
        case 'top':
            return { x: rect.x + rect.w * t, y: rect.y }
        case 'bottom':
            return { x: rect.x + rect.w * t, y: rect.y + rect.h }
        case 'left':
            return { x: rect.x, y: rect.y + rect.h * t }
        default:
            return { x: rect.x + rect.w, y: rect.y + rect.h * t }
    }
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** @returns {{side: string, t: number, x: number, y: number}} The snap point nearest p. */
const nearestSnap = (rect, p) =>
    SIDES.flatMap((side) =>
        SNAP_FRACTIONS.map((t) => ({ side, t, ...pointOn(rect, side, t) })),
    ).reduce((best, point) =>
        distance(point, p) < distance(best, p) ? point : best,
    )

/** The point on a rectangle's edge nearest p (p may be inside it). */
const nearestOnEdge = (rect, p) => {
    const x = Math.min(Math.max(p.x, rect.x), rect.x + rect.w)
    const y = Math.min(Math.max(p.y, rect.y), rect.y + rect.h)
    const inside = x === p.x && y === p.y
    if (!inside) {
        return { x, y }
    }
    // inside: out to the nearest side
    const gaps = [
        [p.y - rect.y, { x, y: rect.y }],
        [rect.y + rect.h - p.y, { x, y: rect.y + rect.h }],
        [p.x - rect.x, { x: rect.x, y }],
        [rect.x + rect.w - p.x, { x: rect.x + rect.w, y }],
    ]
    return gaps.reduce((best, gap) => (gap[0] < best[0] ? gap : best))[1]
}

const contains = (rect, p, margin = 0) =>
    p.x >= rect.x - margin &&
    p.x <= rect.x + rect.w + margin &&
    p.y >= rect.y - margin &&
    p.y <= rect.y + rect.h + margin

// ---- the program's Python -------------------------------------------------

let pythonPatched = false
/**
 * Puts each linked note's text above its block's Python, as # lines.
 * Blockly's generator calls scrub_ for every block it writes.
 */
const patchPython = () => {
    if (pythonPatched) {
        return
    }
    pythonPatched = true
    const scrub = pythonGenerator.scrub_
    pythonGenerator.scrub_ = function (block, code, thisOnly) {
        const out = scrub.call(this, block, code, thisOnly)
        if (block.outputConnection || !block.workspace) {
            return out
        }
        const notes = [...linksOf(block.workspace)]
            .filter(([, link]) => link.block === block.id)
            .map(([id]) => block.workspace.getCommentById?.(id))
            .filter((note) => note && note.getText().trim())
        if (!notes.length) {
            return out
        }
        const lines = notes
            .flatMap((note) => note.getText().trim().split('\n'))
            .map((line) => `# ${line}\n`)
            .join('')
        return lines + out
    }
}

// The links are saved with the workspace, after the blocks and notes they
// join (a lower priority loads later).
Blockly.serialization.registry.register('noteLinks', {
    priority: 10,
    save: (workspace) => {
        const links = [...linksOf(workspace)].map(([note, link]) => ({
            note,
            ...link,
        }))
        return links.length ? links : null
    },
    load: (state, workspace) => {
        const links = linksOf(workspace)
        links.clear()
        for (const { note, block, side, t } of Array.isArray(state)
            ? state
            : []) {
            if (SIDES.includes(side) && typeof t === 'number') {
                links.set(note, { block, side, t })
            }
        }
    },
    clear: (workspace) => linksOf(workspace).clear(),
})

/**
 * Adds an empty note in the middle of what the canvas shows.
 * @param {object} workspace
 * @returns {object} The note.
 */
export const addNote = (workspace) => {
    const view = workspace.getMetricsManager().getViewMetrics(true)
    const note = new Blockly.comments.RenderedWorkspaceComment(workspace)
    const size = new Size(180, 110)
    note.setSize(size)
    note.moveTo(
        new Coordinate(
            view.left + (view.width - size.width) / 2,
            view.top + (view.height - size.height) / 2,
        ),
    )
    note.setPlaceholderText?.('Write a note, then drag its edge to a block')
    return note
}

/**
 * Starts the notes' links on an editable workspace: the lines, the edge
 * handle, and linking by dragging it.
 * @param {object} workspace
 * @param {() => void} onChange Called when a link is made or undone, so the
 *     program is saved and its Python written again.
 * @returns {() => void} Stops.
 */
export const startNotes = (workspace, onChange) => {
    patchPython()
    const links = linksOf(workspace)
    const lines = svg('g', { class: 'protoNoteLinks' })
    workspace.getCanvas().insertBefore(lines, workspace.getCanvas().firstChild)
    const overlay = svg(
        'g',
        { class: 'protoNoteOverlay' },
        workspace.getBubbleCanvas(),
    )
    const handle = svg('circle', { class: 'protoNoteHandle', r: 7 }, overlay)
    handle.style.display = 'none'
    const draft = svg(
        'line',
        { class: 'protoNoteLink protoNoteDraft' },
        overlay,
    )
    draft.style.display = 'none'

    const notes = () => workspace.getTopComments(false)
    const toWorkspace = (event) =>
        Blockly.utils.svgMath.screenToWsCoordinates(
            workspace,
            new Coordinate(event.clientX, event.clientY),
        )

    /** Draws every link again; drops the links whose note or block is gone. */
    const draw = () => {
        lines.replaceChildren()
        let dropped = false
        for (const [id, link] of links) {
            const note = workspace.getCommentById(id)
            const block = workspace.getBlockById(link.block)
            if (
                !note ||
                !block ||
                note.isDeadOrDying() ||
                block.isDeadOrDying()
            ) {
                links.delete(id)
                dropped = true
                continue
            }
            const from = pointOn(noteRect(note), link.side, link.t)
            const to = nearestOnEdge(blockRect(block), from)
            svg(
                'line',
                {
                    class: 'protoNoteLink',
                    x1: from.x,
                    y1: from.y,
                    x2: to.x,
                    y2: to.y,
                },
                lines,
            )
            svg(
                'circle',
                { class: 'protoNoteEnd', cx: from.x, cy: from.y, r: 4 },
                lines,
            )
            svg(
                'circle',
                { class: 'protoNoteEnd', cx: to.x, cy: to.y, r: 4 },
                lines,
            )
        }
        if (dropped) {
            onChange()
        }
    }

    // ---- the handle on a note's edge
    let hover = null // { note, snap }
    const showHandle = (event) => {
        if (linking || workspace.isDragging()) {
            return
        }
        const p = toWorkspace(event)
        const band = EDGE_BAND / workspace.scale
        hover = null
        for (const note of notes()) {
            const rect = noteRect(note)
            const inner = {
                x: rect.x + band,
                y: rect.y + band,
                w: rect.w - 2 * band,
                h: rect.h - 2 * band,
            }
            if (
                contains(rect, p, band) &&
                !(inner.w > 0 && inner.h > 0 && contains(inner, p))
            ) {
                hover = { note, snap: nearestSnap(rect, p) }
                break
            }
        }
        if (hover) {
            handle.setAttribute('cx', hover.snap.x)
            handle.setAttribute('cy', hover.snap.y)
            handle.style.display = ''
        } else {
            handle.style.display = 'none'
        }
    }

    // ---- dragging the handle onto a block
    let linking = null // { note, side, t, target }
    const blockAt = (p) => {
        const found = workspace
            .getAllBlocks(false)
            .filter(
                (block) => !block.isShadow() && contains(blockRect(block), p),
            )
        // the innermost: the smallest block under the pointer
        return (
            found.sort((a, b) => {
                const ra = blockRect(a)
                const rb = blockRect(b)
                return ra.w * ra.h - rb.w * rb.h
            })[0] ?? null
        )
    }
    const setTarget = (block) => {
        if (linking.target === block) {
            return
        }
        linking.target?.getSvgRoot()?.classList.remove('protoNoteTarget')
        linking.target = block
        block?.getSvgRoot()?.classList.add('protoNoteTarget')
    }

    const onHandleDown = (event) => {
        if (!hover) {
            return
        }
        event.stopPropagation()
        event.preventDefault()
        handle.setPointerCapture(event.pointerId)
        const { note, snap } = hover
        linking = { note, side: snap.side, t: snap.t, target: null }
        draft.setAttribute('x1', snap.x)
        draft.setAttribute('y1', snap.y)
        draft.setAttribute('x2', snap.x)
        draft.setAttribute('y2', snap.y)
        draft.style.display = ''
    }
    const onHandleMove = (event) => {
        if (!linking) {
            return
        }
        const p = toWorkspace(event)
        draft.setAttribute('x2', p.x)
        draft.setAttribute('y2', p.y)
        handle.setAttribute('cx', p.x)
        handle.setAttribute('cy', p.y)
        setTarget(blockAt(p))
    }
    const onHandleUp = (event) => {
        if (!linking) {
            return
        }
        const { note, side, t, target } = linking
        setTarget(null)
        linking = null
        draft.style.display = 'none'
        handle.style.display = 'none'
        handle.releasePointerCapture?.(event.pointerId)
        if (target) {
            links.set(note.id, { block: target.id, side, t })
        } else {
            links.delete(note.id)
        }
        draw()
        onChange()
    }
    handle.addEventListener('pointerdown', onHandleDown)
    handle.addEventListener('pointermove', onHandleMove)
    handle.addEventListener('pointerup', onHandleUp)
    handle.addEventListener('pointercancel', onHandleUp)

    // ---- keeping the lines on things as they move
    const parent = workspace.getParentSvg()
    let frame = 0
    const follow = () => {
        draw()
        frame = requestAnimationFrame(follow)
    }
    const onDown = () => {
        if (!frame && links.size) {
            frame = requestAnimationFrame(follow)
        }
    }
    const onUp = () => {
        cancelAnimationFrame(frame)
        frame = 0
        draw()
    }
    parent.addEventListener('pointermove', showHandle)
    parent.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    const onEvent = (event) => {
        if (event.type === Blockly.Events.VIEWPORT_CHANGE) {
            return
        }
        draw()
    }
    workspace.addChangeListener(onEvent)
    draw()

    return () => {
        cancelAnimationFrame(frame)
        parent.removeEventListener('pointermove', showHandle)
        parent.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('pointerup', onUp, true)
        workspace.removeChangeListener(onEvent)
        lines.remove()
        overlay.remove()
    }
}
