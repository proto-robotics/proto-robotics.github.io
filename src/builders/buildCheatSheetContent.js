/*
 * Builds and manages reusable cheatsheet content for the drawer, standalone
 * page, and print stage. Page and drawer shells live elsewhere.
 */

import { hr, on, tag } from 'ellipsi'

import { cheatSheetBlocks as blocks } from '../data/library'
import {
    CheatSheetPreviewMode,
    createCheatSheetPreview,
    fitCheatSheetBlockPreviews,
} from '../helpers/cheatSheetPreviewHelper'
import { whenEditorFontsReady } from '../helpers/fontHelper'

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

/**
 * Builds the block-name lookup used when a block opens its drawer entry.
 * Examples consume item numbers even though they do not appear in the lookup.
 * @returns {Record<string, number>} Block names mapped to cheatsheet item numbers.
 */
function buildBlockElementNumberLookup() {
    const lookup = {}
    let nextElementNumber = 1

    for (const section of blocks) {
        for (const block of section.entries) {
            lookup[block.name] = nextElementNumber
            nextElementNumber++
        }

        nextElementNumber += section.examples?.length ?? 0
    }

    return lookup
}

/** Maps each Blockly block name to its numbered cheatsheet item. */
export const cheatSheetBlockElementNumbers = Object.freeze(
    buildBlockElementNumberLookup(),
)

/**
 * Counts the items in preceding sections to keep element numbers stable.
 * @param {number} sectionIndex Section being rendered.
 * @returns {number} Number of items before the section.
 */
function countItemsBeforeSection(sectionIndex) {
    return blocks
        .slice(0, sectionIndex)
        .reduce(
            (count, section) =>
                count +
                section.entries.length +
                (section.examples?.length ?? 0),
            0,
        )
}

/**
 * Creates serialized workspace state for a single block reference entry.
 * @param {string} blockType Blockly block type to preview.
 * @returns {object} Serialized one-block Blockly workspace state.
 */
function createSingleBlockWorkspaceState(blockType) {
    return {
        blocks: {
            languageVersion: 0,
            blocks: [
                {
                    type: blockType,
                    x: 12,
                    y: 12,
                },
            ],
        },
    }
}

/**
 * Renders a single documented block, including its generated preview.
 * @param {object} block Block definition.
 * @param {object} settings Preview settings.
 * @param {number} elementNumber Stable cheatsheet item number.
 * @returns {HTMLElement} Rendered block item.
 */
function buildBlockItem(block, settings, elementNumber) {
    const item = tag('cheatsheet-item', {
        id: `cheatsheet-item-${elementNumber}`,
        'data-cheatsheet-element-number': String(elementNumber),
        'data-block-name': block.name,
        'data-has-code': String(settings.mode !== CheatSheetPreviewMode.BLOCKS),
    })
    item.append(
        tag('p', block.description),
        createCheatSheetPreview(
            createSingleBlockWorkspaceState(block.name),
            settings,
        ),
    )
    return item
}

/**
 * Renders all block definitions in one cheatsheet section.
 * @param {object} section Cheatsheet category.
 * @param {object} settings Preview settings.
 * @param {number} elementOffset Number of items before this section.
 * @returns {HTMLElement} Block-definition container.
 */
function buildBlockItems(section, settings, elementOffset) {
    return tag(
        'cheatsheet-code-section',
        ...section.entries.map((block, index) =>
            buildBlockItem(block, settings, elementOffset + index + 1),
        ),
    )
}

/**
 * Renders one named example workspace and its optional preamble.
 * @param {object} example Example definition.
 * @param {object} settings Preview settings.
 * @param {number} elementNumber Stable cheatsheet item number.
 * @returns {HTMLElement} Rendered example item.
 */
function buildExampleItem(example, settings, elementNumber) {
    const item = tag('cheatsheet-item', {
        id: `cheatsheet-item-${elementNumber}`,
        'data-cheatsheet-element-number': String(elementNumber),
        'data-has-code': String(settings.mode !== CheatSheetPreviewMode.BLOCKS),
    })

    if (example.name) {
        item.appendChild(tag('h3', example.name))
    }

    item.append(
        tag('p', example.preamble),
        createCheatSheetPreview(example.workspace, settings),
    )
    return item
}

