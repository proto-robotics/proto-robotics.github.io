import { processJengaTower } from '@protorobotics/jenga'
import { pythonGenerator } from 'blockly/python'
import Prism from 'prismjs'

import blocks from './blocks'
import BuildPageContent from './BuildPageContent'
import BuildCheatSheet from './BuildCheatSheet'

const main = () => {
    Prism.manual = true

    const { toolbox, vocab } = processJengaTower(blocks, pythonGenerator)

    const params = new URLSearchParams(window.location.search)

    let PageContent

    if (params.has("cheatsheet")) {
        PageContent = BuildCheatSheet(toolbox, vocab)
    } else {
        PageContent = BuildPageContent(toolbox, vocab)
    }

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
