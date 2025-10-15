import { Events, inject, svgResize } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { code, div, pre, tag } from 'ellipsi'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-python'

import {claimTooltip, releaseTooltip} from './tooltipHelper'

import blocks from "./blocks"

export default (toolbox) => {
    const BlocklyCanvas = div()
    const CodePreview = code()

    const workspace = inject(BlocklyCanvas, {
        toolbox: toolbox,
    })

    const supportedEvents = new Set([
        Events.BLOCK_CHANGE,
        Events.BLOCK_CREATE,
        Events.BLOCK_DELETE,
        Events.BLOCK_MOVE,
    ])

    workspace.addChangeListener((event) => {
        if (workspace.isDragging() || !supportedEvents.has(event.type)) {
            return
        }

        const code = pythonGenerator.workspaceToCode(workspace)
        CodePreview.innerHTML = highlight(
            'import make\n\n' + code,
            languages.python,
            'python',
        )
    })

    let blockDescriptionDictionary = getBlockDescriptionDictionary(blocks)
    let hoverTimer = null;
    let currentHoveredBlock = null;

    function attachCustomTooltipHandlers(workspace) {
      workspace.addChangeListener(() => {
        for (const block of workspace.getAllBlocks(false)) {
          const svgRoot = block.getSvgRoot();
          if (svgRoot.customTooltipAttached) continue;
          svgRoot.customTooltipAttached = true;

          svgRoot.addEventListener('mouseenter', (e) => {
            currentHoveredBlock = block;
            hoverTimer = setTimeout(() => {
              if (currentHoveredBlock === block) {
                claimTooltip("Block",{x: e.pageX, y: e.pageY}, blockDescriptionDictionary[block.type]);
              }
            }, 1000);
          });

          svgRoot.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimer);
            currentHoveredBlock = null;
            releaseTooltip("Block");
          });
        }
      });
    }

    attachCustomTooltipHandlers(workspace)

    window.addEventListener('load', () => {
      svgResize(workspace);
    });

    const BlockEditor = tag('block-editor',
        BlocklyCanvas,
        pre(CodePreview),
    )

    return BlockEditor
}

function getBlockDescriptionDictionary(categories) {
  const dictionary = {}
  for (const category of categories) {
    for (const entry of category.entries) {
      dictionary[entry.name] = entry.description
    }
  }
  return dictionary
}
