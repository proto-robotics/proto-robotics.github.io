import '../styles.css'
import { processJengaTower } from '@protorobotics/jenga'
import { pythonGenerator } from 'blockly/python'

import { jengaBlocks } from './data/library'
import BuildPageContent from './builders/BuildPageContent'
import BuildCheatSheet from './builders/BuildCheatSheet'
import { whenEditorFontsReady } from './helpers/fontHelper'

/** Builds either the coding page or full cheatsheet based on the URL query. */
const main = async () => {
    // Blockly measures text as soon as a workspace is injected, so the font
    // must be loaded before any editor is built.
    await whenEditorFontsReady()

    const { toolbox } = processJengaTower(jengaBlocks, pythonGenerator)

    const params = new URLSearchParams(window.location.search)

    const PageContent = params.has('cheatsheet')
        ? BuildCheatSheet()
        : BuildPageContent(toolbox)

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
