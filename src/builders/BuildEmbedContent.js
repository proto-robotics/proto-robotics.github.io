import { button, on, span, tag } from 'ellipsi'

import buildBlockMode from './buildBlockMode'
import { buildBrainButton } from './buildBrainButton'
import buildTaskPanel from './buildTaskPanel'
import { watchHeaderHeight } from './buildSiteChrome'
import { watchPhoneLayout } from '../helpers/phoneLayoutHelper'
import {
    buildCheatSheetContent,
    cheatSheetBlockElementNumbers,
} from './buildCheatSheetContent'
import createCheatSheetDrawer from '../helpers/cheatSheetDrawerHelper'
import { ensureProjectName } from '../helpers/popUpHelper'
import { setDrawerOpen, toggleDrawer } from '../helpers/drawerHelper'

/**
 * Message types exchanged with a page that embeds the editor in an iframe
 * (open the editor with `?embed`). Every message is `{ type, ...detail }`.
 *
 * Sent to the parent:
 *   proto-ide:ready      The editor is mounted and can accept a task/state.
 *   proto-ide:change     { code, blockTypes, state } after every edit. In
 *                        line mode `state` is the source and blockTypes [].
 *   proto-ide:escape     Escape was pressed inside the editor.
 * Accepted from the parent:
 *   proto-ide:task       { goal, markdown, requiredBlocks, hints,
 *                        projectName } fills the task panel beside the
 *                        editor and names the project.
 *   proto-ide:load       { state } replaces the workspace (null clears it).
 *   proto-ide:clear      Removes every block (or resets the source).
 *   proto-ide:cheatsheet { open? } opens or closes the cheatsheet drawer;
 *                        without `open` it toggles.
 *
 * A site that can run the editor's code itself (the library build in
 * src/lib.js) uses createEmbedEditor directly instead and gets these as
 * plain function calls and callbacks.
 *
 * Nothing is kept in local storage in this mode; the host owns the state.
 * The URL parameters in editorParamsHelper.js choose the mode, narrow the
 * toolbox, and cap the block count. With `view=1` the editor is a read-only
 * viewer: no toolbar, task panel, toolbox or cheatsheet, and the Python
 * pane open. It still reports ready and change.
 */
export const embedMessage = {
    ready: 'proto-ide:ready',
    change: 'proto-ide:change',
    task: 'proto-ide:task',
    load: 'proto-ide:load',
    clear: 'proto-ide:clear',
    cheatsheet: 'proto-ide:cheatsheet',
    escape: 'proto-ide:escape',
}

/**
 * Builds the embedded editor: a toolbar (with Send to Brain, the way
 * programs reach the robot), the task drawer on the left, one editor, and
 * the cheatsheet drawer. The host drives it through the returned functions
 * and hears from it through the callbacks.
 * @param {object} toolbox Blockly toolbox configuration (already narrowed).
 * @param {object} options Parsed editor parameters (readEditorParams).
 * @param {object} host
 * @param {HTMLElement} host.root The element that carries the layout
 *     classes: the body on the embed page, the editor's root element in a
 *     library mount.
 * @param {(detail: {code: string, blockTypes: string[], state: object}) => void} [host.onChange]
 * @param {() => void} [host.onEscape]
 * @returns {Promise<{
 *   elements: HTMLElement[],
 *   setTask: (task: object) => void,
 *   setState: (state: object|null) => void,
 *   setCheatsheet: (open?: boolean) => void,
 *   dispose: () => void,
 * }>} The elements to put on the page, in order, and the controls.
 */
