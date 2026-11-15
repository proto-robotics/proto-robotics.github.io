/*
 * The editor as a library, for a site that renders it inside its own page
 * instead of in an iframe (PROTO Learn). Built by the second webpack config
 * into dist/lib/proto-ide.js and proto-ide.css, with the stylesheet scoped
 * to the editor's root element.
 *
 *   import { mountEditor, fields } from './proto-ide.js'
 *   const editor = await mountEditor(container, {
 *       categories: [myCategory],   // extra block categories, library.js shape
 *       toolbox: ['Motor', 'Time'], // or blocks: ['drive_motor', 'spin']
 *       maxBlocks: 4,
 *       onChange: ({ code, blockTypes, state }) => {},
 *   })
 *   editor.setTask({ goal, markdown, requiredBlocks, hints, projectName })
 *   editor.load(state)
 *   // a simulator runs editor.tracedCode(), and for each make._block(id)
 *   // it reaches, editor.highlight(id); editor.highlight(null) when done
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
    toolboxHiddenBlockTypes,
} from './data/library'
import { createEmbedEditor } from './builders/BuildEmbedContent'
import { addVocab } from './data/vocab'
import { filterToolbox } from './helpers/editorParamsHelper'
import { whenEditorFontsReady } from './helpers/fontHelper'
import { watchPhoneLayout } from './helpers/phoneLayoutHelper'
import { setRoot } from './helpers/rootHelper'
import { setWidgetHost } from './helpers/blocklyHelper'
import { deviceField } from './mods/deviceField'
import { deviceCard } from './mods/deviceCard'

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
    /**
     * A choice of the program's devices of a kind, by name.
     * @param {string} kind For now 'drive_motor'.
     * @param {{placeholder?: string, nth?: number}} [options]
     */
    device: deviceField,
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
        hiddenBlocks: toolboxHiddenBlockTypes,
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
 * @param {boolean} [options.devices=false] Put the Devices section first in
 *     the toolbox, where the program's motors are set up. A device counts
 *     in `blockTypes` under its kind (for now `drive_motor`).
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
 *   highlight: (id: string|null) => void,
 *   tracedCode: () => string,
 *   destroy: () => void,
 * }>} The mounted editor, once the workspace exists. `tracedCode` is the
 *     program with `make._block('<id>')` before each block's code, for a
 *     simulator that reports which block is running; `highlight` lights up
 *     that block (and the blocks it sits inside), or none with null.
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
        devices = false,
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
        {
            mode: 'block',
            maxBlocks,
            maxInstances,
            codePreview,
            codeOpen,
            view,
            devices,
        },
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
        highlight: api.highlight,
        tracedCode: api.getTracedCode,
        destroy: () => {
            stopPhoneLayout()
            api.dispose()
            root.remove()
        },
    }
}

/**
 * Puts one device's card on a host's page, on its own: the same card the
 * Devices section of the toolbox shows ("fan is a drive motor on port 0 in
 * direction clockwise"), at the toolbox's size, so a lesson can show a
 * motor's setup without an editor. With `onChange` the port and direction
 * can be changed and the name typed; without it the card is read-only.
 * There is no remove or help button.
 * @param {HTMLElement} container Gets the card's root element appended.
 * @param {object} [options]
 * @param {{kind?: string, name?: string, port?: string, direction?: string}} [options.device]
 *     The device; a drive motor named motor on port 0, clockwise, if left out.
 * @param {(device: object) => void} [options.onChange] The device, after a change.
 * @returns {Promise<{
 *   element: HTMLElement,
 *   set: (device: object) => void,
 *   destroy: () => void,
 * }>} `set` shows a changed device (from the host's own controls).
 */
export const mountDeviceCard = async (container, { device, onChange } = {}) => {
    await whenEditorFontsReady()
    const root = div({ class: 'proto-ide proto-ide-card' })
    let current = {
        kind: 'drive_motor',
        name: 'motor',
        port: '0',
        direction: '1',
        ...device,
    }
    const draw = () =>
        root.replaceChildren(
            div(
                { class: 'toolbox-devices', role: 'list' },
                deviceCard(
                    current,
                    onChange
                        ? {
                              // eslint-disable-next-line no-unused-vars
                              onChange: ({ renamedFrom, ...patch }) => {
                                  current = { ...current, ...patch }
                                  draw()
                                  onChange({ ...current })
                              },
                          }
                        : {},
                ),
            ),
        )
    draw()
    container.append(root)
    return {
        element: root,
        set: (changed) => {
            current = { ...current, ...changed }
            draw()
        },
        destroy: () => root.remove(),
    }
}
