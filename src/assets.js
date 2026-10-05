/*
 * Single source of truth for the URLs of the files in ./assets. Every path is
 * resolved against the document base so the app keeps working whether it is
 * served from the site root or from a subdirectory.
 */

/**
 * Resolves a path inside the assets folder into an absolute URL.
 * @param {string} path Path relative to the assets folder.
 * @returns {string} The absolute URL of the asset.
 */
export const asset = (path) => new URL(`assets/${path}`, document.baseURI).href

/** The PROTO logo shown in the navbars. */
export const protoLogo = asset('images/proto-logo.svg')

/** Close icon used by the popup dialogs. */
export const cancelIcon = asset('images/cancel.svg')

/** Info icon used by the cheatsheet help control on every block. */
export const helpIcon = asset('images/help.svg')

/** Multi-select mode icons (workspace-multiselect plugin), on and off. */
export const multiselectOnIcon = asset('images/multiselect-on.svg')
export const multiselectOffIcon = asset('images/multiselect-off.svg')

/** The toolbox categories that have an icon in images/category-icons. */
const categoryIconNames = new Set([
    'devices',
    'drivetrain',
    'flow',
    'input',
    'motor',
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
