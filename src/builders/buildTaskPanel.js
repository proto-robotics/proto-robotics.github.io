import { button, div, on, tag } from 'ellipsi'
import { marked } from 'marked'

/**
 * Builds the task panel shown beside the embedded editor: the goal, the
 * instructions (markdown from the host page), the blocks the task needs with
 * a tick on each one already in the workspace, and hints revealed one at a
 * time. Content arrives from the host through the `proto-ide:task` message.
 * @param {object} [options]
 * @param {number} [options.maxBlocks] Block cap in force, shown under the goal.
 * @returns {{
 *   element: HTMLElement,
 *   setTask: (task: object) => void,
 *   setBlockTypes: (types: string[]) => number,
 * }} The panel, a setter for its content, and a setter for the workspace's
 * block types that returns how many required blocks are still missing.
 */
export default ({ maxBlocks = undefined } = {}) => {
    const Goal = tag('h2', { id: 'task-goal' })
    const Limit = div({ id: 'task-limit' })
    if (maxBlocks) {
        Limit.textContent = `Block limit: ${maxBlocks}. The editor will not let you add more.`
    } else {
        Limit.hidden = true
    }
    const Body = div({ id: 'task-body' })
    const BlockList = tag('ul', { id: 'task-blocks' })
    const Blocks = div(
        { id: 'task-blocks-wrap' },
        tag('h3', 'Blocks you need'),
        BlockList,
    )
    const HintButtons = div({ id: 'task-hint-buttons' })
    const HintText = div({ id: 'task-hint-text', role: 'status' })
    const Hints = div(
        { id: 'task-hints' },
        tag('h3', 'Stuck?'),
        HintButtons,
        HintText,
    )

    const element = tag(
        'task-panel',
        { id: 'task-panel', role: 'complementary', 'aria-label': 'Task' },
        tag('small', 'Your goal'),
        Goal,
        Limit,
        Body,
        Blocks,
        Hints,
    )

    /** @type {string[]} Block types the task requires. */
    let required = []
    /** @type {Set<string>} Block types currently in the workspace. */
    let have = new Set()

    const renderBlocks = () => {
        BlockList.replaceChildren(
            ...required.map((name) => {
                const item = tag('li', name)
                item.classList.toggle('have', have.has(name))
                return item
            }),
        )
        Blocks.hidden = required.length === 0
    }

    /**
     * Fills the panel.
     * @param {object} task
     * @param {string} [task.goal] One-sentence goal.
     * @param {string} [task.markdown] Instructions, as markdown.
     * @param {string[]} [task.requiredBlocks] Block types the task needs.
     * @param {string[]} [task.hints] Hints, revealed one at a time.
     */
    const setTask = ({
        goal = '',
        markdown = '',
        requiredBlocks = [],
        hints = [],
    } = {}) => {
        Goal.textContent = goal
        Body.innerHTML = marked.parse(markdown)

        required = [...requiredBlocks]
        renderBlocks()

        HintText.hidden = true
        HintText.textContent = ''
        HintButtons.replaceChildren(
            ...hints.map((hint, index) =>
                button(
                    { type: 'button' },
                    `Hint ${index + 1}`,
                    on('click', (event) => {
                        for (const other of HintButtons.children) {
                            other.classList.toggle(
                                'active',
                                other === event.currentTarget,
                            )
                        }
                        HintText.textContent = hint
                        HintText.hidden = false
                    }),
                ),
            ),
        )
        Hints.hidden = hints.length === 0
    }

    /**
     * Updates the ticks on the required blocks.
     * @param {string[]} types Block types now in the workspace.
     * @returns {number} How many required blocks are still missing.
     */
    const setBlockTypes = (types) => {
        have = new Set(types)
        renderBlocks()
        return required.filter((name) => !have.has(name)).length
    }

    return { element, setTask, setBlockTypes }
}
