/**
 * @typedef {{name: string, text: string}} ProjectFile
 * A file of the learner's project: `main.py`, and for the block editor the
 * blocks file beside it.
 */

/**
 * @callback SaveCodeProcedure
 * Downloads the project as a zip named after the project.
 * @param {HTMLInputElement} ProjectNameInput The project-name field.
 */

/**
 * @callback LoadCodeProcedure
 * Asks for a project file from the learner's computer and loads it.
 * @param {HTMLInputElement} ProjectNameInput The project-name field, which
 *     takes the loaded file's name.
 */

/**
 * @callback SaveStateProcedure
 * Saves the editor's state to local storage (when the mode persists) and
 * tells the host page, if any, about the change.
 */

/**
 * @callback LoadStateProcedure
 * Restores the editor's state, from local storage unless one is given.
 * @param {object|string|null} [state] A state to restore instead.
 */

/**
 * @callback GetProjectFilesProcedure
 * The project's files, as saved in the zip and sent to the brain.
 * @param {string} projectName Names the files that carry the project name.
 * @returns {ProjectFile[]} The files.
 */

/**
 * @callback SetStateProcedure
 * Replaces the editor's content. Used by the embedding page.
 * @param {object|string|null} state The new state, or null to clear.
 */

/**
 * One of the two editors, the block editor or the line editor, as the page
 * sees it: its element and the operations the toolbar needs.
 */
export class EditorMode {
    /**
     * @param {object} options
     * @param {string} options.name The mode's name, as kept in local storage.
     * @param {HTMLElement} options.EditorElement The editor's element.
     * @param {SaveCodeProcedure} options.saveCode
     * @param {LoadCodeProcedure} options.loadCode
     * @param {SaveStateProcedure} options.saveState
     * @param {LoadStateProcedure} options.loadState
     * @param {GetProjectFilesProcedure} options.getProjectFiles
     * @param {SetStateProcedure} options.setState
     */
    constructor({
        name,
        EditorElement,
        saveCode,
        loadCode,
        saveState,
        loadState,
        getProjectFiles,
        setState,
    }) {
        this.name = name
        this.EditorElement = EditorElement
        this.saveCode = saveCode
        this.loadCode = loadCode
        this.saveState = saveState
        this.loadState = loadState
        this.getProjectFiles = getProjectFiles
        this.setState = setState
    }
}
