/**
 * @callback SaveCodeProcedure
 * Takes no arguments, returns nothing.
 */

/**
 * @callback LoadCodeProcedure
 * Takes no arguments, returns nothing.
 */

/**
 * An editor mode.
 */
export class EditorMode {
    /**
     * @param {HTMLElement} EditorElement The element comprising the visual element of the editor.
     * @param {SaveCodeProcedure} saveCode Saves the editors code to the user's computer
     * @param {LoadCodeProcedure} loadCode Prompts the user to upload code from their computer.
     */
    constructor(EditorElement, saveCode, loadCode) {
        this.EditorElement = EditorElement
        this.saveCode = saveCode
        this.loadCode = loadCode
    }
}
