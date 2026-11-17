/*
 * The simplified menu's canvas: no toolbox, no block list. A click on the
 * empty canvas, or on a block, opens a round menu where it was clicked:
 *
 *   plus    the categories, then that category's blocks. On the canvas,
 *           a block goes where the click was; on a block, only blocks
 *           that fit it are offered (in a slot, inside it, or after it,
 *           where a dragged block would show its ghost), and the block
 *           goes there.
 *   wrench  other changes: undo, redo, tidy up, a note; for a block,
 *           copy, turn off or on, delete.
 *
 * A ripple shows where the canvas was clicked; a ring pulses around a
 * clicked block. Only while the page has the `simplified` class (see
 * BuildPageContent.js).
 */

import * as Blockly from 'blockly'

import { categoryIcon } from '../assets'
import { loopBlockTypes, stepBlockTypes } from '../data/library'
import { showToast } from '../helpers/toastHelper'
import { toggleBlockDisabled } from './clickModes'
import { addNote } from './notes'
import { insideLoop } from './stepBlocks'

// ---- icons (Lucide, ISC licence: lucide.dev) --------------------------------

const LUCIDE = {
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>',
    tidy: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    note: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
}

/** @param {keyof LUCIDE} name */
const lucide = (name) =>
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
    'stroke="currentColor" stroke-width="2.25" stroke-linecap="round" ' +
    `stroke-linejoin="round" aria-hidden="true">${LUCIDE[name]}</svg>`

const el = (tagName, className, html) => {
    const node = document.createElement(tagName)
    if (className) {
        node.className = className
    }
    if (html) {
        node.innerHTML = html
    }
    return node
}

/** How big a block's picture is in the list, against the canvas at 1. */
const PICTURE_SCALE = 0.65

// ---- what fits where --------------------------------------------------------

/**
 * The places on a block where another can go: its empty slots (or ones
 * holding only a number), the inside of its C-shape, and after it.
 * @param {Blockly.BlockSvg} block
 * @returns {Blockly.Connection[]}
 */
const placesOn = (block) => {
    const places = []
    for (const input of block.inputList) {
        const connection = input.connection
        if (!connection) {
            continue
        }
        const child = connection.targetBlock()
        if (
            input.type === Blockly.inputs.inputTypes.VALUE &&
            (!child || child.isShadow())
        ) {
            places.push(connection)
        } else if (input.type === Blockly.inputs.inputTypes.STATEMENT) {
            places.push(connection)
        }
    }
    if (block.nextConnection) {
        places.push(block.nextConnection)
    }
    return places
}

/**
 * The connection on `block` that would join `place`, or null.
 * @param {Blockly.Connection} place On the clicked block.
 * @param {Blockly.Block} block The block that would go there.
 */
const joinerFor = (place, block) => {
    const own =
        place.type === Blockly.ConnectionType.INPUT_VALUE
            ? block.outputConnection
            : block.previousConnection
    if (!own) {
        return null
    }
    const want = place.getCheck()
    const have = own.getCheck()
    if (want && have && !want.some((type) => have.includes(type))) {
        return null
    }
    // a step block only goes inside a loop (stepBlocks.js)
    if (stepBlockTypes.has(block.type)) {
        const host = place.getSourceBlock()
        const loopInside =
            loopBlockTypes.has(host.type) && place !== host.nextConnection
        if (!loopInside && !insideLoop(host)) {
            return null
        }
    }
    return own
}

/** The first place on `target` that `block` fits, as [place, joiner]. */
const fitOn = (target, block) => {
    for (const place of placesOn(target)) {
        const joiner = joinerFor(place, block)
        if (joiner) {
            return [place, joiner]
        }
    }
    return null
}

// ---- the menu ---------------------------------------------------------------

/**
 * Starts the round menu on a workspace.
 * @param {Blockly.WorkspaceSvg} workspace
 * @param {HTMLElement} Canvas The element around the canvas (positioned).
 * @returns {() => void} Stops it.
 */
