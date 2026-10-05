/*
 * The coding page: the top bar with the toolbar, one of the two editors
 * (block or line, switchable), and the cheatsheet drawer.
 */

import { button, header, on, span, tag } from 'ellipsi'

import buildBlockMode from './buildBlockMode'
import { buildBrainButton } from './buildBrainButton'
import {
    buildCheatSheetContent,
    cheatSheetBlockElementNumbers,
} from './buildCheatSheetContent'
import buildLineMode from './buildLineMode'
import { buildSiteNav, watchHeaderHeight } from './buildSiteChrome'
import { EditorMode } from '../classes/editorMode'
import createCheatSheetDrawer from '../helpers/cheatSheetDrawerHelper'
import { watchPhoneLayout } from '../helpers/phoneLayoutHelper'
import { ensureProjectName } from '../helpers/popUpHelper'

/**
 * Builds the coding page and its two editor modes.
 * @param {object} toolbox Blockly toolbox configuration.
 * @param {object} [options] Parsed editor parameters (readEditorParams).
 *     `mode` picks the starting editor when the URL names one; the block
 *     limits apply to the block editor.
 * @returns {HTMLElement[]} Top-level page elements.
 */
export default (
    toolbox,
    { maxBlocks, maxInstances, codePreview = true } = {},
) => {
    const blockMode = buildBlockMode(toolbox, {
        maxBlocks,
        maxInstances,
        codePreview,
    })
    const lineMode = buildLineMode()

    /** @type {EditorMode} The current editor mode. */
    let currentMode = null
    /** Container holding whichever editor mode is active. */
    const EditorContainer = span({ id: 'editor-container' })

    /**
     * Swaps the current editor.
     * @param {EditorMode|null} targetMode Target mode, or null to toggle modes.
     */
    const switchEditor = (targetMode = null) => {
        if (currentMode) {
            currentMode.saveState()
        }

        if (targetMode !== null) {
            currentMode = targetMode
        } else if (currentMode === blockMode) {
            currentMode = lineMode
        } else {
            currentMode = blockMode
        }

        EditorContainer.replaceChildren(currentMode.EditorElement)
        localStorage.setItem('editorMode', currentMode.name)
        currentMode.loadState()
    }

    document.addEventListener('switch-editor', () => {
        switchEditor()
    })

    // The initial editor: the URL's mode wins, then the last one used.
    const requestedMode = new URLSearchParams(window.location.search).get(
        'mode',
    )
    const previousModeName = requestedMode ?? localStorage.getItem('editorMode')
    if (previousModeName === lineMode.name) {
        switchEditor(lineMode)
    } else {
        switchEditor(blockMode)
    }

    // ---- the toolbar ---------------------------------------------------------

    const ProjectNameInput = tag(
        'input',
        { type: 'text', placeholder: 'Project name...' },
        on('change', () =>
            localStorage.setItem('projectName', ProjectNameInput.value),
        ),
    )
    const previousProjectName = localStorage.getItem('projectName')
    if (previousProjectName) {
        ProjectNameInput.value = previousProjectName
    }

    /** Shows or hides the block editor's minimap; remembered like the mode. */
    const setMinimap = (wanted) => {
        blockMode.setMinimap(wanted)
        MinimapToggle.classList.toggle('active', wanted)
        MinimapToggle.setAttribute('aria-pressed', String(wanted))
        localStorage.setItem('minimap', wanted ? 'on' : 'off')
    }
    const MinimapToggle = button(
        'Minimap',
        { type: 'button', 'aria-pressed': 'false' },
        on('click', () =>
            setMinimap(MinimapToggle.getAttribute('aria-pressed') !== 'true'),
        ),
    )
    setMinimap(localStorage.getItem('minimap') === 'on')

    const Toolbar = tag(
        'tool-bar',
        ProjectNameInput,
        button(
            'Save',
            on('click', async () => {
                if (await ensureProjectName(ProjectNameInput)) {
                    currentMode.saveCode(ProjectNameInput)
                }
            }),
        ),
        buildBrainButton({
            getProjectName: () => ProjectNameInput.value,
            getProjectFiles: (projectName) =>
                currentMode.getProjectFiles(projectName),
        }),
        button(
            'Load',
            on('click', () => currentMode.loadCode(ProjectNameInput)),
        ),
        MinimapToggle,
        button(
            'Switch Editor',
            on('click', () => switchEditor()),
        ),
    )

    // ---- the page ------------------------------------------------------------

    // One bar: the brand, then the toolbar, then the copyright. The
    // cheatsheet is reached through its drawer, so there are no links.
    const Header = header(
        buildSiteNav({ tagline: 'Code Editor', controls: [Toolbar] }),
    )
    watchHeaderHeight(Header)
    watchPhoneLayout()

    const CheatSheetDrawer = createCheatSheetDrawer(
        () =>
            buildCheatSheetContent({
                showPrint: false,
                showOpenFullCheatSheet: true,
            }),
        {
            blockLookup: cheatSheetBlockElementNumbers,
        },
    )

    // the editor fills the window; the page itself never scrolls
    document.body.classList.add('editor')

    return [Header, EditorContainer, CheatSheetDrawer]
}
