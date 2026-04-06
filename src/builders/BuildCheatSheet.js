import { inject } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { div, tag, hr, a, header, img } from 'ellipsi'
import blocks from '../data/blocks'
import { newView, setViewText } from '../helpers/codeMirrorHelper'

function createCodeFormatter(blockObject) {
    let pythonCode = pythonGenerator.blockToCode(blockObject)
    if (Array.isArray(pythonCode)) {
        pythonCode = pythonCode[0]
    }
    pythonCode = pythonCode.trimEnd()
    const codeFormatter = newView({ readonly: true, noGutter: true })
    codeFormatter.scrollDOM.style.height = "auto";
    codeFormatter.scrollDOM.style.overflow = "visible";
    codeFormatter.dom.style.height = "auto";
    setViewText(codeFormatter, pythonCode)
    // TODO: make break when we hit the end of the div
    // const formattedCodeDom = codeFormatter.dom;
    // formattedCodeDom.style.overflow = "hidden";
    // formattedCodeDom.style.height = "auto";
    // if (codeFormatter.scrollDOM) {
    //     codeFormatter.scrollDOM.style.overflow = "hidden";
    //     codeFormatter.scrollDOM.style.height = "auto";
    // }
    return codeFormatter
}


function createBlockDefinition(workspace, block) {
    const blockObject = workspace.newBlock(block.name)
    blockObject.initSvg()
    blockObject.render()
    const codeFormatter = createCodeFormatter(blockObject)
    const entryDiv = div()
    entryDiv.appendChild(tag('p', `${block.description}`))
    entryDiv.appendChild(codeFormatter.dom)
    return entryDiv
}

function createCodeSection(section, workspace) {
    const codeDiv = div()
    codeDiv.style.width = '50%'
    codeDiv.style.padding = '10px'
    for (const block of section.entries) {
        codeDiv.appendChild(createBlockDefinition(workspace, block))
        codeDiv.appendChild(tag('br'))
    }
    return codeDiv
}

function createExample(example, workspace) {
    let firstBlock = null;
    let previousBlock = null;
    for (const block of example.blocks) {
        const blockObject = workspace.newBlock(block.type);
        blockObject.initSvg();

        if (block.fields) {
            for (const [key, value] of Object.entries(block.fields)) {
                blockObject.setFieldValue(value, key);
            }
        }
        blockObject.render();

        if (!firstBlock) {
            firstBlock = blockObject;
        } else if (previousBlock && previousBlock.nextConnection && blockObject.previousConnection){
            previousBlock.nextConnection.connect(blockObject.previousConnection);
        }
        previousBlock = blockObject;
    }
    const codeFormatter = createCodeFormatter(firstBlock);
    const exampleDiv = div()
    exampleDiv.appendChild(tag('p', `${example.preamble}`))
    exampleDiv.appendChild(codeFormatter.dom)
    return exampleDiv
}

function createExampleSection(section, workspace) {
    const examplesDiv = div()
    examplesDiv.style.width = '50%'
    examplesDiv.style.padding = '10px'
    examplesDiv.style.borderLeft = 'solid 1px'
    if (section.examples !== undefined) {
        for (let i = 0; i < section.examples.length; i++) {
            examplesDiv.appendChild(createExample(section.examples[i], workspace))
            examplesDiv.appendChild(tag('br'))
        }
    }
    return examplesDiv
}

function createSection(workspace, section) {
    const sectionDiv = div()
    const sectionHeader = tag('h2', `${section.name}`)
    sectionHeader.style.borderBottom = 'solid 1px'
    sectionHeader.style.textAlign = 'center'
    sectionDiv.append(sectionHeader)
    const contentHolder = div()
    contentHolder.style.display = 'flex'
    contentHolder.appendChild(createCodeSection(section, workspace))
    contentHolder.appendChild(createExampleSection(section, workspace))
    sectionDiv.appendChild(contentHolder)
    sectionDiv.appendChild(hr())
    return sectionDiv
}

export default function (toolbox) {
    const BlocklyCanvas = div({ id: 'block-canvas' })
    BlocklyCanvas.style.display = 'none'
    const workspace = inject(BlocklyCanvas, {
        toolbox: toolbox,
    })
    pythonGenerator.init(workspace)
    const mainDiv = div()
    for (const section of blocks) {
        mainDiv.append(createSection(workspace, section))
    }
    const Navbar = tag(
            'nav',
            a(
                { href: 'https://protorobotics.org' },
                img({
                    src: '/images/proto-logo.png',
                    alt: 'The PROTO logo',
                    height: '32',
                }),
            ),
            a({ href: 'https://protorobotics.org' }, 'Home')
        )
    const page = div()
    page.appendChild(header(Navbar))
    page.appendChild(mainDiv)
    return [page]
}
