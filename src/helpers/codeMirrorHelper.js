import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completeFromList,
    completionKeymap,
} from '@codemirror/autocomplete'
import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
} from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { linter, lintGutter, lintKeymap } from '@codemirror/lint'
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    hoverTooltip,
    keymap,
    lineNumbers,
    rectangularSelection,
} from '@codemirror/view'
import { EditorView } from 'codemirror'
import { tomorrow } from 'thememirror'

import { div } from 'ellipsi'

import { functionVocab } from '../data/vocab'
import { claimTooltip, getOwner, releaseTooltip } from './tooltipHelper'
import { EditorSelection, EditorState } from '@codemirror/state'
import {
    bracketMatching,
    defaultHighlightStyle,
    foldGutter,
    foldKeymap,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'

export const newView = (
    { readonly, noGutter } = { readonly: false, noGutter: false },
) => {
    let verifiedOutput = null
    let lastHoverRange = null
    let completions = []

    for (const [label, entry] of Object.entries(functionVocab)) {
        completions.push({
            label: label,
            type: entry.type,
            info: () => {
                if (getOwner() != 'ListAuto') {
                    claimTooltip(
                        'ListAuto',
                        { x: -999, y: -9999 },
                        entry.description,
                    )
                } else {
                    claimTooltip('ListAuto', null, entry.description)
                }
                return div()
            },
        })
    }

    const customLinter = linter((view) => {
        let diagnostics = []
        const verified = verifiedOutput

        if (verified?.error) {
            diagnostics.push({
                from: view.state.doc.line(verified.error_line_num).from,
                to:
                    view.state.doc.line(verified.error_line_num).from +
                    verified.error_line_offset,
                severity: 'error',
                message: verified.error,
            })
        }

        if (verified?.warnings?.length) {
            for (const warning of verified.warnings) {
                diagnostics.push({
                    from: 0,
                    to: 0,
                    severity: 'warning',
                    message: warning,
                })
            }
        }
        return diagnostics
    })

    const functionInfoTooltip = (view, pos) => {
        if (getOwner() != null) {
            return null
        }
        const word = view.state.wordAt(pos)
        if (!word) {
            lastHoverRange = null
            return null
        }
        const hoveredText = view.state.sliceDoc(word.from, word.to)
        const found = completions.find(
            (c) =>
                c.label === hoveredText || c.label.endsWith('.' + hoveredText),
        )
        if (!found) {
            lastHoverRange = null
            return null
        }
        lastHoverRange = { from: word.from, to: word.to }
        claimTooltip(
            'FuncDescript',
            { x: view.coordsAtPos(pos).left, y: view.coordsAtPos(pos).top },
            functionVocab[found.label].description,
        )
    }

    const extensions = [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap,
            indentWithTab,
        ]),
        python(),
        tomorrow,
        customLinter,
        autocompletion({
            override: [completeFromList(completions)],
        }),
        hoverTooltip(functionInfoTooltip),
    ]

    if (!noGutter) {
        extensions.push(lineNumbers())
        extensions.push(highlightActiveLineGutter())
        extensions.push(lintGutter())
    }

    if (readonly) {
        extensions.push(EditorState.readOnly.of(true))
        extensions.push(EditorView.editable.of(false))
    }

    const view = new EditorView({
        doc: 'import make\n\n',
        extensions: extensions,
    })

    view.dom.addEventListener('mousemove', (ev) => {
        if (!lastHoverRange) return
        const coords = { x: ev.clientX, y: ev.clientY }
        const pos = view.posAtCoords(coords)

        const outsideRange =
            pos === null || pos < lastHoverRange.from || pos > lastHoverRange.to

        if (outsideRange) {
            releaseTooltip('FuncDescript')
            lastHoverRange = null
        }
    })

    view.dom.addEventListener('keyup', (ev) => {
        releaseTooltip('FuncDescript')
    })

    view.dom.addEventListener('perform-linting', (ev) => {
        verifiedOutput = ev.detail

        const pos = view.state.selection.main.head
        // Add and remove a space to force linting
        let storeCurrent = view.state.doc.toString()
        setViewText(view, storeCurrent + ' ')
        setViewText(view, storeCurrent)
        // Refocus previous line
        view.dispatch({
            selection: EditorSelection.cursor(pos),
        })
    })

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === 1) {
                    setTimeout(() => {
                        if (
                            addedNode.matches(
                                'div.cm-tooltip.cm-completionInfo',
                            )
                        ) {
                            const rect = addedNode.getBoundingClientRect()
                            claimTooltip(
                                'ListAuto',
                                { x: rect.x + rect.width, y: rect.y },
                                null,
                            )
                        }
                    }, 10)
                }
            }

            for (const removedNode of mutation.removedNodes) {
                if (removedNode.nodeType === 1) {
                    if (
                        removedNode.matches?.(
                            'div.cm-tooltip-autocomplete.cm-tooltip',
                        )
                    ) {
                        releaseTooltip('ListAuto')
                    }
                }
            }
        }
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
    })

    return view
}

export const getViewText = (view) => {
    return view.state.doc.toString()
}

export const setViewText = (view, text) => {
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    })
}
