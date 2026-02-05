import {
    inject
} from 'blockly'
import { pythonGenerator } from 'blockly/python'
import {div, tag, hr} from 'ellipsi'
import blocks from '../data/blocks'

function getCodeFromBlock(workspace, generator, name) {
    const block = workspace.newBlock(name);
    block.initSvg();
    block.render();
    const py = generator.blockToCode(block);
    block.dispose;
    return py;
}

function createEntry(workspace, entry) {
    const entryDiv = div();
    entryDiv.appendChild(tag("small", `${getCodeFromBlock(workspace, pythonGenerator, entry.name)} → ${entry.description}`));
    return entryDiv; 
}

function createCodeDiv(block, workspace) {
    const codeDiv = div();
    codeDiv.style.width = "50%";
    codeDiv.style.padding = "10px";
    for (let j = 0; j < block.entries.length; j++) {
        codeDiv.appendChild(createEntry(workspace, block.entries[j]));
        codeDiv.appendChild(tag("br"));
    }
    return codeDiv;
}

function createExamplesDiv() {
    const examplesDiv = div();
    examplesDiv.style.width = "50%";
    examplesDiv.style.padding = "10px";
    examplesDiv.style.borderLeft = "dashed 1px";
    examplesDiv.appendChild(tag("small", "Im div'in here!"));
    return examplesDiv;
}

function createSection(workspace, block) {
    const sectionDiv = div();
    const sectionHeader = tag("h2", `${block.name}`);
    sectionHeader.style.borderBottom = "dashed 1px";
    sectionHeader.style.textAlign = "center";
    sectionDiv.append(sectionHeader);
    const contentHolder = div();
    contentHolder.style.display = "flex"; 
    contentHolder.appendChild(createCodeDiv(block, workspace));
    contentHolder.appendChild(createExamplesDiv(block, workspace));
    sectionDiv.appendChild(contentHolder);
    sectionDiv.appendChild(hr());
    return sectionDiv;
}


export default function (toolbox) {    
    const BlocklyCanvas = div({ id: 'block-canvas' });
    BlocklyCanvas.style.display = "none";
    const workspace = inject(BlocklyCanvas, {
            toolbox: toolbox,
    })
    pythonGenerator.init(workspace);
    const mainDiv = div();
    for (let i=0; i<blocks.length; i++) {
        mainDiv.append(createSection(workspace, blocks[i]));
    }
   return [mainDiv];
}
