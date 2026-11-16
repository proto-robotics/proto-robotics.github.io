/*
 * The Issues drawer: a tab on the right of the editor that opens a list of
 * the program's problems, coloured by the worst of them (error, warning,
 * info). The line editor fills it from Pyrefly's diagnostics; the block
 * editor from the block linter (mods/blockLinter.js).
 */

import { button, on, tag } from 'ellipsi'

import { createDrawer } from './drawerHelper'

/** How many issues the list shows before "N more issues". */
const SHOWN = 5

/**
 * One problem with the program.
 * @typedef {object} Issue
 * @property {'error'|'warning'|'info'} severity
 * @property {string} message What is wrong and how to fix it.
 * @property {string} [where] Where it is: "Line 3", "Spin block".
 * @property {() => void} [onClick] Shows where it is.
 */

/**
 * @param {string} severity
 * @returns {'error'|'warning'|'info'} A severity the drawer has a colour for.
 */
const severityOf = (severity) =>
    severity === 'warning' || severity === 'info' ? severity : 'error'

/**
 * @param {Issue[]} issues
 * @returns {{error: number, warning: number, info: number}} How many of each.
 */
export const countBySeverity = (issues = []) => {
    const counts = { error: 0, warning: 0, info: 0 }
    for (const issue of issues) {
        counts[severityOf(issue.severity)] += 1
    }
    return counts
}

/**
 * @param {Issue[]} issues
 * @returns {string} "2 errors, 1 warning found", or "No issues".
 */
const statusText = (issues) => {
    const { error, warning, info } = countBySeverity(issues)
    const parts = []
    if (error) {
        parts.push(`${error} error${error === 1 ? '' : 's'}`)
    }
    if (warning) {
        parts.push(`${warning} warning${warning === 1 ? '' : 's'}`)
    }
    if (info) {
        parts.push(`${info} info${info === 1 ? '' : 's'}`)
    }
    return parts.length ? `${parts.join(', ')} found` : 'No issues'
}

/**
 * Creates the Issues drawer.
 * @returns {{
 *   drawer: HTMLElement,
 *   tab: HTMLButtonElement,
 *   show: (issues: Issue[]) => void,
 *   checking: () => void,
 * }} `show` lists the issues (none: "No issues"); `checking` says a check
 *     is under way.
 */
export const createIssuesDrawer = () => {
    const Status = tag(
        'span',
        { id: 'verify-status', role: 'status', 'aria-live': 'polite' },
        'Not checked',
    )
    const List = tag('div', { id: 'verify-issues' })
    const { drawer, tab } = createDrawer({
        elementName: 'issues-drawer',
        tabId: 'issues-drawer-tab',
        panelId: 'issues-drawer-panel',
        tabLabel: 'Issues',
        panelContent: [tag('h2', 'Issues'), Status, List],
    })
    // a click in the drawer is not a click on the editor under it
    drawer.addEventListener('click', (event) => event.stopPropagation())

    const setStatus = (status, message) => {
        Status.textContent = message
        Status.dataset.status = status
        drawer.dataset.status = status
    }

    const item = (issue) => {
        const text = issue.where
            ? `${issue.where}: ${issue.message}`
            : issue.message
        const className = `verify-issue verify-issue-${severityOf(issue.severity)}`
        return issue.onClick
            ? button(
                  { type: 'button', class: `${className} verify-issue-link` },
                  text,
                  on('click', issue.onClick),
              )
            : tag('div', { class: className }, text)
    }

    const show = (issues = []) => {
        List.replaceChildren(...issues.slice(0, SHOWN).map(item))
        if (issues.length > SHOWN) {
            const more = issues.length - SHOWN
            List.append(
                tag(
                    'div',
                    { class: 'verify-issue verify-issue-more' },
                    `${more} more issue${more === 1 ? '' : 's'}`,
                ),
            )
        }
        tab.textContent = issues.length ? `Issues (${issues.length})` : 'Issues'
        const { error, warning } = countBySeverity(issues)
        setStatus(
            !issues.length
                ? 'success'
                : error
                  ? 'error'
                  : warning
                    ? 'warning'
                    : 'info',
            statusText(issues),
        )
    }

    const checking = () => {
        setStatus('checking', 'Checking...')
        tab.textContent = 'Checking'
        List.replaceChildren()
    }

    return { drawer, tab, show, checking }
}
