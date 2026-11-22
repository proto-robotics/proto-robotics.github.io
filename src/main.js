import '../styles.css'

import { core } from './libraries/core'
import { make } from './libraries/make'
import { setBlockSet, splice, toolboxOf, usesDevices } from './libraries/engine'
import BuildPageContent from './builders/BuildPageContent'
import BuildCheatSheet from './builders/BuildCheatSheet'
import BuildEmbedContent from './builders/BuildEmbedContent'
import { whenEditorFontsReady } from './helpers/fontHelper'
import { readEditorParams } from './helpers/editorParamsHelper'

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

    // the IDE's own blocks, the real robot's: the same libraries a host
    // site gives the library build (src/lib.js)
    const set = splice([core, make])
    setBlockSet(set)
    const toolbox = toolboxOf(set, {
        toolbox: editorParams.categories ?? undefined,
        blocks: editorParams.blocks ?? undefined,
    })

    // the iframe page gets what the library build gives a host: Devices
    // when its toolbox has device blocks, and the block set's types
    const narrow = {
        toolbox: editorParams.categories ?? undefined,
        blocks: editorParams.blocks ?? undefined,
    }
    const PageContent = params.has('cheatsheet')
        ? BuildCheatSheet()
        : params.has('embed')
          ? await BuildEmbedContent(toolbox, {
                ...editorParams,
                devices: !editorParams.view && usesDevices(set, narrow),
                blockTypes: set.blockTypes,
            })
          : BuildPageContent(toolbox, editorParams)

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
