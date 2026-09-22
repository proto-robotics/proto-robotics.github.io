/**
 * Font faces the editors measure text with. Blockly sizes every field from a
 * text measurement when it first renders, so the face has to be available
 * before the workspace is injected or the fallback font's narrower metrics
 * get baked into the block layout.
 */
const EDITOR_FONTS = ['10pt Montserrat', 'bold 10pt Montserrat']

let editorFontsPromise = null

/**
 * Resolves once the editor fonts are available for text measurement.
 *
 * document.fonts.ready alone is not enough: it resolves immediately when
 * nothing on the page has used the font yet, which is the case before the
 * page content is built. Requesting the faces explicitly starts the load.
 * Never rejects; if a font fails to load the editors fall back to the system
 * font and still work.
 * @returns {Promise<void>} Settles when the fonts are loaded or unavailable.
 */
export const whenEditorFontsReady = () => {
    if (!editorFontsPromise) {
        const fonts = document.fonts
        editorFontsPromise = fonts
            ? Promise.all(EDITOR_FONTS.map((font) => fonts.load(font)))
                  .then(() => fonts.ready)
                  .then(() => undefined)
                  .catch(() => undefined)
            : Promise.resolve()
    }

    return editorFontsPromise
}
