import { processJengaTower } from "@protorobotics/jenga"
import { pythonGenerator } from "blockly/python"
import Prism from "prismjs"
import { marked } from "marked"

import blocks from "./blocks"
import BuildPageContent from "./BuildPageContent"

let customTooltip

const main = () => {
    Prism.manual = true

    const { toolbox, vocab } = processJengaTower(blocks, pythonGenerator)

    const PageContent = BuildPageContent(toolbox, vocab)

    document.body.replaceChildren(...PageContent)

    customTooltip = document.querySelector("custom-tooltip")
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main)
} else {
    main()
}

//TODO move these to a utils lib or something maybe
export {showTooltip, moveTooltip, hideTooltip}

function showTooltip(pos, text) {
  customTooltip.innerHTML = marked.parse(text)
  customTooltip.style.display = 'block';
  moveTooltip(pos);
}

function moveTooltip(pos) {
    customTooltip.style.left = pos.x + 10 + 'px';
    customTooltip.style.top = pos.y + 10 + 'px';
}

function hideTooltip() {
    customTooltip.style.display = 'none';
}
