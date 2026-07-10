import { a, hr, img, on, tag } from 'ellipsi'

import { cheatSheetBlocks as blocks } from '../data/library'
import {
    CheatSheetPreviewMode,
    createCheatSheetPreview,
    createSingleBlockWorkspaceState,
    fitCheatSheetBlockPreviews,
} from '../helpers/cheatSheetPreviewHelper'

const displayModeOptions = [
    {
        label: 'Blocks + code',
        mode: CheatSheetPreviewMode.BLOCKS_AND_CODE,
    },
    {
        label: 'Blocks',
        mode: CheatSheetPreviewMode.BLOCKS,
    },
    {
        label: 'Code',
        mode: CheatSheetPreviewMode.CODE,
    },
]
const printStageId = 'cheatsheet-print-stage'
const codingHomePath = window.location.pathname

export const cheatSheetBlockElementNumbers = Object.freeze(
    blocks.reduce(
        ({ lookup, nextElementNumber }, section) => {
            for (const block of section.entries) {
                lookup[block.name] = nextElementNumber
                nextElementNumber++
            }

            nextElementNumber += section.examples?.length ?? 0

            return { lookup, nextElementNumber }
        },
        { lookup: {}, nextElementNumber: 1 },
    ).lookup,
)

export function getCheatSheetElementNumberForBlock(blockName) {
    return cheatSheetBlockElementNumbers[blockName] ?? null
}

export function getCheatSheetItemSelector(elementNumber) {
    return `[data-cheatsheet-element-number="${elementNumber}"]`
}

function getSectionElementOffset(sectionIndex) {
    return blocks
        .slice(0, sectionIndex)
        .reduce(
            (count, section) =>
                count + section.entries.length + (section.examples?.length ?? 0),
            0,
        )
}

function createBlockDefinition(block, settings, elementNumber) {
    const entryDiv = tag('cheatsheet-item', {
        id: `cheatsheet-item-${elementNumber}`,
        'data-cheatsheet-element-number': String(elementNumber),
        'data-block-name': block.name,
        'data-has-code': String(settings.mode !== CheatSheetPreviewMode.BLOCKS),
    })
    entryDiv.appendChild(tag('p', `${block.description}`))
    entryDiv.appendChild(
        createCheatSheetPreview(createSingleBlockWorkspaceState(block.name), settings),
    )
    return entryDiv
}

function createCodeSection(section, settings, elementOffset) {
    const codeDiv = tag('cheatsheet-code-section')

    for (let i = 0; i < section.entries.length; i++) {
        codeDiv.appendChild(
            createBlockDefinition(section.entries[i], settings, elementOffset + i + 1),
        )
    }

    return codeDiv
}

function createExample(example, settings, elementNumber) {
    const exampleDiv = tag('cheatsheet-item', {
        id: `cheatsheet-item-${elementNumber}`,
        'data-cheatsheet-element-number': String(elementNumber),
        'data-has-code': String(settings.mode !== CheatSheetPreviewMode.BLOCKS),
    })

    if (example.name) {
        exampleDiv.appendChild(tag('h3', example.name))
    }

    exampleDiv.appendChild(tag('p', `${example.preamble}`))
    exampleDiv.appendChild(createCheatSheetPreview(example.workspace, settings))
    return exampleDiv
}

function createExampleSection(section, settings, elementOffset) {
    const examplesDiv = tag('cheatsheet-example-section')
    const exampleOffset = elementOffset + section.entries.length

    if (section.examples !== undefined) {
        for (let i = 0; i < section.examples.length; i++) {
            examplesDiv.appendChild(
                createExample(section.examples[i], settings, exampleOffset + i + 1),
            )
        }
    }

    return examplesDiv
}

function createSection(section, settings, sectionIndex) {
    const elementOffset = getSectionElementOffset(sectionIndex)
    const sectionDiv = tag('cheatsheet-section', {
        id: `cheatsheet-section-${sectionIndex}`,
        'data-section-name': section.name,
        'data-section-index': String(sectionIndex),
    })
    const sectionHeader = tag('h2', `${section.name}`)
    sectionDiv.append(sectionHeader)

    const contentHolder = tag('cheatsheet-section-content')
    contentHolder.appendChild(createCodeSection(section, settings, elementOffset))
    contentHolder.appendChild(createExampleSection(section, settings, elementOffset))
    sectionDiv.appendChild(contentHolder)
    sectionDiv.appendChild(hr())
    return sectionDiv
}

