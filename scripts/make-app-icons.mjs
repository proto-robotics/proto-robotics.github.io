/*
 * Makes the source images for the app's icons and splash screen from the
 * app icon, assets/images/app-icon.svg, into resources/ for
 * @capacitor/assets (which rasterises SVG itself):
 *
 *     npm run app:icons
 *
 * The icon is a red pattern with the white P glyph on it. Android's
 * adaptive icons want that in two layers, the pattern as the background
 * and the glyph as the foreground (the launcher masks the outer third, so
 * the glyph is drawn a little smaller to stay inside); the splash screen
 * is the icon as a rounded tile on white. Run again after changing the
 * icon.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'assets/images/app-icon.svg'), 'utf8')
const out = join(root, 'resources')

/** The icon's parts: the glyph group, and everything behind it. */
const glyphMatch = source.match(/<g fill="none" stroke="#FFFFFF"[\s\S]*?<\/g>/)
if (!glyphMatch) {
    throw new Error('app-icon.svg: the white glyph group was not found')
}
const glyph = glyphMatch[0]
const background = source.replace(glyph, '')

/**
 * Wraps the icon's drawing in a square SVG of its own.
 * @param {string} body The drawing, in the icon's 100 by 100 units.
 * @returns {string} The SVG file.
 */
const square = (body) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" ' +
    `viewBox="0 0 100 100">${body}</svg>\n`

/** The defs (pattern and clip) from the source, needed by the background. */
const defs = source.match(/<defs>[\s\S]*?<\/defs>/)[0]
const backgroundBody = background.match(/<g clip-path[\s\S]*<\/g>\s*(?=<\/svg>)/)[0]

const files = {
    'icon-only.svg': source,
    'icon-background.svg': square(defs + backgroundBody),
    'icon-foreground.svg': square(
        `<g transform="translate(50 50) scale(0.88) translate(-50 -50)">${glyph}</g>`,
    ),
}

// the splash: the icon as a rounded tile, 30% of the shorter side, on white
const splash =
    '<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" ' +
    'viewBox="0 0 2732 2732">' +
    '<rect width="2732" height="2732" fill="#ffffff"/>' +
    '<svg x="956" y="956" width="820" height="820" viewBox="0 0 100 100">' +
    source
        .replace(/<svg[^>]*>/, '')
        .replace('</svg>', '')
        .replace('<rect width="100" height="100" rx="0">', '<rect width="100" height="100" rx="18">') +
    '</svg></svg>\n'
files['splash.svg'] = splash
files['splash-dark.svg'] = splash

mkdirSync(out, { recursive: true })
for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(out, name), text)
}
console.log('wrote', Object.keys(files).join(', '))
