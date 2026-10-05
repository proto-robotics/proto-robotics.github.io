import { button, on, span, tag } from 'ellipsi'

import buildBlockMode from './buildBlockMode'
import buildLineMode from './buildLineMode'
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
 * Message types exchanged with the page that embeds the editor in an iframe
 * (open the editor with `?embed`). Every message is `{ type, ...detail }`.
 *
 * Sent to the parent:
 *   proto-ide:ready      The editor is mounted and can accept a task/state.
 *   proto-ide:change     { code, blockTypes, state } after every edit. In
 *                        line mode `state` is the source and blockTypes [].
 * Accepted from the parent:
 *   proto-ide:task       { goal, markdown, requiredBlocks, hints,
 *                        projectName } fills the task panel beside the
 *                        editor and names the project.
 *   proto-ide:load       { state } replaces the workspace (null clears it).
 *   proto-ide:clear      Removes every block (or resets the source).
 *   proto-ide:cheatsheet { open? } opens or closes the cheatsheet drawer;
 *                        without `open` it toggles.
 *
 * Nothing is kept in local storage in this mode; the parent owns the state.
 * The URL parameters in editorParamsHelper.js choose the mode, narrow the
 * toolbox, and cap the block count.
 */
export const embedMessage = {
    ready: 'proto-ide:ready',
    change: 'proto-ide:change',
    task: 'proto-ide:task',
    load: 'proto-ide:load',
    clear: 'proto-ide:clear',
    cheatsheet: 'proto-ide:cheatsheet',
}

/**
 * Builds the embedded editor page: a toolbar, the task panel, one editor,
 * and the cheatsheet drawer, wired to the host page with postMessage.
 * @param {object} toolbox Blockly toolbox configuration (already narrowed).
 * @param {object} options Parsed editor parameters (readEditorParams).
 * @returns {HTMLElement[]} Top-level page elements.
 */
export default (
    toolbox,
    { mode = 'block', maxBlocks, maxInstances, codePreview = true } = {},
) => {
    // Messages carry only the learner's own program, so any embedding origin
    // may receive them. Incoming messages are accepted from the parent only.
    const post = (message) => window.parent.postMessage(message, '*')

    const taskPanel = buildTaskPanel({ maxBlocks })
    const TaskBadge = span({ id: 'task-badge' })
    TaskBadge.hidden = true

    /**
     * Shows how many required blocks are still missing on the Task button.
     * @param {string[]} blockTypes Block types now in the workspace.
     */
    const updateTaskStatus = (blockTypes) => {
        const missing = taskPanel.setBlockTypes(blockTypes)
        TaskBadge.textContent = String(missing)
        TaskBadge.hidden = missing === 0
    }

    const editor =
        mode === 'line'
            ? buildLineMode({
                  persist: false,
                  onChange: ({ code, state }) => {
                      post({
                          type: embedMessage.change,
                          code,
                          blockTypes: [],
                          state,
                      })
                  },
              })
            : buildBlockMode(toolbox, {
                  persist: false,
                  lineEditorButton: false,
                  maxBlocks,
                  maxInstances,
                  codePreview,
                  onChange: ({ code, state }) => {
                      const blockTypes = (state.blocks?.blocks ?? []).flatMap(
                          blockTypesIn,
                      )
                      updateTaskStatus(blockTypes)
                      post({
                          type: embedMessage.change,
                          code,
                          blockTypes,
                          state,
                      })
                  },
              })

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

    // ---- toolbar ---------------------------------------------------------

    /**
     * Opens or closes the task panel.
     * @param {boolean} open Whether the panel should be visible.
     */
    const setTaskOpen = (open) => {
        document.body.classList.toggle('task-closed', !open)
        TaskToggle.setAttribute('aria-expanded', String(open))
        TaskToggle.classList.toggle('active', open)
    }

    const TaskToggle = button(
        {
            type: 'button',
            id: 'task-toggle',
            'aria-controls': 'task-panel',
            'aria-expanded': 'false',
        },
        'Task',
        TaskBadge,
        on('click', () =>
            setTaskOpen(document.body.classList.contains('task-closed')),
        ),
    )
    TaskToggle.hidden = true
    setTaskOpen(false)

    const ProjectNameInput = tag('input', {
        type: 'text',
        id: 'project-name',
        placeholder: 'Project name...',
        'aria-label': 'Project name',
    })

    const Toolbar = tag(
        'tool-bar',
        TaskToggle,
        ProjectNameInput,
        button(
            'Save',
            on('click', async () => {
                if (await ensureProjectName(ProjectNameInput)) {
                    editor.saveCode(ProjectNameInput)
                }
            }),
        ),
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

    // ---- messages from the host --------------------------------------------

    window.addEventListener('message', (event) => {
        if (event.source !== window.parent || !event.data?.type) {
            return
        }
        const { type, ...detail } = event.data

        if (type === embedMessage.task) {
            taskPanel.setTask(detail)
            if (typeof detail.projectName === 'string') {
                ProjectNameInput.value = detail.projectName
            }
            TaskToggle.hidden = false
            updateTaskStatus([])
            setTaskOpen(true)
        } else if (type === embedMessage.load) {
            editor.setState(detail.state ?? null)
        } else if (type === embedMessage.clear) {
            editor.setState(null)
        } else if (type === embedMessage.cheatsheet) {
            if (typeof detail.open === 'boolean') {
                setDrawerOpen(CheatSheetDrawer, detail.open)
            } else {
                toggleDrawer(CheatSheetDrawer)
            }
        }
    })

    const EditorContainer = span(
        { id: 'editor-container' },
        taskPanel.element,
        editor.EditorElement,
    )

    document.body.classList.add('embed', `embed-${mode}`)

    // The parent may only send a state once the workspace exists. Blockly
    // mounts on the first resize, so wait a frame after the elements land.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => post({ type: embedMessage.ready }))
    })

    const Header = tag('header', Toolbar)
    watchHeaderHeight(Header)
    watchPhoneLayout()
    return [Header, EditorContainer, CheatSheetDrawer]
}

/**
 * Lists every block type in a serialized block and the blocks nested in it.
 * @param {object} block One entry of Blockly's serialized `blocks.blocks`.
 * @returns {string[]} Block type names, including nested and following blocks.
 */
const blockTypesIn = (block) => {
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
