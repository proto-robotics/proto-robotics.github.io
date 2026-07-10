import { processJengaTower } from '@protorobotics/jenga'
import { pythonGenerator } from 'blockly/python'

import { jengaBlocks } from './data/library'
import BuildPageContent from './builders/BuildPageContent'
import BuildCheatSheet from './builders/BuildCheatSheet'

const main = () => {
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
