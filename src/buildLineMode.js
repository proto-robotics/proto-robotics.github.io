import { tag, button, on } from 'ellipsi'
import { EditorMode } from './editorMode'
import { functionVocab } from './vocab'

import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { hoverTooltip } from '@codemirror/view'
import { lintGutter, linter } from '@codemirror/lint'

import tooltipHelper from './tooltipHelper'
import {
    claimTooltip,
    releaseTooltip,
    updateTooltip,
    getOwner,
} from './tooltipHelper'

export default (vocab) => {
    const completions = []
    for (const key in functionVocab) {
        // TODO: Should some of this be done in Jenga?
        const entry = functionVocab[key]
        completions.push({
            label: key,
            type: entry.type,
            info: () => {
                claimTooltip('ListAuto', null, entry.description)
                return document.createElement('div')
            },
        })
    }

    const hoverExtension = hoverTooltip((_, pos) => functionInfoTooltip(pos))

    const view = new EditorView({
        state: EditorState.create({
            doc: 'import make\n\n',
            extensions: [
                basicSetup,
                python(),
                oneDark,
                // customLinter, // TODO: restore this linter
                lintGutter(),
                autocompletion({
                    override: [completeFromList(completions)],
                }),
                hoverExtension,
                keymap.of([defaultKeymap, indentWithTab]),
            ],
        }),
    })

    // let code = view.state.doc.toString() // TODO: remove unneeded var
    const setEditorText = (text) => {
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
        })
    }

    let lastHoverRange = null

    view.dom.addEventListener('mousemove', (ev) => {
        if (!lastHoverRange) {
            return
        }
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

    const functionInfoTooltip = (pos) => {
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

    setEditorText(
        'import make' +
            '\n' +
            '# name your motors!' +
            '\n' +
            'left = make.largemotor(6)' +
            '\n' +
            'right = make.largemotor(7)' +
            '\n' +
            '\n' +
            '# spin both motors forwards' +
            '\n' +
            'left.spin(100)' +
            '\n' +
            'right.spin(100)' +
            '\n' +
            '# wait for 2 seconds' +
            '\n' +
            'make.wait(2)' +
            '\n' +
            '# stop both motors' +
            '\n' +
            'left.stop()' +
            '\n' +
            'right.stop()',
    ) // TODO use this method to load the code from the python file

    // The CSS selector used to identify tooltips
    const tooltipSelector =
        '.cm-tooltip-autocomplete.cm-tooltip.cm-tooltip-below'

    const tooltipMutationObserver = new MutationObserver((mutationsList) => {
        let tooltipFound = false

        for (const mutation of mutationsList) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === 1) {
                    setTimeout(() => {
                        const matches = []
                        if (addedNode.matches(tooltipSelector)) {
                            matches.push(addedNode)
                        }
                        matches.push(
                            ...addedNode.querySelectorAll(tooltipSelector),
                        )

                        for (const el of matches) {
                            const rect = el.getBoundingClientRect()
                            claimTooltip(
                                'ListAuto',
                                { x: rect.x + rect.width, y: rect.y },
                                null,
                            )
                            tooltipFound = true
                        }
                    })
                }
            }

            for (const removedNode of mutation.removedNodes) {
                if (removedNode.nodeType === 1) {
                    if (removedNode.matches?.(tooltipSelector)) {
                        releaseTooltip('ListAuto')
                    }
                }
            }
        }

        // TODO: is this code complete?
        if (!tooltipFound) {
            setTimeout(() => {
                document.querySelectorAll(tooltipSelector).forEach((el) => {
                    const rect = el.getBoundingClientRect()
                })
            })
        }
    })

    tooltipMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
    })

    // Holds the output of a python code verification
    const VerifiedOutput = tag('output')

    const VerifyButton = button(
        'Verify',
        on('click', async () => {
            const result = await checkSyntax(view.state.doc.toString())
            console.log('Result:', result)
            if (result.error) {
                console.error('Python Error:', result.error)
            }
            if (result.warnings?.length) {
                console.warn('Python Warnings:', result.warnings)
            }
            VerifiedOutput.replaceChildren(result)
        }),
    )

    const CustomTooltip = tooltipHelper()  // TODO: rename to initTooltip?

    const LineEditor = tag(
        'line-editor',
        VerifyButton,
        view.dom,
        CustomTooltip,
        on('click', () => view.focus()),
    )

    return new EditorMode(
        'line',
        LineEditor,
        () => {}, // TODO: save code
        () => {}, // TODO: load code
    )
}

async function checkSyntax(code) {
    const pyodide = await loadPyodide()

    try {
        await pyodide.runPythonAsync(`
import ast
import warnings

code_str = """${code}"""
error = None
error_line_num = None
error_line_offset = None
warnings_list = []
warnings_linenum = []
warnings_offset = []

# Capture syntax errors
try:
    ast.parse(code_str)
except SyntaxError as e:
    error = e.msg
    error_line_num = e.lineno
    error_line_offset = e.offset

# Capture warnings without executing
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    for warn in w:
        warnings_list.append(str(warn))
        warnings_linenum.append(str(warn.lineno))
        warnings_offset.append(str(warn.offset))

result = {"error": error, "error_line_num": error_line_num, "error_line_offset": error_line_offset, "warnings": warnings_list, "warnings_linenum": warnings_linenum, "warnings_offset": warnings_offset}
`)

        const result = pyodide.globals.get('result').toJs()
        return result
    } catch (err) {
        return { error: `Pyodide internal error: ${err.message}`, warnings: [] }
    }
}
