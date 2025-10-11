/**
 * @callback SaveCodeProcedure
 * Saves the current code state to a zip file named after the project.
 * @param {HTMLInputElement} ProjectNameInput HTML input element containing the name of the
 * saved project.
 */

/**
 * @callback LoadCodeProcedure
 * Loads a code state from a file stored on disk.
 * @param {HTMLInputElement} ProjectNameInput HTML input element which will contain the name of
 * the loaded project.
 */

/**
 * An editor mode.
 */
export class EditorMode {
    /**
     * @param {string} name The name of the editor mode.
     * @param {HTMLElement} EditorElement The element comprising the visual element of the editor.
     * @param {SaveCodeProcedure} saveCode Saves the editors code to the user's computer
     * @param {LoadCodeProcedure} loadCode Prompts the user to upload code from their computer.
     */
    constructor(name, EditorElement, saveCode, loadCode) {
        this.name = name
        this.EditorElement = EditorElement
        this.saveCode = saveCode
        this.loadCode = loadCode
    }
}