/**
 * Renders examples after the section's block definitions.
 * @param {object} section Cheatsheet category.
 * @param {object} settings Preview settings.
 * @param {number} elementOffset Number of items before this section.
 * @returns {HTMLElement} Example container.
 */
function buildExampleItems(section, settings, elementOffset) {
    const exampleOffset = elementOffset + section.entries.length

    return tag(
        'cheatsheet-example-section',
        ...(section.examples ?? []).map((example, index) =>
            buildExampleItem(example, settings, exampleOffset + index + 1),
        ),
    )
}

/**
 * Combines a section heading, block definitions, and examples.
 * @param {object} section Cheatsheet category.
 * @param {object} settings Preview settings.
 * @param {number} sectionIndex Category index.
 * @returns {HTMLElement} Rendered cheatsheet section.
 */
function buildSection(section, settings, sectionIndex) {
    const elementOffset = countItemsBeforeSection(sectionIndex)

    return tag(
        'cheatsheet-section',
        {
            id: `cheatsheet-section-${sectionIndex}`,
            'data-section-name': section.name,
            'data-section-index': String(sectionIndex),
        },
        tag('h2', section.name),
        tag(
            'cheatsheet-section-content',
            buildBlockItems(section, settings, elementOffset),
            buildExampleItems(section, settings, elementOffset),
        ),
        hr(),
    )
}

/**
 * Scrolls either the drawer panel or page window to a selected section.
 * @param {HTMLElement} content Cheatsheet content root.
 * @param {number} sectionIndex Category index to reveal.
 */
function scrollToCheatSheetSection(content, sectionIndex) {
    const section = content.querySelector(
        `cheatsheet-section[data-section-index="${sectionIndex}"]`,
    )
    if (!section) {
        return
    }

    const scrollContainer =
        content.closest('#cheatsheet-drawer-panel') ?? window
    const controls = content.querySelector('cheatsheet-controls')
    const controlsBottom = controls?.getBoundingClientRect().bottom ?? 0
    const sectionTop = section.getBoundingClientRect().top
    const spacing = 8

    if (scrollContainer === window) {
        // Section and controls positions are viewport-relative. Add the page's
        // existing scroll position to produce the document-relative target.
        window.scrollTo({
            top: window.scrollY + sectionTop - controlsBottom - spacing,
            behavior: 'smooth',
        })
        return
    }

    const containerTop = scrollContainer.getBoundingClientRect().top
    const controlsHeight = controls?.getBoundingClientRect().height ?? 0
    // Drawer scrolling uses coordinates relative to the drawer panel instead
    // of the document. Leave room for the sticky controls at the top.
    scrollContainer.scrollTo({
        top:
            scrollContainer.scrollTop +
            sectionTop -
            containerTop -
            controlsHeight -
            spacing,
        behavior: 'smooth',
    })
}

/** @returns {Promise<void>} Resolves on the next animation frame. */
function waitForAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve))
}

/**
 * Detects preview or code content that exceeds an item's current column width.
 * @param {HTMLElement} item Cheatsheet item to measure.
 * @returns {boolean} Whether the item requires wide layout.
 */
function itemContentOverflows(item) {
    const availableWidth = item.clientWidth + 1

    return Array.from(
        item.querySelectorAll('blockly-preview, .cm-content, .cm-line'),
    ).some((child) => {
        const styledWidth = Number.parseFloat(child.style.width) || 0
        return (
            styledWidth > availableWidth ||
            child.getBoundingClientRect().width > availableWidth ||
            child.scrollWidth > availableWidth
        )
    })
}

/**
 * Forces pending style and layout changes to be calculated before measurement.
 * @param {HTMLElement} element Element whose layout must be current.
 */
function flushPendingLayout(element) {
    element.getBoundingClientRect()
}

/**
 * Marks every item whose preview content overflows as a full-width item.
 * @param {HTMLElement[]} items Cheatsheet items to measure.
 */
function widenOverflowingItems(items) {
    for (const item of items) {
        if (itemContentOverflows(item)) {
            item.classList.add('cheatsheet-item-wide')
        }
    }
}

/**
 * Recalculates which cheatsheet items need the full-width layout.
 *
 * Blockly previews are fitted twice: once at the normal column width and again
 * after overflowing items become wider. The final overflow check catches code
 * or previews whose measured width changed during that second layout.
 * @param {HTMLElement} content Cheatsheet content root.
 */