function scrollToCheatSheetSection(content, sectionIndex) {
    const section = content.querySelector(
        `cheatsheet-section[data-section-index="${sectionIndex}"]`,
    )
    if (!section) {
        return
    }

    const scrollContainer = content.closest('#cheatsheet-drawer-panel') ?? window
    const controls = content.querySelector('cheatsheet-controls')
    const controlsBottom = controls?.getBoundingClientRect().bottom ?? 0
    const sectionTop = section.getBoundingClientRect().top
    const spacing = 8

    if (scrollContainer === window) {
        window.scrollTo({
            top: window.scrollY + sectionTop - controlsBottom - spacing,
            behavior: 'smooth',
        })
        return
    }

    const containerTop = scrollContainer.getBoundingClientRect().top
    scrollContainer.scrollTo({
        top:
            scrollContainer.scrollTop +
            sectionTop -
            containerTop -
            (controls?.getBoundingClientRect().height ?? 0) -
            spacing,
        behavior: 'smooth',
    })
}

function waitForFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve))
}

function itemDoesNotFit(item) {
    return Array.from(
        item.querySelectorAll('blockly-preview, .cm-content, .cm-line'),
    ).some(
        (child) => {
            const styledWidth = Number.parseFloat(child.style.width) || 0
            return (
                styledWidth > item.clientWidth + 1 ||
                child.getBoundingClientRect().width > item.clientWidth + 1 ||
                child.scrollWidth > item.clientWidth + 1
            )
        },
    )
}

function fitCheatSheetItemsNow(content) {
    const items = Array.from(content.querySelectorAll('cheatsheet-item'))
    for (const item of items) {
        item.classList.remove('cheatsheet-item-wide')
    }

    void content.offsetWidth
    fitCheatSheetBlockPreviews(content)
    void content.offsetWidth

    for (const item of items) {
        if (itemDoesNotFit(item)) {
            item.classList.add('cheatsheet-item-wide')
        }
    }

    void content.offsetWidth
    fitCheatSheetBlockPreviews(content)
    void content.offsetWidth

    for (const item of items) {
        if (itemDoesNotFit(item)) {
            item.classList.add('cheatsheet-item-wide')
        }
    }
}

async function fitCheatSheetItems(content) {
    await waitForFrame()
    fitCheatSheetItemsNow(content)
}

function removeCheatSheetPrintStage() {
    document.body.classList.remove('printing-cheatsheet-stage')
    document.getElementById(printStageId)?.remove()
}

async function createCheatSheetPrintStage(mode) {
    removeCheatSheetPrintStage()

    const stage = tag('cheatsheet-print-stage', {
        id: printStageId,
        'aria-hidden': 'true',
    })

    const rendered = new Promise((resolve) => {
        stage.appendChild(
            createCheatSheetContent({
                mode,
                showControls: false,
                observeResize: false,
                onRendered: resolve,
            }),
        )
    })

    document.body.appendChild(stage)
    await rendered
    await document.fonts?.ready
    await waitForFrame()

    const content = stage.querySelector('cheatsheet-content')
    fitCheatSheetItemsNow(content)
    stage.dataset.printContentWidth = String(
        Math.round(content.getBoundingClientRect().width),
    )

    return stage
}

async function printCheatSheet(mode) {
    await createCheatSheetPrintStage(mode)
    document.body.classList.add('printing-cheatsheet-stage')
    await waitForFrame()
    window.print()
}

function createDisplayModeControls(
    currentMode,
    onSelectMode,
    {
        sectionTabs = null,
        onPrint = null,
        onOpenFullCheatSheet = null,
    } = {},
) {
    return tag(
        'cheatsheet-controls',
        sectionTabs ?? tag('span'),
        ...displayModeOptions.map((option) =>
            tag(
                'button',
                {
                    type: 'button',
                    'aria-pressed': String(option.mode === currentMode),
                },
                option.label,
                on('click', () => onSelectMode(option.mode)),
            ),
        ),
        ...(onPrint
            ? [
                  tag(
                      'button',
                      {
                          type: 'button',
                      },
                      'Print cheatsheet',
                      on('click', onPrint),
                  ),
              ]
            : []),
        ...(onOpenFullCheatSheet
            ? [
                  tag(
                      'button',
                      {
                          type: 'button',
                      },
                      'Open full cheatsheet',
                      on('click', onOpenFullCheatSheet),
                  ),
              ]
            : []),
    )
}