export const createEmbedEditor = async (
    toolbox,
    {
        mode = 'block',
        maxBlocks,
        maxInstances,
        codePreview = true,
        codeOpen = false,
        view = false,
    } = {},
    { root, onChange = () => {}, onEscape = () => {} },
) => {
    const taskPanel = buildTaskPanel({ maxBlocks })

    /**
     * Ticks the required blocks that are in the workspace. The host shows
     * how many are still missing in its own words; the tab carries no count.
     * @param {string[]} blockTypes Block types now in the workspace.
     */
    const updateTaskStatus = (blockTypes) => {
        taskPanel.setBlockTypes(blockTypes)
    }

    let editor
    if (mode === 'line') {
        // the line editor brings CodeMirror and the Python checker with it,
        // so it is only loaded when asked for
        const { default: buildLineMode } = await import('./buildLineMode')
        editor = buildLineMode({
            persist: false,
            onChange: ({ code, state }) =>
                onChange({ code, blockTypes: [], state }),
        })
    } else {
        editor = buildBlockMode(toolbox, {
            persist: false,
            lineEditorButton: false,
            maxBlocks,
            maxInstances,
            codePreview,
            codeOpen,
            view,
            // an AudioContext takes seconds to open in an iframe
            sounds: false,
            onChange: ({ code, state }) => {
                const blockTypes = (state.blocks?.blocks ?? []).flatMap(
                    blockTypesIn,
                )
                updateTaskStatus(blockTypes)
                onChange({ code, blockTypes, state })
            },
        })
    }

    const CheatSheetDrawer = createCheatSheetDrawer(
        () =>
            buildCheatSheetContent({
                showPrint: false,
                showOpenFullCheatSheet: false,
            }),
        {
            blockLookup: cheatSheetBlockElementNumbers,
        },
    )

    // ---- the task drawer ---------------------------------------------------

    /**
     * Opens or closes the task drawer.
     * @param {boolean} open Whether the task should show.
     */
    const setTaskOpen = (open) => {
        root.classList.toggle('task-closed', !open)
        TaskDrawer.classList.toggle('open', open)
        TaskToggle.setAttribute('aria-expanded', String(open))
    }

    // The task panel is a drawer on the editor's left, open by default,
    // with a Task tab on its edge like the Code and Cheatsheet drawers on
    // the right. The whole drawer stays hidden until the host sends a task.
    const TaskToggle = button(
        {
            type: 'button',
            id: 'task-toggle',
            class: 'drawer-tab',
            'aria-controls': 'task-panel',
            'aria-expanded': 'false',
        },
        'Task',
        on('click', () =>
            setTaskOpen(root.classList.contains('task-closed')),
        ),
    )
    const TaskDrawer = tag(
        'task-drawer',
        { class: 'drawer' },
        TaskToggle,
        taskPanel.element,
    )
    TaskDrawer.hidden = true
    setTaskOpen(false)

    // ---- toolbar -----------------------------------------------------------

    const ProjectNameInput = tag('input', {
        type: 'text',
        id: 'project-name',
        placeholder: 'Project name...',
        'aria-label': 'Project name',
    })

    const Toolbar = tag(
        'tool-bar',
        ProjectNameInput,
        button(
            'Save',
            on('click', async () => {
                if (await ensureProjectName(ProjectNameInput)) {
                    editor.saveCode(ProjectNameInput)
                }
            }),
        ),
        buildBrainButton({
            getProjectName: () => ProjectNameInput.value,
            getProjectFiles: (projectName) =>
                editor.getProjectFiles(projectName),
        }),
        button(
            'Load',
            on('click', () => editor.loadCode(ProjectNameInput)),
        ),
        button(
            'Cheatsheet',
            on('click', () => toggleDrawer(CheatSheetDrawer)),
        ),
        button(
            'Clear',
            on('click', () => {
                if (window.confirm('Clear this program?')) {
                    editor.setState(null)
                }
            }),
        ),
    )

    // ---- the host's controls -----------------------------------------------

    const setTask = (task) => {
        taskPanel.setTask(task)
        if (typeof task.projectName === 'string') {
            ProjectNameInput.value = task.projectName
        }
        TaskDrawer.hidden = false
        updateTaskStatus([])
        setTaskOpen(true)
    }

    const setState = (state) => editor.setState(state ?? null)

    const setCheatsheet = (open) => {
        if (typeof open === 'boolean') {
            setDrawerOpen(CheatSheetDrawer, open)
        } else {
            toggleDrawer(CheatSheetDrawer)
        }
    }

    // The host cannot always see keys pressed in the editor (an iframe hides
    // them, and the workspace takes focus whenever it is resized), so Escape
    // is reported for the host to act on (leaving a full-screen layout, say).
    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            onEscape()
        }
    }
    root.addEventListener('keydown', onKeyDown)

    const dispose = () => {
        root.removeEventListener('keydown', onKeyDown)
        editor.dispose?.()
    }

    const EditorContainer = span(
        { id: 'editor-container' },
        TaskDrawer,
        editor.EditorElement,
    )

    root.classList.add('embed', `embed-${mode}`)
    if (view) {
        root.classList.add('embed-view')
    }

    const controls = { setTask, setState, setCheatsheet, dispose }

    if (view) {
        // just the editor: the host's page is the chrome
        root.style.setProperty('--header-height', '0px')
        return { elements: [EditorContainer], ...controls }
    }

    const Header = tag('header', Toolbar)
    watchHeaderHeight(Header, root)
    return {
        elements: [Header, EditorContainer, CheatSheetDrawer],
        ...controls,
    }
}

/**
 * Builds the embedded editor page (`?embed`), wired to the page that holds
 * the iframe with postMessage.
 * @param {object} toolbox Blockly toolbox configuration (already narrowed).
 * @param {object} options Parsed editor parameters (readEditorParams).
 * @returns {Promise<HTMLElement[]>} Top-level page elements.
 */
export default async (toolbox, options = {}) => {
    // Messages carry only the learner's own program, so any embedding origin
    // may receive them. Incoming messages are accepted from the parent only.
    const post = (message) => window.parent.postMessage(message, '*')

    const api = await createEmbedEditor(toolbox, options, {
        root: document.body,
        onChange: (detail) => post({ type: embedMessage.change, ...detail }),
        onEscape: () => post({ type: embedMessage.escape }),
    })

    window.addEventListener('message', (event) => {
        if (event.source !== window.parent || !event.data?.type) {
            return
        }
        const { type, ...detail } = event.data

        if (type === embedMessage.task) {
            api.setTask(detail)
        } else if (type === embedMessage.load) {
            api.setState(detail.state ?? null)
        } else if (type === embedMessage.clear) {
            api.setState(null)
        } else if (type === embedMessage.cheatsheet) {
            api.setCheatsheet(detail.open)
        }
    })

    // The parent may only send a state once the workspace exists. Blockly
    // mounts on the first resize, so wait a frame after the elements land.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => post({ type: embedMessage.ready }))
    })

    watchPhoneLayout(document.body)
    return api.elements
}

/**
 * Lists every block type in a serialized block and the blocks nested in it.
 * @param {object} block One entry of Blockly's serialized `blocks.blocks`.
 * @returns {string[]} Block type names, including nested and following blocks.
 */
export const blockTypesIn = (block) => {
    const types = [block.type]
    for (const input of Object.values(block.inputs ?? {})) {
        if (input.block) {
            types.push(...blockTypesIn(input.block))
        }
    }
    if (block.next?.block) {
        types.push(...blockTypesIn(block.next.block))
    }
    return types
}