export const startRadialMenu = (workspace, Canvas) => {
    const isOn = () => document.body.classList.contains('simplified')

    // The toolbox and its block list go while the menu is on. Blockly
    // shows them again on its own (the block list each time it is
    // refreshed), so while the menu is on they refuse to show. Hidden,
    // they take no room on the canvas (ProtoMetrics in mods.js) and a
    // block dropped where they were is not deleted.
    const toolbox = workspace.getToolbox()
    const flyout = toolbox?.getFlyout?.()
    const toolboxShow = toolbox?.setVisible?.bind(toolbox)
    const flyoutShow = flyout?.setVisible?.bind(flyout)
    if (toolboxShow) {
        toolbox.setVisible = (visible) => toolboxShow(visible && !isOn())
    }
    if (flyoutShow) {
        flyout.setVisible = (visible) => flyoutShow(visible && !isOn())
    }
    const showToolbox = (shown) => {
        toolboxShow?.(shown)
        flyoutShow?.(shown)
        Blockly.svgResize(workspace)
    }
    let wasOn = isOn()
    showToolbox(!wasOn)
    const watchBody = new MutationObserver(() => {
        if (isOn() === wasOn) {
            return
        }
        wasOn = isOn()
        close()
        showToolbox(!wasOn)
    })
    watchBody.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
    })

    /**
     * The toolbox's categories with their blocks, as the block list shows
     * them (its blocks carry the devices picked, so they are copied).
     */
    const categories = () => {
        const flyoutBlocks = new Map()
        const flyoutWorkspace = workspace.getToolbox()?.getFlyout?.()?.getWorkspace()
        for (const block of flyoutWorkspace?.getTopBlocks(true) ?? []) {
            if (!flyoutBlocks.has(block.type)) {
                flyoutBlocks.set(block.type, block)
            }
        }
        return (workspace.options.languageTree?.contents ?? [])
            .filter((item) => item.kind === 'category' && item.contents)
            .map((item) => ({
                name: item.name,
                colour: item.colour,
                blocks: item.contents
                    .filter((entry) => entry.kind === 'block')
                    .map((entry) => flyoutBlocks.get(entry.type))
                    .filter(Boolean),
            }))
    }

    /** Where the canvas was last pressed, in the page. */
    let press = { x: 0, y: 0 }
    // (a press inside the menu keeps it: each ring opens, and a block
    // lands, where the canvas was clicked)
    const onPress = (event) => {
        if (Menu?.contains(event.target)) {
            return
        }
        press = { x: event.clientX, y: event.clientY }
        close()
    }
    Canvas.addEventListener('pointerdown', onPress, true)

    let Menu = null
    const close = () => {
        Menu?.remove()
        Menu = null
    }
    const onKey = (event) => {
        if (event.key === 'Escape') {
            close()
        }
    }
    document.addEventListener('keydown', onKey)

    /** A point in the page, as a point on the canvas element. */
    const local = ({ x, y }) => {
        const box = Canvas.getBoundingClientRect()
        return { x: x - box.left, y: y - box.top }
    }

    const ripple = (point) => {
        const { x, y } = local(point)
        const Ripple = el('div', 'radial-ripple')
        Ripple.style.left = `${x}px`
        Ripple.style.top = `${y}px`
        Ripple.addEventListener('animationend', () => Ripple.remove())
        Canvas.append(Ripple)
    }

    const pulse = (block) => {
        const shape = block.pathObject?.svgPath ?? block.getSvgRoot()
        const box = shape.getBoundingClientRect()
        const { x, y } = local({ x: box.left, y: box.top })
        const Pulse = el('div', 'block-pulse')
        Object.assign(Pulse.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
        })
        Pulse.addEventListener('animationend', () => Pulse.remove())
        Canvas.append(Pulse)
    }

    // ---- press and slide ----
    //
    // Past the first ring, a press can carry on: hold on Add Block (or
    // the wrench, or a category) and the next ring opens at once; slide
    // onto a category and it opens after a moment; let go on a block or
    // an action and it is picked. A plain click works as before.

    /** How long the pointer rests on a ring-opening button to open it. */
    const DWELL = 180
    /** How far the pointer moves after a ring opens before it counts. */
    const SETTLE = 12

    /** Whether a press that opened a ring is still held. */
    let holding = false
    /** The button that press was on (its own release is no pick). */
    let heldFrom = null
    /** Where the pointer is, in the page. */
    let pointer = { x: 0, y: 0 }
    /** Where it was when the last ring opened, and whether it has left. */
    let settledFrom = { x: 0, y: 0 }
    let settled = true
    let hovered = null
    let dwellTimer = 0
    /** A pick made on release; the click that may follow is no second one. */
    let pickedAt = 0

    /**
     * Makes a menu button work by click, and by press and slide: one that
     * opens another ring (`opens`) does so as soon as it is pressed, and
     * the press stays held for the next ring.
     * @param {HTMLElement} Button
     * @param {() => void} act
     * @param {boolean} [opens]
     */
    const wire = (Button, act, opens = false) => {
        Button.dataset.radial = opens ? 'opens' : 'pick'
        Button.radialAct = act
        Button.addEventListener('click', () => {
            if (Date.now() - pickedAt > 300) {
                act()
            }
        })
        if (opens) {
            Button.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) {
                    return
                }
                event.preventDefault()
                holding = true
                heldFrom = Button
                pickedAt = Date.now() // its own click is not another
                act()
            })
        }
    }

    /** A ring just opened: what is under a held pointer does not count yet. */
    const armUnderPointer = () => {
        settledFrom = { ...pointer }
        settled = !holding
    }

    const buttonAt = ({ x, y }) =>
        document
            .elementFromPoint(x, y)
            ?.closest?.('.radial-menu [data-radial]') ?? null

    const hover = (Button) => {
        if (Button === hovered) {
            return
        }
        hovered?.classList.remove('radial-hover')
        clearTimeout(dwellTimer)
        hovered = Button
        Button?.classList.add('radial-hover')
        if (Button?.dataset.radial === 'opens') {
            dwellTimer = setTimeout(() => {
                if (holding && hovered === Button && Button.isConnected) {
                    hover(null)
                    heldFrom = Button
                    Button.radialAct()
                }
            }, DWELL)
        }
    }

    const onSlide = (event) => {
        pointer = { x: event.clientX, y: event.clientY }
        if (!holding) {
            return
        }
        if (!(event.buttons & 1)) {
            holding = false
            hover(null)
            return
        }
        if (
            !settled &&
            Math.hypot(pointer.x - settledFrom.x, pointer.y - settledFrom.y) >=
                SETTLE
        ) {
            settled = true
        }
        hover(settled ? buttonAt(pointer) : null)
    }

    const onLetGo = (event) => {
        if (!holding) {
            return
        }
        holding = false
        hover(null)
        const Button = buttonAt({ x: event.clientX, y: event.clientY })
        if (
            settled &&
            Button &&
            Button !== heldFrom &&
            Button.dataset.radial === 'pick'
        ) {
            pickedAt = Date.now()
            Button.radialAct()
        }
    }
    document.addEventListener('pointermove', onSlide, true)
    document.addEventListener('pointerup', onLetGo, true)

    /**
     * Opens the menu at the press, showing a ring of buttons around a
     * middle one.
     * @param {{icon?: string, image?: string, label: string,
     *     colour?: string, act: () => void, opens?: boolean}[]} items
     *     `opens` marks one that opens another ring (see wire).
     * @param {{icon: string, label: string, act: () => void}} middle
     */
    const ring = (items, middle) => {
        close()
        Menu = el('div', 'radial-menu')
        const step = Math.min(360 / items.length, 60)
        const radius = Math.max(76, 84 / ((step * Math.PI) / 180))
        const box = Canvas.getBoundingClientRect()
        const reach = radius + 48
        const { x, y } = local(press)
        const cx = Math.min(Math.max(x, reach), box.width - reach)
        const cy = Math.min(Math.max(y, reach), box.height - reach)
        Menu.style.left = `${cx}px`
        Menu.style.top = `${cy}px`

        const Middle = el('button', 'radial-middle', lucide(middle.icon))
        Middle.type = 'button'
        Middle.title = middle.label
        Middle.setAttribute('aria-label', middle.label)
        wire(Middle, middle.act)
        Menu.append(Middle)

        const start = -90 - (step * (items.length - 1)) / 2
        items.forEach((item, index) => {
            const angle = ((start + step * index) * Math.PI) / 180
            const Item = el('button', 'radial-item')
            Item.type = 'button'
            Item.style.setProperty('--x', `${Math.cos(angle) * radius}px`)
            Item.style.setProperty('--y', `${Math.sin(angle) * radius}px`)
            Item.style.setProperty('--delay', `${index * 25}ms`)
            const Bubble = el(
                'span',
                'radial-bubble',
                item.icon ? lucide(item.icon) : '',
            )
            if (item.image) {
                const Image = el('img')
                Image.src = item.image
                Image.alt = ''
                Bubble.append(Image)
            }
            if (item.colour) {
                Bubble.style.setProperty('--colour', item.colour)
            }
            Item.append(Bubble, el('span', 'radial-label'))
            Item.lastChild.textContent = item.label
            wire(Item, item.act, item.opens)
            Menu.append(Item)
        })
        Canvas.append(Menu)
        armUnderPointer()
    }

    /**
     * A picture of a block from the (hidden) block list: a copy of its
     * drawing, in a wrapper with the canvas's renderer and theme classes so
     * Blockly's styles reach it. Its stripes and shadows refer to patterns
     * in the canvas's own defs, which are on the page. It is sized once on
     * the page (fitPicture), where its drawing can be measured.
     * @param {Blockly.BlockSvg} block
     * @returns {HTMLElement}
     */
    const picture = (block) => {
        const svg = document.createElementNS(Blockly.utils.dom.SVG_NS, 'svg')
        const copy = block.getSvgRoot().cloneNode(true)
        copy.removeAttribute('transform')
        copy.classList.remove('blocklySelected')
        // the outlines Blockly draws on a connection while a block is
        // dragged near it; off the canvas they would show, in white
        copy.querySelectorAll('.blocklyHighlightedConnectionPath').forEach(
            (path) => path.remove(),
        )
        svg.append(copy)
        const Frame = el('span', 'radial-block-picture')
        const injection = workspace.getInjectionDiv()
        for (const name of injection.classList) {
            if (name !== 'injectionDiv') {
                Frame.classList.add(name)
            }
        }
        Frame.append(svg)
        return Frame
    }

    /**
     * Sizes a picture to its drawing (Blockly's own width leaves out the
     * arms of a C-shaped block), with a little room for the edges.
     * @param {SVGSVGElement} svg A picture's svg, on the page.
     */
    const fitPicture = (svg) => {
        // the outline: the group's own box counts parts Blockly keeps hidden
        const shape =
            svg.querySelector(':scope > g > .blocklyPath') ?? svg.firstElementChild
        const { x, y, width, height } = shape.getBBox()
        const box = [x - 2, y - 2, width + 4, height + 4]
        svg.setAttribute('viewBox', box.join(' '))
        svg.setAttribute('width', String(box[2] * PICTURE_SCALE))
        svg.setAttribute('height', String(box[3] * PICTURE_SCALE))
    }

    /**
     * A category's blocks in a ring around the middle (Back), each with
     * its near edge on a circle just big enough that none overlap. They
     * fly out from the middle.
     */
    const list = (category, blocks, onBack, onPick) => {
        close()
        Menu = el('div', 'radial-menu radial-blocks')
        Menu.style.setProperty('--colour', category.colour)

        const Middle = el('button', 'radial-middle', lucide('back'))
        Middle.type = 'button'
        Middle.title = `Back (${category.name})`
        Middle.setAttribute('aria-label', 'Back')
        wire(Middle, onBack)
        Menu.append(Middle)

        const Items = blocks.map((block, index) => {
            const Item = el('button', 'radial-block')
            Item.type = 'button'
            Item.setAttribute(
                'aria-label',
                block
                    .toString()
                    // the help mark at the end reads as its alt text
                    .replace(/\s*(\?|Info)\s*$/, '')
                    .replace(/\s+/g, ' '),
            )
            Item.style.setProperty('--delay', `${index * 25}ms`)
            Item.append(picture(block))
            wire(Item, () => onPick(block))
            Item.addEventListener('pointerdown', (event) =>
                dragOut(event, Item, block),
            )
            Menu.append(Item)
            return Item
        })
        Canvas.append(Menu)
        Menu.querySelectorAll('.radial-block-picture svg').forEach(fitPicture)

        // evenly round the middle from the top, clockwise; each block sits
        // with its near edge on the circle, and the circle grows until no
        // two blocks overlap
        const GAP = 6
        const CLEAR = 34 // past the middle button
        const sizes = Items.map((Item) => [Item.offsetWidth, Item.offsetHeight])
        const layout = (radius) =>
            Items.map((Item, index) => {
                const angle =
                    -Math.PI / 2 + (2 * Math.PI * index) / Items.length
                const dx = Math.cos(angle)
                const dy = Math.sin(angle)
                const [width, height] = sizes[index]
                // from the block's centre to its edge, toward the middle
                const edge = Math.min(
                    Math.abs(dx) > 1e-6 ? width / 2 / Math.abs(dx) : Infinity,
                    Math.abs(dy) > 1e-6 ? height / 2 / Math.abs(dy) : Infinity,
                )
                const away = radius + edge
                return {
                    Item,
                    left: dx * away - width / 2,
                    top: dy * away - height / 2,
                    width,
                    height,
                }
            })
        const overlaps = (spots) =>
            spots.some((a, i) =>
                spots.some(
                    (b, j) =>
                        j > i &&
                        a.left < b.left + b.width + GAP &&
                        b.left < a.left + a.width + GAP &&
                        a.top < b.top + b.height + GAP &&
                        b.top < a.top + a.height + GAP,
                ),
            )
        let radius = CLEAR
        let spots = layout(radius)
        while (overlaps(spots) && radius < 600) {
            radius += 6
            spots = layout(radius)
        }

        // the whole ring kept on the canvas
        const box = Canvas.getBoundingClientRect()
        const minX = Math.min(-CLEAR, ...spots.map((s) => s.left))
        const maxX = Math.max(CLEAR, ...spots.map((s) => s.left + s.width))
        const minY = Math.min(-CLEAR, ...spots.map((s) => s.top))
        const maxY = Math.max(CLEAR, ...spots.map((s) => s.top + s.height))
        const { x, y } = local(press)
        const fit = (at, low, high, size) =>
            Math.min(Math.max(at, 8 - low), size - 8 - high)
        Menu.style.left = `${fit(x, minX, maxX, box.width)}px`
        Menu.style.top = `${fit(y, minY, maxY, box.height)}px`
        for (const { Item, left, top } of spots) {
            Item.style.setProperty('--x', `${left}px`)
            Item.style.setProperty('--y', `${top}px`)
        }
        armUnderPointer()
    }

    // ---- what the buttons do ----

    /** Puts a copy of a toolbox block on the canvas, at the press or on a block. */
    const place = (source, target) => {
        const state = Blockly.serialization.blocks.save(source, {
            addCoordinates: false,
            addNextBlocks: false,
        })
        Blockly.Events.setGroup(true)
        try {
            const block = Blockly.serialization.blocks.append(state, workspace, {
                recordUndo: true,
            })
            if (target) {
                const fit = fitOn(target, block)
                if (!fit) {
                    block.dispose(false)
                    showToast('error', "That block can't go there")
                    return
                }
                fit[0].connect(fit[1])
            } else {
                const at = Blockly.utils.svgMath.screenToWsCoordinates(
                    workspace,
                    new Blockly.utils.Coordinate(press.x, press.y),
                )
                block.moveTo(at)
            }
            Blockly.common.setSelected(block)
            requestAnimationFrame(() => pulse(block))
        } finally {
            Blockly.Events.setGroup(false)
        }
    }

    /**
     * A block in the ring can be dragged out as from the toolbox: once the
     * press moves, the block is made on the canvas under the pointer
     * (held at the same spot it was taken by) and Blockly drags it, ghost
     * and all. A press that does not move stays a click.
     * @param {PointerEvent} down The press on the block's button.
     * @param {HTMLElement} Item The button.
     * @param {Blockly.BlockSvg} source The toolbox block it shows.
     */
    const dragOut = (down, Item, source) => {
        if (down.button !== 0) {
            return
        }
        down.preventDefault() // no text selection while dragging
        const svg = Item.querySelector('svg')
        const onMove = (move) => {
            if (
                Math.hypot(
                    move.clientX - down.clientX,
                    move.clientY - down.clientY,
                ) < 5
            ) {
                return
            }
            stop()
            // where on the block it was taken, in its own units
            const frame = svg.getBoundingClientRect()
            const [boxX, boxY, boxWidth, boxHeight] = svg
                .getAttribute('viewBox')
                .split(' ')
                .map(Number)
            const grab = {
                x: boxX + ((down.clientX - frame.left) / frame.width) * boxWidth,
                y: boxY + ((down.clientY - frame.top) / frame.height) * boxHeight,
            }
            close()
            const state = Blockly.serialization.blocks.save(source, {
                addCoordinates: false,
                addNextBlocks: false,
            })
            const block = Blockly.serialization.blocks.append(state, workspace, {
                recordUndo: true,
            })
            const at = Blockly.utils.svgMath.screenToWsCoordinates(
                workspace,
                new Blockly.utils.Coordinate(move.clientX, move.clientY),
            )
            block.moveTo(new Blockly.utils.Coordinate(at.x - grab.x, at.y - grab.y))
            // a press on the new block, where the pointer is, starts
            // Blockly's own drag; the pointer's next moves carry it
            const under = document.elementFromPoint(move.clientX, move.clientY)
            if (under && block.getSvgRoot().contains(under)) {
                under.dispatchEvent(
                    new PointerEvent('pointerdown', {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        clientX: move.clientX,
                        clientY: move.clientY,
                        button: 0,
                        buttons: 1,
                        pointerId: move.pointerId,
                        pointerType: move.pointerType,
                        isPrimary: true,
                    }),
                )
            }
        }
        const stop = () => {
            document.removeEventListener('pointermove', onMove, true)
            document.removeEventListener('pointerup', stop, true)
        }
        document.addEventListener('pointermove', onMove, true)
        document.addEventListener('pointerup', stop, true)
    }

    const blocksMenu = (target, back) => {
        const offered = categories()
            .map((category) => ({
                ...category,
                blocks: target
                    ? category.blocks.filter((block) => fitOn(target, block))
                    : category.blocks,
            }))
            .filter((category) => category.blocks.length)
        if (!offered.length) {
            showToast('info', 'Nothing fits here', 'Try the block after it.')
            return
        }
        const show = () =>
            ring(
                offered.map((category) => ({
                    image: categoryIcon(category.name),
                    label: category.name,
                    colour: category.colour,
                    opens: true,
                    act: () =>
                        list(category, category.blocks, show, (block) => {
                            close()
                            place(block, target)
                        }),
                })),
                { icon: 'back', label: 'Back', act: back },
            )
        show()
    }

    const doThen = (act) => () => {
        close()
        act()
    }

    const spaceMenu = () =>
        ring(
            [
                {
                    icon: 'wrench',
                    label: 'Change',
                    opens: true,
                    act: () =>
                        ring(
                            [
                                {
                                    icon: 'undo',
                                    label: 'Undo',
                                    act: doThen(() => workspace.undo(false)),
                                },
                                {
                                    icon: 'redo',
                                    label: 'Redo',
                                    act: doThen(() => workspace.undo(true)),
                                },
                                {
                                    icon: 'tidy',
                                    label: 'Tidy Up',
                                    act: doThen(() => workspace.cleanUp()),
                                },
                                {
                                    icon: 'note',
                                    label: 'Note',
                                    act: doThen(() => {
                                        const note = addNote(workspace)
                                        note.moveTo(
                                            Blockly.utils.svgMath.screenToWsCoordinates(
                                                workspace,
                                                new Blockly.utils.Coordinate(
                                                    press.x,
                                                    press.y,
                                                ),
                                            ),
                                        )
                                        note.select?.()
                                    }),
                                },
                            ],
                            { icon: 'back', label: 'Back', act: spaceMenu },
                        ),
                },
                {
                    icon: 'plus',
                    label: 'Add Block',
                    opens: true,
                    act: () => blocksMenu(null, spaceMenu),
                },
            ],
            { icon: 'x', label: 'Close', act: close },
        )

    const blockMenu = (block) => {
        const back = () => blockMenu(block)
        const off = block.hasDisabledReason(Blockly.constants.MANUALLY_DISABLED)
        ring(
            [
                {
                    icon: 'wrench',
                    label: 'Change',
                    opens: true,
                    act: () =>
                        ring(
                            [
                                {
                                    icon: 'copy',
                                    label: 'Copy',
                                    act: doThen(() => {
                                        const copy = Blockly.clipboard.paste(
                                            block.toCopyData(),
                                            workspace,
                                        )
                                        if (copy) {
                                            Blockly.common.setSelected(copy)
                                            pulse(copy)
                                        }
                                    }),
                                },
                                {
                                    icon: 'power',
                                    label: off ? 'Turn On' : 'Turn Off',
                                    act: doThen(() => toggleBlockDisabled(block)),
                                },
                                {
                                    icon: 'trash',
                                    label: 'Delete',
                                    act: doThen(() => {
                                        Blockly.Events.setGroup(true)
                                        block.checkAndDelete()
                                        Blockly.Events.setGroup(false)
                                    }),
                                },
                            ],
                            { icon: 'back', label: 'Back', act: back },
                        ),
                },
                {
                    icon: 'plus',
                    label: 'Add Block',
                    opens: true,
                    act: () => blocksMenu(block, back),
                },
            ],
            { icon: 'x', label: 'Close', act: close },
        )
    }

    // a click (Blockly's: a press that did not drag)
    const onClick = (event) => {
        if (!isOn() || event.type !== Blockly.Events.CLICK) {
            return
        }
        if (event.targetType === 'workspace') {
            ripple(press)
            spaceMenu()
        } else if (event.targetType === 'block') {
            let block = workspace.getBlockById(event.blockId)
            while (block?.isShadow()) {
                block = block.getParent()
            }
            if (block) {
                pulse(block)
                blockMenu(block)
            }
        }
    }
    workspace.addChangeListener(onClick)

    return () => {
        close()
        watchBody.disconnect()
        if (toolboxShow) {
            delete toolbox.setVisible
        }
        if (flyoutShow) {
            delete flyout.setVisible
        }
        workspace.removeChangeListener(onClick)
        Canvas.removeEventListener('pointerdown', onPress, true)
        document.removeEventListener('keydown', onKey)
        document.removeEventListener('pointermove', onSlide, true)
        document.removeEventListener('pointerup', onLetGo, true)
        clearTimeout(dwellTimer)
    }
}
