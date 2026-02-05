import {
    inject
} from 'blockly'
import { pythonGenerator } from 'blockly/python'
import {div, tag, hr} from 'ellipsi'
import blocks from '../data/blocks'

function getCodeFromBlock(workspace, generator, name) {
    const block = workspace.newBlock(name)
    block.initSvg()
    block.render()
    const py = generator.blockToCode(block)
    block.dispose
    return py
}

function createEntry(workspace, entry) {
    const entryDiv = div();
    entryDiv.appendChild(tag("p", `${getCodeFromBlock(workspace, pythonGenerator, entry.name)}`));
    entryDiv.appendChild(tag("h4", `${entry.description}`));
    entryDiv.appendChild(hr());
    return entryDiv; 
}

function createSection(workspace, block) {
    const sectionDiv = div();
    sectionDiv.append(tag("h2", `${block.name}`));
    for (let j=0; j<block.entries.length; j++) {
        sectionDiv.appendChild(createEntry(workspace, block.entries[j]));
    }
    return sectionDiv;
}

export default function (toolbox) {    
    const mainDiv = div()
    const BlocklyCanvas = div({ id: 'block-canvas' })
    BlocklyCanvas.style.display = "none"
    const workspace = inject(BlocklyCanvas, {
            toolbox: toolbox,
    })
    pythonGenerator.init(workspace);
    console.log(blocks);
    // TODO: Refactor this into multiple functions,
    // Remember to npx webpack before reloading
    /* python -m http.server -> http://localhost:8000/?cheatsheet*/
    for (let i=0; i<blocks.length; i++) {
        mainDiv.append(createSection(workspace, blocks[i]));
    }
   return [mainDiv];
}
