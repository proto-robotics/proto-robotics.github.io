/**
 * @callback Procedure
 * Takes no arguments, returns nothing.
 */

/**
 * An editor mode.
 */
export class EditMode {
    /**
     * @param {HTMLElement} EditorElement The element comprising the visual element of the editor.
     * @param {Procedure} saveCode Saves the editors code to the user's computer
     * @param {Procedure} loadCode Prompts the user to upload code from their computer.
     */
    constructor(EditorElement, saveCode, loadCode) {
        this.EditorElement = EditorElement
        this.saveCode = saveCode
        this.loadCode = loadCode
    }
}
