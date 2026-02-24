import {
    addChangeListener,
    draw as drawBlocklyCanvas,
    getCode as getBlocklyCode,
    getState as getBlocklyState,
    isDragging as isBlocklyDragging,
    newView as newBlocklyView,
    setState as setBlocklyState,
    setViewParentContainer,
} from './helpers/blocklyHelper'

const toolbox = {
    kind: 'flyoutToolbox',
    contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'text' },
    ],
}

const app = document.getElementById('app')
const blockWrap = document.createElement('div')
blockWrap.id = 'block-test-wrap'
blockWrap.style.width = '100%'
blockWrap.style.height = '60vh'
blockWrap.style.minHeight = '380px'
blockWrap.style.border = '1px solid #ccc'
blockWrap.style.background = '#fff'

const blockCanvas = newBlocklyView(toolbox)
blockCanvas.style.width = '100%'
blockCanvas.style.height = '100%'
blockWrap.appendChild(blockCanvas)
app.appendChild(blockWrap)

setViewParentContainer(blockCanvas, blockWrap)

const controls = document.createElement('div')
controls.style.display = 'flex'
controls.style.gap = '8px'
controls.style.flexWrap = 'wrap'
controls.style.margin = '12px 0'

const status = document.createElement('pre')
status.style.background = '#f5f5f5'
status.style.padding = '12px'
status.style.border = '1px solid #ddd'
status.style.whiteSpace = 'pre-wrap'
status.style.wordBreak = 'break-word'

const codeOut = document.createElement('pre')
codeOut.style.background = '#111'
codeOut.style.color = '#eaeaea'
codeOut.style.padding = '12px'
codeOut.style.border = '1px solid #333'
codeOut.style.whiteSpace = 'pre-wrap'
codeOut.textContent = 'Generated Python will appear here.'

let savedState = null

const updateOutputs = () => {
    const state = getBlocklyState(blockCanvas)
    const code = getBlocklyCode(blockCanvas)
    status.textContent = [
        `dragging: ${isBlocklyDragging(blockCanvas)}`,
        `topBlocks: ${state?.blocks?.blocks?.length ?? 0}`,
        `stateBytes: ${JSON.stringify(state).length}`,
    ].join('\n')
    codeOut.textContent = `import make\n\n${code}`
}

const makeButton = (label, onClick) => {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
}

controls.appendChild(
    makeButton('Save State Snapshot', () => {
        savedState = getBlocklyState(blockCanvas)
        updateOutputs()
    }),
)

controls.appendChild(
    makeButton('Reload Snapshot', () => {
        if (savedState) {
            setBlocklyState(blockCanvas, savedState)
            updateOutputs()
        }
    }),
)

controls.appendChild(
    makeButton('Dump Code', () => {
        updateOutputs()
    }),
)

app.appendChild(controls)
app.appendChild(status)
app.appendChild(codeOut)

addChangeListener(blockCanvas, (event) => {
    if (!event || isBlocklyDragging(blockCanvas)) {
        return
    }
    updateOutputs()
})

const resizeObserver = new ResizeObserver(() => {
    drawBlocklyCanvas(blockCanvas)
})
resizeObserver.observe(blockWrap)

drawBlocklyCanvas(blockCanvas)
updateOutputs()