function updateWideItemLayout(content) {
    const items = Array.from(content.querySelectorAll('cheatsheet-item'))

    // Always start from the normal column layout so an item can become narrow
    // again after a viewport or display-mode change.
    for (const item of items) {
        item.classList.remove('cheatsheet-item-wide')
    }

    flushPendingLayout(content)
    fitCheatSheetBlockPreviews(content)
    flushPendingLayout(content)
    widenOverflowingItems(items)

    // Widening an item changes the width available to its Blockly preview.
    flushPendingLayout(content)
    fitCheatSheetBlockPreviews(content)
    flushPendingLayout(content)
    widenOverflowingItems(items)
}

/**
 * Defers layout measurement until the browser's next rendering frame.
 * @param {HTMLElement} content Cheatsheet content root.
 * @returns {Promise<void>} Resolves after updating item widths.
 */
async function updateWideItemLayoutAfterRender(content) {
    await waitForAnimationFrame()
    updateWideItemLayout(content)
}

/** Removes the temporary off-screen print layout and its body state. */
function removeCheatSheetPrintStage() {
    document.body.classList.remove('printing-cheatsheet-stage')
    document.getElementById(printStageId)?.remove()
}

/**
 * Creates a hidden, fully rendered cheatsheet sized for browser printing.
 * @param {string} mode Preview display mode.
 * @returns {Promise<HTMLElement>} Prepared print stage.
 */
async function createCheatSheetPrintStage(mode) {
    removeCheatSheetPrintStage()

    const stage = tag('cheatsheet-print-stage', {
        id: printStageId,
        'aria-hidden': 'true',
    })

    // Printing needs a separate, control-free instance so print dimensions do
    // not depend on whether the page or drawer is currently visible.
    const rendered = new Promise((resolve) => {
        stage.appendChild(
            buildCheatSheetContent({
                mode,
                showControls: false,
                observeResize: false,
                onRendered: resolve,
            }),
        )
    })

    document.body.appendChild(stage)
    await rendered
    await whenEditorFontsReady()
    await waitForAnimationFrame()

    const content = stage.querySelector('cheatsheet-content')
    updateWideItemLayout(content)
    stage.dataset.printContentWidth = String(
        Math.round(content.getBoundingClientRect().width),
    )

    return stage
}

/**
 * Prepares the print layout before opening the browser print dialog.
 * @param {string} mode Preview display mode.
 * @returns {Promise<void>} Resolves after opening the print dialog.
 */
async function printCheatSheet(mode) {
    await createCheatSheetPrintStage(mode)
    document.body.classList.add('printing-cheatsheet-stage')
    await waitForAnimationFrame()
    window.print()
}

/**
 * Creates preview-mode, print, and full-page controls when requested.
 * @param {string} currentMode Active preview mode.
 * @param {(mode: string) => void} onSelectMode Handles mode changes.
 * @param {object} options Optional control elements and handlers.
 * @returns {HTMLElement} Cheatsheet controls element.
 */
function buildCheatSheetControls(
    currentMode,
    onSelectMode,
    { sectionTabs = null, onPrint = null, onOpenFullCheatSheet = null } = {},
) {
    const controls = tag(
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
    )

    if (onPrint) {
        controls.appendChild(
            tag(
                'button',
                { type: 'button' },
                'Print cheatsheet',
                on('click', onPrint),
            ),
        )
    }

    if (onOpenFullCheatSheet) {
        controls.appendChild(
            tag(
                'button',
                { type: 'button' },
                'Open full cheatsheet',
                on('click', onOpenFullCheatSheet),
            ),
        )
    }

    return controls
}

/**
 * Keeps section-tab aria state aligned with the currently visible section.
 * @param {HTMLElement} content Cheatsheet content root.
 * @param {HTMLElement} sectionTabs Section-tab container.
 * @returns {() => void} Removes the scroll and resize listeners.
 */
