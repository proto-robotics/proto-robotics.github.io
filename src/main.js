import '../styles.css'
import { processJengaTower } from '@protorobotics/jenga'
import { pythonGenerator } from 'blockly/python'

import { jengaBlocks } from './data/library'
import BuildPageContent from './builders/BuildPageContent'
import BuildCheatSheet from './builders/BuildCheatSheet'
import BuildEmbedContent from './builders/BuildEmbedContent'
import { whenEditorFontsReady } from './helpers/fontHelper'
import {
    filterToolbox,
    readEditorParams,
} from './helpers/editorParamsHelper'

/**
 * Builds the coding page, the full cheatsheet (`?cheatsheet`), or the bare
 * editor for embedding in another site (`?embed`), based on the URL query.
 */
const main = async () => {
    // Blockly measures text as soon as a workspace is injected, so the font
    // must be loaded before any editor is built.
    await whenEditorFontsReady()

    const params = new URLSearchParams(window.location.search)
    const editorParams = readEditorParams(params)

    const { toolbox: fullToolbox } = processJengaTower(
        jengaBlocks,
        pythonGenerator,
    )
    const toolbox = filterToolbox(fullToolbox, editorParams)

    const PageContent = params.has('cheatsheet')
        ? BuildCheatSheet()
        : params.has('embed')
          ? BuildEmbedContent(toolbox, editorParams)
          : BuildPageContent(toolbox, editorParams)

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