function watchCurrentCheatSheetSection(content, sectionTabs) {
    const scrollContainer = content.closest('#cheatsheet-drawer-panel') ?? window
    let updateQueued = false
    const queueUpdate = () => {
        if (updateQueued) {
            return
        }

        updateQueued = true
        requestAnimationFrame(() => {
            updateQueued = false
            updateCurrentSection()
        })
    }
    const updateCurrentSection = () => {
        const sections = Array.from(content.querySelectorAll('cheatsheet-section'))
        const tabButtons = Array.from(
            sectionTabs.querySelectorAll('[data-section-index]'),
        )
        if (sections.length === 0) {
            for (const button of tabButtons) {
                button.removeAttribute('aria-current')
            }
            return
        }

        const controls = content.querySelector('cheatsheet-controls')
        const containerTop =
            scrollContainer === window
                ? 0
                : scrollContainer.getBoundingClientRect().top
        const activeLine =
            (controls?.getBoundingClientRect().bottom ?? containerTop) + 10
        let activeSection = sections[0]

        for (const section of sections) {
            if (section.getBoundingClientRect().top <= activeLine) {
                activeSection = section
            } else {
                break
            }
        }

        const activeIndex = activeSection.dataset.sectionIndex
        for (const button of tabButtons) {
            if (button.dataset.sectionIndex === activeIndex) {
                button.setAttribute('aria-current', 'true')
            } else {
                button.removeAttribute('aria-current')
            }
        }
    }

    scrollContainer.addEventListener('scroll', queueUpdate, { passive: true })
    window.addEventListener('resize', queueUpdate)
    queueUpdate()

    return () => {
        scrollContainer.removeEventListener('scroll', queueUpdate)
        window.removeEventListener('resize', queueUpdate)
    }
}

function createSectionTabs(content) {
    return tag(
        'cheatsheet-section-tabs',
        ...blocks.map((section, index) =>
            tag(
                'button',
                {
                    type: 'button',
                    'data-section-index': String(index),
                    style: `--cheatsheet-section-color: ${section.color}`,
                },
                section.name,
                on('click', () => scrollToCheatSheetSection(content, index)),
            ),
        ),
    )
}

export function createCheatSheetContent({
    mode = CheatSheetPreviewMode.BLOCKS_AND_CODE,
    showControls = true,
    observeResize = true,
    onRendered = () => {},
    showPrint = true,
    showOpenFullCheatSheet = false,
} = {}) {
    const mainDiv = tag('cheatsheet-content')
    let displayMode = mode
    let resizeFitQueued = false
    let stopWatchingCurrentSection = () => {}
    const fitScreenLayout = () => {
        if (mainDiv.isConnected) {
            fitCheatSheetItems(mainDiv)
        }
    }
    const queueScreenLayoutFit = () => {
        if (resizeFitQueued) {
            return
        }

        resizeFitQueued = true
        requestAnimationFrame(() => {
            resizeFitQueued = false
            fitScreenLayout()
        })
    }

    if (observeResize) {
        window.addEventListener('afterprint', fitScreenLayout)
        window.addEventListener('afterprint', removeCheatSheetPrintStage)
        window.addEventListener('resize', queueScreenLayoutFit)
    }

    const renderCheatSheet = async () => {
        stopWatchingCurrentSection()
        await document.fonts?.ready
        await waitForFrame()

        const settings = { mode: displayMode }
        const content = blocks.map((section, index) =>
            createSection(section, settings, index),
        )
        mainDiv.dataset.previewMode = displayMode

        if (showControls) {
            const sectionTabs = createSectionTabs(mainDiv)
            mainDiv.replaceChildren(
                createDisplayModeControls(
                    displayMode,
                    (newMode) => {
                        displayMode = newMode
                        renderCheatSheet()
                    },
                    {
                        sectionTabs,
                        onPrint: showPrint
                            ? () => printCheatSheet(displayMode)
                            : null,
                        onOpenFullCheatSheet: showOpenFullCheatSheet
                            ? () => {
                                  window.location.href = `${codingHomePath}?cheatsheet`
                              }
                            : null,
                    },
                ),
                ...content,
            )
        } else {
            mainDiv.replaceChildren(...content)
        }

        await fitCheatSheetItems(mainDiv)
        if (showControls) {
            const sectionTabs = mainDiv.querySelector('cheatsheet-section-tabs')
            stopWatchingCurrentSection = watchCurrentCheatSheetSection(
                mainDiv,
                sectionTabs,
            )
        }
        onRendered(mainDiv)
    }

    renderCheatSheet()

    return mainDiv
}

export default function () {
    const mainDiv = createCheatSheetContent()

    const Navbar = tag(
        'nav',
        a(
            { href: 'https://protorobotics.org/index.html', target: '_self' },
            img({
                src: '/images/proto-logo.png',
                alt: 'The PROTO logo',
                height: '32',
            }),
        ),
        a({ href: codingHomePath, target: '_self' }, 'Home'),
    )

    const page = tag('div', { class: 'cheatsheet-page' })
    const Header = tag('header', { class: 'cheatsheet-page-header' }, Navbar)
    const updateStickyOffset = () => {
        page.style.setProperty(
            '--cheatsheet-sticky-offset',
            `${Header.getBoundingClientRect().height}px`,
        )
    }
    const headerResizeObserver = new ResizeObserver(updateStickyOffset)
    headerResizeObserver.observe(Header)

    requestAnimationFrame(updateStickyOffset)

    page.appendChild(Header)
    page.appendChild(mainDiv)

    return [page]
}
