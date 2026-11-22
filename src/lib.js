/*
 * The editor as a library, for a site that renders it inside its own page
 * instead of in an iframe (PROTO Learn). Built by the second webpack config
 * into dist/lib/proto-ide.js and proto-ide.css, with the stylesheet scoped
 * to the editor's root element.
 *
 *   import { mountEditor, core, make, kit } from './proto-ide.js'
 *   const editor = await mountEditor(container, {
 *       libraries: [core, make],    // the default: the real robot's blocks
 *       toolbox: ['Motor', 'Time'], // or blocks: ['motorSpin', 'wait']
 *       maxBlocks: 4,
 *       onChange: ({ code, blockTypes, state }) => {},
 *   })
 *   editor.setTask({ goal, markdown, requiredBlocks, hints, projectName })
 *   editor.load(state)
 *   // a simulator runs editor.tracedCode('sim.block(%1)'), and for each
 *   // marker it reaches, editor.highlight(id); editor.highlight(null) when done
 *
 * The editor has no blocks of its own: it is given libraries
 * (src/libraries/engine.js). `core` and `make` are the IDE's; a host
 * writes its own with `kit` (a sandbox world's blocks, say) and passes
 * [core, itsWorld]. A library brings everything about its blocks: their
 * categories, icons and colors, device kinds, help, Python vocabulary,
 * lint rules and old names.
 */
import '../styles.css'
import './lib.css'

import { div } from 'ellipsi'

import { createEmbedEditor } from './builders/BuildEmbedContent'
import { whenEditorFontsReady } from './helpers/fontHelper'
import { watchPhoneLayout } from './helpers/phoneLayoutHelper'
import { setRoot } from './helpers/rootHelper'
import { setWidgetHost } from './helpers/blocklyHelper'
import { deviceCard } from './mods/deviceCard'
import { cleanDevice, deviceKinds } from './helpers/devicesHelper'
import { core } from './libraries/core/index'
import { make } from './libraries/make/index'
import * as kit from './libraries/kit'
import { setBlockSet, splice, toolboxOf, usesDevices } from './libraries/engine'

export { core, make, kit, splice }
export { pythonGenerator } from 'blockly/python'
export { whenEditorFontsReady }

/** The IDE's own block set: the real robot's blocks. */
const DEFAULT_LIBRARIES = [core, make]

/** Block sets already spliced, by their list of libraries, so remounting is cheap. */
const sets = new Map()
const blockSetFor = (libraries) => {
    const key = libraries.map((library) => library.name).join('+')
    if (!sets.has(key)) {
        sets.set(key, splice(libraries))
    }
    return sets.get(key)
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
 * @param {object[]} [options.libraries] The block libraries, in order:
 *     [core, make] (the real robot) unless given.
 * @param {string[]} [options.toolbox] Category names to keep.
 * @param {string[]} [options.blocks] Block types to keep.
 * @param {number} [options.maxBlocks] Cap on blocks, with a counter.
 * @param {Record<string, number>} [options.maxInstances] Per-type caps.
 * @param {boolean} [options.view=false] Read-only viewer.
 * @param {boolean} [options.devices] Pin a Devices button to the bottom of
 *     the toolbox column: it opens the program's devices in a pop-up, where
 *     they are set up. On by itself for an editable editor whose toolbox
 *     offers blocks that use devices. A device counts in `blockTypes`
 *     under its kind.
 * @param {boolean} [options.issues=false] An Issues tab on the right that
 *     lists the program's problems (blank devices and the like). The
 *     blocks with one are marked either way.
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
 *   tracedCode: (marker: string) => string,
 *   partBox: (blockId: string, name: string) => DOMRect|null,
 *   add: (state: object, clientX?: number, clientY?: number) => void,
 *   destroy: () => void,
 * }>} The mounted editor, once the workspace exists. `add` puts a saved
 *     program's blocks into the workspace beside what is there (at a point
 *     on the screen, or under the existing blocks), and adds any of its
 *     devices the program does not have yet. `tracedCode(marker)` is the
 *     program with the marker before each block's code, `%1` standing for
 *     the block's id in quotes, for a simulator that reports which block
 *     is running; `highlight` lights up that block (and the blocks it sits
 *     inside), or none with null.
 */
export const mountEditor = async (
    container,
    {
        libraries = DEFAULT_LIBRARIES,
        toolbox,
        blocks,
        maxBlocks,
        maxInstances,
        view = false,
        devices,
        issues = false,
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

    const set = blockSetFor(libraries)
    const root = div({ class: 'proto-ide' })
    if (!view) {
        // dialogs, the phone layout, the Devices pop-up and the cheatsheet
        // belong to the full editor, and work from its block set
        setRoot(root)
        setBlockSet(set)
    }

    const api = await createEmbedEditor(
        toolboxOf(set, { toolbox, blocks }),
        {
            mode: 'block',
            maxBlocks,
            maxInstances,
            codePreview,
            codeOpen,
            view,
            devices: devices ?? (!view && usesDevices(set, { toolbox, blocks })),
            issues,
            blockTypes: set.blockTypes,
            // Send to Brain only for the real robot's blocks (a library that says it runs there)
            send: set.libraries.some((library) => library.brain),
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
        partBox: api.partBox,
        tracedCode: api.getTracedCode,
        add: api.addBlocks,
        destroy: () => {
            stopPhoneLayout()
            api.dispose()
            root.remove()
        },
    }
}

/**
 * Puts one device's card on a host's page, on its own: the same card the
 * Devices pop-up shows ("fan is a drive motor on port 0 in
 * direction clockwise"), at the toolbox's size, so a lesson can show a
 * motor's setup without an editor. With `onChange` the port and direction
 * can be changed and the name typed; without it the card is read-only.
 * There is no remove or help button.
 * @param {HTMLElement} container Gets the card's root element appended.
 * @param {object} [options]
 * @param {{kind: string, name?: string}} options.device The device, with its
 *     kind's fields (a drive motor's port and direction).
 * @param {(device: object) => void} [options.onChange] The device, after a change.
 * @param {object[]} [options.devices] The program's other devices, for a
 *     kind made from them (a drivetrain's motors).
 * @param {object[]} [options.libraries] Where its kind comes from: [core, make] unless given.
 * @returns {Promise<{
 *   element: HTMLElement,
 *   set: (device: object) => void,
 *   destroy: () => void,
 * }>} `set` shows a changed device (from the host's own controls).
 */
export const mountDeviceCard = async (
    container,
    { device, onChange, devices = [], libraries = DEFAULT_LIBRARIES } = {},
) => {
    await whenEditorFontsReady()
    blockSetFor(libraries)
    if (!deviceKinds[device?.kind]) {
        throw new Error(`No library has a device kind ${device?.kind}`)
    }
    const root = div({ class: 'proto-ide proto-ide-card' })
    // a device saved in an older shape shows as it is now
    const clean = (shown) => ({ ...shown, ...cleanDevice(shown) })
    let current = clean(device)
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
                    { devices },
                ),
            ),
        )
    draw()
    container.append(root)
    return {
        element: root,
        set: (changed) => {
            current = clean({ ...current, ...changed })
            draw()
        },
        destroy: () => root.remove(),
    }
}
