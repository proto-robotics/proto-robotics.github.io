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

/**
 * A category icon in images/category-icons: a coloured bubble with a
 * glyph, drawn in the toolbox column in place of the plain colour dot. A
 * library names its categories' icons with this (src/libraries/core.js);
 * the editor uses it for its own tabs (Search) and the Devices button.
 * @param {string} name The icon's file name, without .svg.
 * @returns {string} Its URL.
 */
export const categoryIcon = (name) => asset(`images/category-icons/${name}.svg`)
