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
export const protoLogo = asset('images/proto-logo.png')

/** Close icon used by the popup dialogs. */
export const cancelIcon = asset('images/cancel.svg')

/** Info icon used by the cheatsheet help control on every block. */
export const helpIcon = asset('images/help.svg')
