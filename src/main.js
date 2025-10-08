import { process } from "@protorobotics/jenga"
import { pythonGenerator } from "blockly/python"
import Prism from "prismjs"

import { blockDefinitions } from "./blocks"

const main = () => {
  // Don't automatically highlight code
  Prism.manual = true

  const { toolbox } = process(blockDefinitions, pythonGenerator)
  console.debug(toolbox)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main)
} else {
  main()
}
