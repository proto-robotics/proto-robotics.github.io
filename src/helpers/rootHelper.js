/*
 * The element that stands in for the page: the body on the IDE's own pages,
 * or the editor's root element when the editor is mounted inside another
 * site as a library (src/lib.js). Dialogs are appended to it and the layout
 * classes (embed, phone-layout, task-closed) go on it, so the stylesheet
 * works the same either way.
 */

/** @type {HTMLElement|null} */
let root = null

/**
 * Makes an element the root for everything built after this call.
 * @param {HTMLElement|null} element The root, or null for the body.
 */
export const setRoot = (element) => {
    root = element
}

/** @returns {HTMLElement} The current root: the body unless one was set. */
export const getRoot = () => root ?? document.body
