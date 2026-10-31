/*
 * The round-shape mosaics in the corners of the top bar, ported from the
 * main site (public-website/src/components/Mosaic.tsx). Generated at
 * runtime from a seed so it fits any screen width.
 *
 * Generation runs in three stages:
 *   1. Density map. Every cell gets a value in [0, 1]: a fall-off from the
 *      outer edge ("edge") or from the anchored corner ("corner"), blended
 *      with smooth value noise so the boundary is ragged rather than a
 *      clean gradient.
 *   2. Placement. Cells are walked from the outer edge inward and from the
 *      anchored edge outward. A cell is filled with probability = density,
 *      and the shape size follows the density: dense areas get 2x2 circles,
 *      medium areas get 2-cell capsules, sparse areas get single circles. An
 *      occupancy grid prevents overlap; a shape that does not fit shrinks to
 *      a circle.
 *   3. Render. Each shape is one SVG path, drawn twice: blurred for a glow,
 *      then crisp.
 *
 * Everything is derived from a hash of (seed, column from the outer edge,
 * row), so the pattern near the screen edge is identical at every viewport
 * width; only the inner tail changes as columns are added or removed.
 */

const CELL_SIZE = 20
const CELL_INSET = 2
const SVG_NS = 'http://www.w3.org/2000/svg'

/** Red, gold, and some blue: the left-hand mosaic. */
export const WARM_PALETTE = {
    colors: ['#f2737b', '#f8bf41', '#6395cf'],
    weights: [8, 4, 2],
}

/** Green and purple: the right-hand mosaic. */
export const COOL_PALETTE = {
    colors: ['#00b8aa', '#9970b1'],
    weights: [5, 2],
}

/* ---------- deterministic randomness ---------- */

/**
 * Hashes four integers to a float in [0, 1).
 * @returns {number}
 */
const hash = (a, b, c, d) => {
    let h =
        (a * 374761393 + b * 668265263 + c * 2246822519 + d * 3266489917) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
}

const smoothstep = (t) => t * t * (3 - 2 * t)

/**
 * Smooth value noise in [0, 1], sampled on a lattice `period` cells wide.
 * @returns {number}
 */
const valueNoise = (seed, col, row, period) => {
    const fx = col / period
    const fy = row / period
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = smoothstep(fx - x0)
    const ty = smoothstep(fy - y0)
    const n00 = hash(seed, x0, y0, 1)
    const n10 = hash(seed, x0 + 1, y0, 1)
    const n01 = hash(seed, x0, y0 + 1, 1)
    const n11 = hash(seed, x0 + 1, y0 + 1, 1)
    const top = n00 + (n10 - n00) * tx
    const bottom = n01 + (n11 - n01) * tx
    return top + (bottom - top) * ty
}

const pickColor = ({ colors, weights }, roll) => {
    const total = weights.reduce((sum, w) => sum + w, 0)
    let cumulative = 0
    for (let i = 0; i < colors.length; i++) {
        cumulative += weights[i] / total
        if (roll < cumulative) return colors[i]
    }
    return colors[colors.length - 1]
}

/* ---------- stage 1: density map ---------- */

/**
 * @returns {number[][]} densityMap[col][row], with col counted from the
 *     outer edge and row from the anchored edge.
 */
const buildDensityMap = (seed, cols, rows, falloff) => {
    const map = []
    for (let col = 0; col < cols; col++) {
        map[col] = []
        for (let row = 0; row < rows; row++) {
            // fall-off from the edge: 1 at the edge, 0 far inside
            const distance =
                falloff === 'corner' ? col / cols + row / rows : col / cols
            const base = Math.pow(
                Math.max(0, 1 - distance),
                falloff === 'corner' ? 1.6 : 1.2,
            )
            // two octaves of smooth noise, centered on 0
            const noise =
                (valueNoise(seed + 11, col, row, 4) - 0.5) * 0.5 +
                (valueNoise(seed + 23, col, row, 2) - 0.5) * 0.2
            map[col][row] = Math.min(
                1,
                Math.max(0, base + noise * base + noise * 0.25),
            )
        }
    }
    return map
}

/* ---------- stage 2: placement ---------- */

const placeShapes = (seed, cols, rows, densityMap, palette) => {
    const placed = []
    const occupied = new Set()
    const cellKey = (col, row) => `${col},${row}`
    const isFree = (col, row, spanCols, spanRows) => {
        if (col + spanCols > cols || row + spanRows > rows) return false
        for (let i = 0; i < spanCols; i++) {
            for (let j = 0; j < spanRows; j++) {
                if (occupied.has(cellKey(col + i, row + j))) return false
            }
        }
        return true
    }

    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            if (occupied.has(cellKey(col, row))) continue
            const density = densityMap[col][row]
            if (hash(seed, col, row, 2) >= density * 0.9) continue

            // shape size from density, with a little jitter so bands are
            // not hard lines
            const score = density + (hash(seed, col, row, 3) - 0.5) * 0.3
            let spanCols = 1
            let spanRows = 1
            if (score > 0.72) {
                spanCols = 2
                spanRows = 2
            } else if (score > 0.42) {
                if (hash(seed, col, row, 4) < 0.5) spanCols = 2
                else spanRows = 2
            }
            if (!isFree(col, row, spanCols, spanRows)) {
                // try the other capsule direction before giving up
                if (
                    spanCols === 2 &&
                    spanRows === 1 &&
                    isFree(col, row, 1, 2)
                ) {
                    spanCols = 1
                    spanRows = 2
                } else if (
                    spanRows === 2 &&
                    spanCols === 1 &&
                    isFree(col, row, 2, 1)
                ) {
                    spanCols = 2
                    spanRows = 1
                } else {
                    spanCols = 1
                    spanRows = 1
                }
            }
            for (let i = 0; i < spanCols; i++) {
                for (let j = 0; j < spanRows; j++) {
                    occupied.add(cellKey(col + i, row + j))
                }
            }
            placed.push({
                col,
                row,
                spanCols,
                spanRows,
                fill: pickColor(palette, hash(seed, col, row, 5)),
            })
        }
    }
    return placed
}

