import { tag, button, on } from 'ellipsi'
import { EditorMode } from './editorMode'
import { functionVocab } from './vocab'

import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { hoverTooltip } from '@codemirror/view'
import { lintGutter, linter } from '@codemirror/lint'

import {
    claimTooltip,
    releaseTooltip,
    updateTooltip,
    getOwner,
} from './tooltipHelper'

let lastHoverRange = null
let completions = []
let view

let verifiedOutput

export default (vocab) => {
    const LineEditor = tag(
        'line-editor',
        button(
            'Verify',
            on('click', () => {
                ;(async () => {
                    const result = await checkSyntax(view.state.doc.toString())
                    console.log('Result:', result)
                    if (result.error)
                        console.error('Python Error:', result.error)
                    if (result.warnings?.length)
                        console.warn('Python Warnings:', result.warnings)
                    verifiedOutput = result
                    const pos = view.state.selection.main.head

                    let storeCurrent = view.state.doc.toString()
                    setEditorText(view, storeCurrent + ' ')
                    setEditorText(view, storeCurrent)

                    view.dispatch({
                        selection: EditorSelection.cursor(pos),
                    })
                })()
            }),
        ),
    )

    for (const key in functionVocab) {
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

    const hoverExtension = hoverTooltip(functionInfoTooltip)

    view = new EditorView({
        state: EditorState.create({
            doc: 'import make\n\n',
            extensions: [
                basicSetup,
                python(),
                oneDark,
                customLinter,
                lintGutter(),
                autocompletion({
                    override: [completeFromList(completions)],
                }),
                hoverExtension,
                keymap.of([defaultKeymap, indentWithTab]),
            ],
        }),
        parent: LineEditor,
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

    function setEditorText(view, text) {
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
        })
    }

    setEditorText(
        view,
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
    if (LineEditor) {
        LineEditor.addEventListener('click', () => {
            view.focus()
        })
    } else {
        console.error('Could not find code editor container or input element.')
    }

    const targetNode = document.body
    const selector = '.cm-tooltip-autocomplete.cm-tooltip.cm-tooltip-below'

    const observer = new MutationObserver((mutationsList) => {
        let tooltipFound = false

        for (const mutation of mutationsList) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === 1) {
                    setTimeout(() => {
                        const matches = []
                        if (addedNode.matches(selector)) {
                            matches.push(addedNode)
                        }
                        matches.push(...addedNode.querySelectorAll(selector))

                        for (const el of matches) {
                            const rect = el.getBoundingClientRect()
                            claimTooltip(
                                'ListAuto',
                                { x: rect.x + rect.width, y: rect.y },
                                null,
                            )
                            tooltipFound = true
                        }
                    }, 0)
                }
            }

            for (const removedNode of mutation.removedNodes) {
                if (removedNode.nodeType === 1) {
                    if (removedNode.matches?.(selector)) {
                        releaseTooltip('ListAuto')
                    }
                }
            }
        }

        if (!tooltipFound) {
            setTimeout(() => {
                document.querySelectorAll(selector).forEach((el) => {
                    const rect = el.getBoundingClientRect()
                })
            }, 0)
        }
    })

    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
    })

    return new EditorMode(
        'line',
        LineEditor,
        () => {},
        () => {},
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

function functionInfoTooltip(view, pos) {
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
        (c) => c.label === hoveredText || c.label.endsWith('.' + hoveredText),
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
