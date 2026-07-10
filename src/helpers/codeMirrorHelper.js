import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
    acceptCompletion,
} from '@codemirror/autocomplete'
import {
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
} from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import {
    globalCompletion,
    localCompletionSource,
} from '@codemirror/lang-python'
import { linter, lintGutter, lintKeymap, setDiagnostics } from '@codemirror/lint'
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    rectangularSelection,
} from '@codemirror/view'
import { EditorView } from 'codemirror'
import { marked } from 'marked'
import { tomorrow } from 'thememirror'

import { library } from '../data/library'
import pythonLibraryVocab from '../data/pythonLibraryVocab.json'
import { EditorState } from '@codemirror/state'
import {
    bracketMatching,
    defaultHighlightStyle,
    foldKeymap,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'

const createCompletionInfo = (description) => {
    const info = document.createElement('div')
    info.innerHTML = marked.parse(description ?? '')
    return info
}

const createCodeMirrorCompletion = (entry) => ({
    label: entry.label,
    type: entry.type,
    info: () => createCompletionInfo(entry.description),
})

const collectCodeAutoCompleteEntries = () => {
    const entries = new Map()
    const addEntries = (codeAutoComplete) => {
        const normalizedEntries = Array.isArray(codeAutoComplete)
            ? codeAutoComplete.map((entry) => [entry.label, entry])
            : Object.entries(codeAutoComplete ?? {})

        for (const [label, entry] of normalizedEntries) {
            if (!label) {
                continue
            }

            entries.set(label, {
                label,
                type: entry.type,
                info: () => createCompletionInfo(entry.description),
            })
        }
    }

    addEntries(pythonLibraryVocab.completions)

    const categories = Array.isArray(library) ? library : [library]

    for (const category of categories) {
        addEntries(category.codeAutoComplete)

        for (const block of category.entries) {
            addEntries(block.codeAutoComplete)
            addEntries(block.autocompletions)
        }
    }

    return Array.from(entries.values())
}

const collectMethodCompletionEntries = () => {
    const byClass = {}
    const allMethods = new Map()

    for (const [className, methods] of Object.entries(
        pythonLibraryVocab.methodCompletionsByClass ?? {},
    )) {
        byClass[className] = methods.map(createCodeMirrorCompletion)

        for (const method of methods) {
            if (!allMethods.has(method.label)) {
                allMethods.set(method.label, createCodeMirrorCompletion(method))
            }
        }
    }

    return { byClass, allMethods: Array.from(allMethods.values()) }
}

const inferVariableTypes = (code) => {
    const variableTypes = new Map()
    const constructorAssignment =
        /(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*make\.([A-Za-z_]\w*)\s*\(/g
    const annotatedAssignment =
        /(?:^|\n)\s*([A-Za-z_]\w*)\s*:\s*(?:make\.)?([A-Za-z_]\w*)\s*(?:=|\n|$)/g

    for (const match of code.matchAll(constructorAssignment)) {
        variableTypes.set(match[1], match[2])
    }

    for (const match of code.matchAll(annotatedAssignment)) {
        variableTypes.set(match[1], match[2])
    }

    return variableTypes
}

const createCodeAutoCompleteSource = (completions, methodCompletions) => (context) => {
    const word = context.matchBefore(/[\w.]*/)
    if (!word || (word.from === word.to && !context.explicit)) {
        return null
    }

    const completionText = word.text
    const dotIndex = completionText.lastIndexOf('.')

    if (dotIndex !== -1) {
        const receiver = completionText.slice(0, dotIndex)
        const memberFrom = word.from + dotIndex + 1

        if (receiver === 'make') {
            return {
                from: word.from,
                options: completions.filter((completion) =>
                    completion.label.startsWith('make.'),
                ),
            }
        }

        const variableTypes = inferVariableTypes(
            context.state.doc.sliceString(0, word.from),
        )
        const receiverType = variableTypes.get(receiver)
        const options = receiverType
            ? methodCompletions.byClass[receiverType]
            : methodCompletions.allMethods

        return {
            from: memberFrom,
            options: options ?? [],
        }
    }

    return {
        from: word.from,
        options: completions.filter(
            (completion) => completion.type !== 'method',
        ),
    }
}

const createLintDiagnostics = (view, verified) => {
    let diagnostics = []

    if (verified?.diagnostics?.length) {
        for (const diagnostic of verified.diagnostics) {
            if (
                typeof diagnostic.from === 'number' &&
                typeof diagnostic.to === 'number'
            ) {
                const from = Math.max(
                    0,
                    Math.min(diagnostic.from, view.state.doc.length),
                )
                const to = Math.max(
                    from + 1,
                    Math.min(diagnostic.to, view.state.doc.length),
                )

                diagnostics.push({
                    from,
                    to,
                    severity: diagnostic.severity ?? 'error',
                    message: diagnostic.message,
                })
                continue
            }

            const lineNumber = Math.min(
                Math.max(diagnostic.line ?? 1, 1),
                view.state.doc.lines,
            )
            const line = view.state.doc.line(lineNumber)
            const offset = diagnostic.column ?? 1

            diagnostics.push({
                from: line.from,
                to: Math.min(line.to, line.from + offset),
                severity: diagnostic.severity ?? 'error',
                message: diagnostic.message,
            })
        }
    }

    if (!verified?.diagnostics?.length && verified?.error) {
        const lineNumber = Math.min(
            Math.max(verified.error_line_num ?? 1, 1),
            view.state.doc.lines,
        )
        const line = view.state.doc.line(lineNumber)
        const offset = verified.error_line_offset ?? 1

        diagnostics.push({
            from: line.from,
            to: Math.min(line.to, line.from + offset),
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
}

export const createCodeMirrorView = (
    { readonly, noGutter } = { readonly: false, noGutter: false },
) => {
    let verifiedOutput = null
    const completions = collectCodeAutoCompleteEntries()
    const methodCompletions = collectMethodCompletionEntries()

    const customLinter = linter((view) =>
        createLintDiagnostics(view, verifiedOutput),
    )

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
        highlightSelectionMatches(),
        keymap.of([
            { key: 'Tab', run: acceptCompletion },
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
            override: [
                createCodeAutoCompleteSource(completions, methodCompletions),
                localCompletionSource,
                globalCompletion,
            ],
        }),
    ]

    if (!noGutter) {
        extensions.push(lineNumbers())
        extensions.push(highlightActiveLineGutter())
        extensions.push(lintGutter())
    }

    if (readonly) {
        extensions.push(EditorState.readOnly.of(true))
        extensions.push(EditorView.editable.of(false))
    } else {
        extensions.push(highlightActiveLine())
    }

    const view = new EditorView({
        doc: 'import make\n\n',
        extensions: extensions,
    })

    view.dom.addEventListener('perform-linting', (ev) => {
        verifiedOutput = ev.detail
        view.dispatch(
            setDiagnostics(view.state, createLintDiagnostics(view, verifiedOutput)),
        )
    })

    return view
}

export const getCodeMirrorText = (view) => {
    return view.state.doc.toString()
}

export const setCodeMirrorText = (view, text) => {
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    })
}
