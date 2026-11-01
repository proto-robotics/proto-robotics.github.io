/*
 * The editor as a library, for a site that renders it inside its own page
 * instead of in an iframe (PROTO Learn). Built by the second webpack config
 * into dist/lib/proto-ide.js and proto-ide.css, with the stylesheet scoped
 * to the editor's root element.
 *
 *   import { mountEditor, fields } from './proto-ide.js'
 *   const editor = await mountEditor(container, {
 *       categories: [myCategory],   // extra block categories, library.js shape
 *       toolbox: ['Motor', 'Time'], // or blocks: ['largemotor', 'spin']
 *       maxBlocks: 4,
 *       onChange: ({ code, blockTypes, state }) => {},
 *   })
 *   editor.setTask({ goal, markdown, requiredBlocks, hints, projectName })
 *   editor.load(state)
 *
 * The host's categories are plain objects in the same shape as the entries
 * in src/data/library.js, with `codeGenerator` functions of their own, so a
 * host can add blocks the IDE knows nothing about. They never reach the
 * cheatsheet. `fields` builds the field factories a template needs. The
 * Python those blocks write can be described with `vocab` (the shape of
 * src/data/pythonLibraryVocab.json), so the line editor completes it and
 * the checker accepts it.
 */
import '../styles.css'
import './lib.css'

import { FieldNumber, FieldTextInput } from 'blockly'
import { pythonGenerator } from 'blockly/python'
import { processJengaTower } from '@protorobotics/jenga'
import { div } from 'ellipsi'

import {
    extractJengaBlocks,
    gridDropdown,
    hiddenCategoryNames,
    jengaBlocks,
} from './data/library'
import { createEmbedEditor } from './builders/BuildEmbedContent'
import { addVocab } from './data/vocab'
import { filterToolbox } from './helpers/editorParamsHelper'
import { whenEditorFontsReady } from './helpers/fontHelper'
import { watchPhoneLayout } from './helpers/phoneLayoutHelper'
import { setRoot } from './helpers/rootHelper'
import { setWidgetHost } from './helpers/blocklyHelper'

export { addVocab, pythonGenerator, whenEditorFontsReady }

/** Field factories for a host category's `blocklyTemplate` entries. */
export const fields = {
    /**
     * @param {number} value Starting value.
     * @param {number} [min] Smallest allowed.
     * @param {number} [max] Largest allowed.
     * @param {number} [precision] Step, 1 for whole numbers.
     */
    number: (value, min, max, precision) => () =>
        new FieldNumber(value, min, max, precision),
    /** @param {string} value Starting text. */
    text: (value) => () => new FieldTextInput(value),
    /** @param {Array<[string, string]>} options Choices as [label, value]. */
    dropdown: (options) => () => gridDropdown(options),
}

/**
 * Builds the toolbox from the IDE's library plus the host's categories.
 * Host categories are hidden ones: no help icon (there is no cheatsheet
 * entry to open), and they only appear when `toolbox` names them or
 * `blocks` names one of their blocks.
 * @param {object[]} categories The host's categories, library.js shape.
 * @param {object} narrow
 * @param {string[]} [narrow.toolbox] Category names to keep.
 * @param {string[]} [narrow.blocks] Block types to keep.
 * @returns {object} A Blockly toolbox.
 */
const buildToolbox = (categories, { toolbox, blocks }) => {
    const extra = extractJengaBlocks(
        categories.map((category) => ({ ...category, hidden: true })),
    )
    const { toolbox: full } = processJengaTower(
        [...jengaBlocks, ...extra],
        pythonGenerator,
    )
    return filterToolbox(full, {
        categories: toolbox ?? null,
        blocks: blocks ?? null,
        hidden: [...hiddenCategoryNames, ...categories.map((c) => c.name)],
    })
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/**
 * Mounts the editor inside an element. With `view` it is a read-only
 * viewer of one program: no toolbar, task panel, toolbox or cheatsheet,
 * and any number of them can share a page. Without it, it is the full
 * editor, and a page should hold one.
 * @param {HTMLElement} container Gets the editor's root element appended;
 *     the root fills it, so the container decides the size.
 * @param {object} [options]
 * @param {object[]} [options.categories] Extra block categories.
 * @param {object} [options.vocab] Python vocabulary for them: { members,
 *     methodsByType }, see src/data/vocab.js. Kept for every later editor.
 * @param {string[]} [options.toolbox] Category names to keep.
 * @param {string[]} [options.blocks] Block types to keep.
 * @param {number} [options.maxBlocks] Cap on blocks, with a counter.
 * @param {Record<string, number>} [options.maxInstances] Per-type caps.
 * @param {boolean} [options.view=false] Read-only viewer.
 * @param {boolean} [options.codePreview=false] Show the Python pane.
 * @param {boolean} [options.codeOpen=false] Start with the pane open.
 * @param {(detail: {code: string, blockTypes: string[], state: object}) => void} [options.onChange]
 * @param {() => void} [options.onEscape] Escape pressed inside the editor.
 * @returns {Promise<{
 *   element: HTMLElement,
 *   setTask: (task: object) => void,
 *   load: (state: object|null) => void,
 *   clear: () => void,
 *   setCheatsheet: (open?: boolean) => void,
 *   destroy: () => void,
 * }>} The mounted editor, once the workspace exists.
 */
export const mountEditor = async (
    container,
    {
        categories = [],
        vocab,
        toolbox,
        blocks,
        maxBlocks,
        maxInstances,
        view = false,
        codePreview = false,
        codeOpen = false,
        onChange,
        onEscape,
    } = {},
) => {
    // Blockly measures text as soon as a workspace is injected, so the font
    // must be loaded before the editor is built.
    await whenEditorFontsReady()
    // dropdowns and text inputs are positioned in page coordinates, so they
    // live on the page's body, not inside the editor's positioned root
    setWidgetHost(document.body)
    if (vocab) {
        addVocab(vocab)
    }

    const root = div({ class: 'proto-ide' })
    if (!view) {
        // dialogs and the phone layout belong to the full editor
        setRoot(root)
    }

    const api = await createEmbedEditor(
        buildToolbox(categories, { toolbox, blocks }),
        { mode: 'block', maxBlocks, maxInstances, codePreview, codeOpen, view },
        { root, onChange, onEscape },
    )
    root.append(...api.elements)
    container.append(root)
    const stopPhoneLayout = view ? () => {} : watchPhoneLayout(root)

    // the workspace lays itself out on the first resize after it lands
    await nextFrame()
    await nextFrame()

    return {
        element: root,
        setTask: api.setTask,
        load: api.setState,
        clear: () => api.setState(null),
        setCheatsheet: api.setCheatsheet,
        destroy: () => {
            stopPhoneLayout()
            api.dispose()
            root.remove()
        },
    }
}
