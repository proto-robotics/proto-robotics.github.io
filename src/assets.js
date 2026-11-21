/*
 * Single source of truth for the URLs of the files in ./assets. Every path is
 * resolved against the bundle's own URL (the build copies assets/ next to
 * it), so the app keeps working served from the site root, from a
 * subdirectory, or as a library inside another site.
 */

/**
 * Resolves a path inside the assets folder into an absolute URL.
 * @param {string} path Path relative to the assets folder.
 * @returns {string} The absolute URL of the asset.
 */
/* global __webpack_public_path__ */
// Webpack's public path: the folder the bundle was loaded from, worked out
// at run time (publicPath 'auto'). Not import.meta.url, which webpack
// rewrites in source files to the file's own path.
const bundleDir =
    typeof __webpack_public_path__ === 'string' && __webpack_public_path__
        ? __webpack_public_path__
        : document.baseURI

export const asset = (path) => new URL(`assets/${path}`, bundleDir).href

/**
 * Resolves a path next to the bundle (Blockly's media folder, copied there
 * by the build).
 * @param {string} path Path relative to the bundle's folder.
 * @returns {string} The absolute URL.
 */
export const bundleUrl = (path) => new URL(path, bundleDir).href

/** The PROTO logo shown in the navbars. */
export const protoLogo = asset('images/proto-logo.svg')

/** Close icon used by the popup dialogs. */
export const cancelIcon = asset('images/cancel.svg')

/** Info icon used by the cheatsheet help control on every block. */
export const helpIcon = asset('images/help.svg')

/** Multi-select mode icons (workspace-multiselect plugin), on and off. */
export const multiselectOnIcon = asset('images/multiselect-on.svg')
export const multiselectOffIcon = asset('images/multiselect-off.svg')

/** Each kind of device's picture: a cartoon render of the real parts. */
const deviceIcons = {
    drive_motor: 'images/devices/drive-motor-cartoon.png',
    drivetrain: 'images/devices/drivetrain-cartoon.png',
    // a variable has no part to picture: its category's icon
    variable: 'images/category-icons/variables.svg',
}

/**
 * The picture for a kind of device, in the Devices pop-up.
 * @param {string} kind A key of deviceKinds.
 * @returns {string|null} The picture's URL, or null when there is none.
 */
export const deviceIcon = (kind) =>
    deviceIcons[kind] ? asset(deviceIcons[kind]) : null

/** The toolbox categories that have an icon in images/category-icons. */
const categoryIconNames = new Set([
    'board',
    'devices',
    'drivetrain',
    'flow',
    'input',
    'motor',
    'operators',
    'search',
    'time',
    'variables',
])

/**
 * The icon for a toolbox category: a coloured bubble with a glyph, drawn
 * in the toolbox column in place of the plain colour dot.
 * @param {string} name The category's name, as in the toolbox.
 * @returns {string|null} The icon's URL, or null when there is none.
 */
export const categoryIcon = (name) => {
    const key = String(name).trim().toLowerCase()
    return categoryIconNames.has(key)
        ? asset(`images/category-icons/${key}.svg`)
        : null
}