function watchActiveSection(content, sectionTabs) {
    const scrollContainer =
        content.closest('#cheatsheet-drawer-panel') ?? window
    let updateScheduled = false

    const updateActiveSectionTab = () => {
        const sections = Array.from(
            content.querySelectorAll('cheatsheet-section'),
        )
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

        // The active section is the last heading that has crossed the marker
        // immediately below the sticky controls.
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

    const scheduleActiveSectionUpdate = () => {
        if (updateScheduled) {
            return
        }

        // Scroll events can fire much faster than the browser can paint.
        // Perform at most one section measurement per animation frame.
        updateScheduled = true
        requestAnimationFrame(() => {
            updateScheduled = false
            updateActiveSectionTab()
        })
    }

    scrollContainer.addEventListener('scroll', scheduleActiveSectionUpdate, {
        passive: true,
    })
    window.addEventListener('resize', scheduleActiveSectionUpdate)
    scheduleActiveSectionUpdate()

    return () => {
        scrollContainer.removeEventListener(
            'scroll',
            scheduleActiveSectionUpdate,
        )
        window.removeEventListener('resize', scheduleActiveSectionUpdate)
    }
}

/**
 * Creates section tabs that scroll their owning cheatsheet content.
 * @param {HTMLElement} content Cheatsheet content root.
 * @returns {HTMLElement} Section-tab container.
 */
function buildSectionTabs(content) {
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

/**
 * Builds a cheatsheet with optional controls and responsive preview fitting.
 * @param {object} options Rendering and control options.
 * @param {string} [options.mode='blocks-and-code'] Initial preview mode.
 * @param {boolean} [options.showControls=true] Shows preview and section controls.
 * @param {boolean} [options.observeResize=true] Refits content after resize/print.
 * @param {(content: HTMLElement) => void} [options.onRendered] Render callback.
 * @param {boolean} [options.showPrint=true] Shows the print control.
 * @param {boolean} [options.showOpenFullCheatSheet=false] Shows the full-page link.
 * @returns {HTMLElement} The cheatsheet content root.
 */
export function buildCheatSheetContent({
    mode = CheatSheetPreviewMode.BLOCKS_AND_CODE,
    showControls = true,
    observeResize = true,
    onRendered = () => {},
    showPrint = true,
    showOpenFullCheatSheet = false,
} = {}) {
    const contentRoot = tag('cheatsheet-content')
    let displayMode = mode
    let responsiveLayoutScheduled = false
    let stopWatchingActiveSection = () => {}

    const updateResponsiveLayout = () => {
        if (contentRoot.isConnected) {
            updateWideItemLayoutAfterRender(contentRoot)
        }
    }

    const scheduleResponsiveLayout = () => {
        if (responsiveLayoutScheduled) {
            return
        }

        // Collapse a burst of resize events into one layout update.
        responsiveLayoutScheduled = true
        requestAnimationFrame(() => {
            responsiveLayoutScheduled = false
            updateResponsiveLayout()
        })
    }

    if (observeResize) {
        window.addEventListener('afterprint', updateResponsiveLayout)
        window.addEventListener('afterprint', removeCheatSheetPrintStage)
        window.addEventListener('resize', scheduleResponsiveLayout)
    }

    const renderContent = async () => {
        // A mode change replaces every section, so detach the previous
        // section-tracking listeners before replacing their DOM.
        stopWatchingActiveSection()

        // Font metrics affect both Blockly and CodeMirror measurements. Build
        // the DOM only after fonts are ready and the current frame completes.
        await whenEditorFontsReady()
        await waitForAnimationFrame()

        const settings = { mode: displayMode }
        const sections = blocks.map((section, index) =>
            buildSection(section, settings, index),
        )
        contentRoot.dataset.previewMode = displayMode

        if (showControls) {
            const sectionTabs = buildSectionTabs(contentRoot)
            const controlOptions = { sectionTabs }

            if (showPrint) {
                controlOptions.onPrint = () => printCheatSheet(displayMode)
            }
            if (showOpenFullCheatSheet) {
                controlOptions.onOpenFullCheatSheet = () => {
                    window.location.href = `${codingHomePath}?cheatsheet`
                }
            }

            contentRoot.replaceChildren(
                buildCheatSheetControls(
                    displayMode,
                    (newMode) => {
                        displayMode = newMode
                        renderContent()
                    },
                    controlOptions,
                ),
                ...sections,
            )
        } else {
            contentRoot.replaceChildren(...sections)
        }

        await updateWideItemLayoutAfterRender(contentRoot)
        if (showControls) {
            const sectionTabs = contentRoot.querySelector(
                'cheatsheet-section-tabs',
            )
            stopWatchingActiveSection = watchActiveSection(
                contentRoot,
                sectionTabs,
            )
        }
        onRendered(contentRoot)
    }

    renderContent()

    return contentRoot
}