/* ---------- stage 3: geometry ---------- */

const circlePath = (cx, cy, r) =>
    `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 -${r * 2} 0z`

const capsulePath = (x, y, w, h) => {
    if (w >= h) {
        const r = h / 2
        return `M${x + r} ${y} h${w - 2 * r} a${r} ${r} 0 0 1 0 ${h} h-${w - 2 * r} a${r} ${r} 0 0 1 0 -${h}z`
    }
    const r = w / 2
    return `M${x} ${y + r} v${h - 2 * r} a${r} ${r} 0 0 0 ${w} 0 v-${h - 2 * r} a${r} ${r} 0 0 0 -${w} 0z`
}

/* ---------- the element ---------- */

const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, name)
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, String(value))
    }
    return element
}

/**
 * Creates one corner mosaic as an absolutely positioned SVG that redraws
 * itself when the window is resized. The parent bar must be
 * `position: relative`.
 * @param {object} options
 * @param {'left'|'right'} options.side Which corner.
 * @param {number} options.widthFraction Fraction of the viewport width the
 *     mosaic may take.
 * @param {number} options.minCols
 * @param {number} options.maxCols
 * @param {number} options.rows Rows of 20px cells.
 * @param {'edge'|'corner'} [options.falloff='edge'] "edge": density falls
 *     off horizontally only. "corner": from the anchored corner.
 * @param {'top'|'bottom'} [options.anchor='top'] Rows anchor to the top or
 *     bottom edge of the bar.
 * @param {{colors: string[], weights: number[]}} options.palette
 * @param {number} options.seed
 * @returns {SVGSVGElement}
 */
export const createMosaic = ({
    side,
    widthFraction,
    minCols,
    maxCols,
    rows,
    falloff = 'edge',
    anchor = 'top',
    palette,
    seed,
}) => {
    const svg = svgElement('svg', {
        class: 'mosaic',
        'aria-hidden': 'true',
        focusable: 'false',
    })
    svg.style[side] = '0'
    svg.style[anchor] = anchor === 'top' ? '-10px' : '0'

    const glowId = `mosaic-glow-${seed}`

    const render = () => {
        const cols = Math.max(
            minCols,
            Math.min(
                maxCols,
                Math.round((window.innerWidth * widthFraction) / CELL_SIZE),
            ),
        )
        const width = cols * CELL_SIZE
        const height = rows * CELL_SIZE

        const densityMap = buildDensityMap(seed, cols, rows, falloff)
        const placed = placeShapes(seed, cols, rows, densityMap, palette)

        // edge-relative cell -> pixel origin of that cell
        const cellOrigin = (col, row) => {
            const screenCol = side === 'left' ? col : cols - 1 - col
            const screenRow = anchor === 'bottom' ? rows - 1 - row : row
            return [screenCol * CELL_SIZE, screenRow * CELL_SIZE]
        }
        const shapes = placed.map((item) => {
            const [x1, y1] = cellOrigin(item.col, item.row)
            const [x2, y2] = cellOrigin(
                item.col + item.spanCols - 1,
                item.row + item.spanRows - 1,
            )
            const x = Math.min(x1, x2) + CELL_INSET
            const y = Math.min(y1, y2) + CELL_INSET
            const w = item.spanCols * CELL_SIZE - CELL_INSET * 2
            const h = item.spanRows * CELL_SIZE - CELL_INSET * 2
            const isCircle = item.spanCols === item.spanRows
            return {
                d: isCircle
                    ? circlePath(x + w / 2, y + h / 2, w / 2)
                    : capsulePath(x, y, w, h),
                fill: item.fill,
            }
        })

        svg.setAttribute('width', width)
        svg.setAttribute('height', height)
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

        const defs = svgElement('defs')
        const filter = svgElement('filter', {
            id: glowId,
            x: '-15%',
            y: '-15%',
            width: '130%',
            height: '130%',
        })
        filter.appendChild(svgElement('feGaussianBlur', { stdDeviation: 7 }))
        defs.appendChild(filter)

        const glow = svgElement('g', {
            filter: `url(#${glowId})`,
            opacity: 0.9,
        })
        const crisp = svgElement('g')
        for (const shape of shapes) {
            glow.appendChild(
                svgElement('path', { d: shape.d, fill: shape.fill }),
            )
            crisp.appendChild(
                svgElement('path', { d: shape.d, fill: shape.fill }),
            )
        }
        svg.replaceChildren(defs, glow, crisp)
    }

    render()

    let frame = 0
    window.addEventListener('resize', () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(render)
    })

    return svg
}
