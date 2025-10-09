import { processJengaTower } from "@protorobotics/jenga"
import { pythonGenerator } from "blockly/python"
import Prism from "prismjs"

import blocks from "./blocks"
import BuildPageContent from "./BuildPageContent"

const main = () => {
    // Don't automatically highlight code
    Prism.manual = true

    const { toolbox, vocab } = processJengaTower(blocks, pythonGenerator)

    const PageContent = BuildPageContent(toolbox, vocab)

    document.body.replaceChildren(...PageContent)
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main)
} else {
    main()
}
