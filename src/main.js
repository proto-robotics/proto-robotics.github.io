import { processJengaTower } from '@protorobotics/jenga'
import { pythonGenerator } from 'blockly/python'

import blocks from './data/blocks'
import BuildPageContent from './builders/BuildPageContent'
import BuildCheatSheet from './builders/BuildCheatSheet'

const main = () => {
    const { toolbox, vocab } = processJengaTower(blocks, pythonGenerator)

    const params = new URLSearchParams(window.location.search)

    const PageContent = params.has('cheatsheet')
        ? BuildCheatSheet(toolbox, vocab)
        : BuildPageContent(toolbox, vocab)

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
