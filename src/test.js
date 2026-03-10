import {
    addChangeListener,
    destroyBlocklyInstance,
    getCode as getBlocklyCode,
    getState as getBlocklyState,
    mountBlocklyInstance,
    newBlocklyInstance,
    setState as setBlocklyState,
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

const heading = document.createElement('h2')
heading.textContent = 'Editable Blockly View'
heading.style.margin = '8px 0'
heading.style.fontSize = '16px'
app.appendChild(heading)

const blockWrap = document.createElement('div')
blockWrap.id = 'block-test-wrap'
blockWrap.style.width = '100%'
blockWrap.style.height = '60vh'
blockWrap.style.minHeight = '380px'
blockWrap.style.border = '1px solid #ccc'
blockWrap.style.background = '#fff'

const editableBlocklyInstance = newBlocklyInstance(toolbox)
editableBlocklyInstance.canvas.style.width = '100%'
editableBlocklyInstance.canvas.style.height = '100%'
blockWrap.appendChild(editableBlocklyInstance.canvas)
app.appendChild(blockWrap)

mountBlocklyInstance(editableBlocklyInstance, blockWrap, {
    resizeImmediately: true,
})

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

const stateOut = document.createElement('pre')
stateOut.style.background = '#f8f8f8'
stateOut.style.color = '#222'
stateOut.style.padding = '12px'
stateOut.style.border = '1px solid #ddd'
stateOut.style.whiteSpace = 'pre-wrap'
stateOut.style.wordBreak = 'break-word'
stateOut.style.maxHeight = '320px'
stateOut.style.overflow = 'auto'
stateOut.textContent = 'Serialized Blockly state will appear here.'

let savedState = null

const updateOutputs = () => {
    const state = getBlocklyState(editableBlocklyInstance)
    const code = getBlocklyCode(editableBlocklyInstance)
    status.textContent = [
        `dragging: ${editableBlocklyInstance.workspace.isDragging()}`,
        `topBlocks: ${state?.blocks?.blocks?.length ?? 0}`,
        `stateBytes: ${JSON.stringify(state).length}`,
    ].join('\n')
    codeOut.textContent = `import make\n\n${code}`
    stateOut.textContent = JSON.stringify(state, null, 2)
}

const makeButton = (label, onClick) => {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
}

controls.appendChild(
    makeButton('Save State Snapshot', () => {
        savedState = getBlocklyState(editableBlocklyInstance)
        updateOutputs()
    }),
)

controls.appendChild(
    makeButton('Reload Snapshot', () => {
        if (savedState) {
            setBlocklyState(editableBlocklyInstance, savedState)
            updateOutputs()
        }
    }),
)

controls.appendChild(
    makeButton('Dump Code', () => {
        updateOutputs()
    }),
)

controls.appendChild(
    makeButton('Show State JSON', () => {
        updateOutputs()
    }),
)

app.appendChild(controls)
app.appendChild(status)
app.appendChild(codeOut)

const stateHeading = document.createElement('h2')
stateHeading.textContent = 'Current State JSON'
stateHeading.style.margin = '20px 0 8px'
stateHeading.style.fontSize = '16px'
app.appendChild(stateHeading)
app.appendChild(stateOut)

const previewHeading = document.createElement('h2')
previewHeading.textContent = 'Readonly / Hidden Toolbox Preview'
previewHeading.style.margin = '20px 0 8px'
previewHeading.style.fontSize = '16px'
app.appendChild(previewHeading)

const previewWrap = document.createElement('div')
previewWrap.id = 'block-preview-wrap'
previewWrap.style.width = '100%'
previewWrap.style.height = '35vh'
previewWrap.style.minHeight = '240px'
previewWrap.style.border = '1px solid #ccc'
previewWrap.style.background = '#fff'

const previewBlocklyInstance = newBlocklyInstance(toolbox, {
    id: 'block-preview-canvas',
    readonly: true,
    hideToolbox: true,
})
previewBlocklyInstance.canvas.style.width = '100%'
previewBlocklyInstance.canvas.style.height = '100%'
previewWrap.appendChild(previewBlocklyInstance.canvas)
app.appendChild(previewWrap)

mountBlocklyInstance(previewBlocklyInstance, previewWrap, {
    resizeImmediately: true,
})

const destroyHeading = document.createElement('h2')
destroyHeading.textContent = 'Destroy Instance Test'
destroyHeading.style.margin = '20px 0 8px'
destroyHeading.style.fontSize = '16px'
app.appendChild(destroyHeading)

const destroyControls = document.createElement('div')
destroyControls.style.display = 'flex'
destroyControls.style.gap = '8px'
destroyControls.style.flexWrap = 'wrap'
destroyControls.style.margin = '12px 0'

const destroyWrap = document.createElement('div')
destroyWrap.id = 'destroy-test-wrap'
destroyWrap.style.width = '100%'
destroyWrap.style.height = '28vh'
destroyWrap.style.minHeight = '220px'
destroyWrap.style.border = '1px solid #ccc'
destroyWrap.style.background = '#fff'

const destroyStatus = document.createElement('pre')
destroyStatus.style.background = '#f5f5f5'
destroyStatus.style.padding = '12px'
destroyStatus.style.border = '1px solid #ddd'
destroyStatus.style.whiteSpace = 'pre-wrap'
destroyStatus.style.wordBreak = 'break-word'

app.appendChild(destroyControls)
app.appendChild(destroyWrap)
app.appendChild(destroyStatus)

let destroyTestInstance = null

const createDestroyTestInstance = () => {
    destroyWrap.replaceChildren()

    destroyTestInstance = newBlocklyInstance(toolbox, {
        id: 'destroy-test-canvas',
    })
    destroyTestInstance.canvas.style.width = '100%'
    destroyTestInstance.canvas.style.height = '100%'
    destroyWrap.appendChild(destroyTestInstance.canvas)
    mountBlocklyInstance(destroyTestInstance, destroyWrap, {
        resizeImmediately: true,
    })

    destroyStatus.textContent = 'Destroy test instance ready.'
}

const runDestroyTest = () => {
    if (!destroyTestInstance) {
        destroyStatus.textContent = 'No destroy test instance is active.'
        return
    }

    const observersBefore = destroyTestInstance.resizeObservers.length
    destroyBlocklyInstance(destroyTestInstance)

    destroyStatus.textContent = [
        'Destroy test complete.',
        `observersBefore: ${observersBefore}`,
        `observersAfter: ${destroyTestInstance.resizeObservers.length}`,
        `workspaceDisposed: ${destroyTestInstance.workspace.disposed === true}`,
        `svgStillMounted: ${destroyWrap.querySelector('svg') !== null}`,
    ].join('\n')

    destroyTestInstance = null
}

destroyControls.appendChild(
    makeButton('Create Destroy Test Instance', () => {
        createDestroyTestInstance()
    }),
)

destroyControls.appendChild(
    makeButton('Run Destroy Test', () => {
        runDestroyTest()
    }),
)

addChangeListener(editableBlocklyInstance, (event) => {
    if (!event || editableBlocklyInstance.workspace.isDragging()) {
        return
    }
    setBlocklyState(
        previewBlocklyInstance,
        getBlocklyState(editableBlocklyInstance),
    )
    updateOutputs()
})

setBlocklyState(previewBlocklyInstance, getBlocklyState(editableBlocklyInstance))
createDestroyTestInstance()
updateOutputs()

controls.appendChild(
    makeButton('Copy Editable -> Preview', () => {
        setBlocklyState(
            previewBlocklyInstance,
            getBlocklyState(editableBlocklyInstance),
        )
    }),
)
