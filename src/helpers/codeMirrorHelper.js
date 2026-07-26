import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
    acceptCompletion,
    snippetCompletion,
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

const editorApi = pythonLibraryVocab.autocomplete

const createCompletionInfo = (description) => {
    const info = document.createElement('div')
    info.innerHTML = marked.parse(description ?? '')
    return info
}

const createCallTemplate = (path, parameters) => {
    let placeholder = 1
    const args = parameters.map((parameter) => {
        if (parameter.required) {
            return `${parameter.name}=\${${placeholder++}}`
        }
        return `${parameter.name}=${parameter.default}`
    })
    return `${path}(${args.join(', ')})`
}

const createCallLabel = (path, parameters) =>
    `${path}(${parameters
        .map((parameter) =>
            parameter.required
                ? `${parameter.name}=`
                : `${parameter.name}=${parameter.default}`,
        )
        .join(', ')})`

const createCallCompletions = (entry) => {
    const required = entry.parameters.filter((parameter) => parameter.required)
    const optional = entry.parameters.filter((parameter) => !parameter.required)
    return Array.from({ length: optional.length + 1 }, (_, index) => {
        const parameters = [...required, ...optional.slice(0, index)]
        const template = createCallTemplate(entry.path ?? entry.name, parameters)
        return snippetCompletion(template, {
            label: createCallLabel(entry.path ?? entry.name, parameters),
            type: entry.kind === 'constructor' ? 'class' : 'function',
            detail: entry.description?.split('\n')[0],
            info: () => createCompletionInfo(entry.description),
        })
    })
}

const collectCodeAutoCompleteEntries = () =>
    editorApi.members.flatMap(createCallCompletions)

const collectMethodCompletionEntries = () => {
    const byClass = {}
    const allMethods = new Map()

    for (const [className, methods] of Object.entries(editorApi.methodsByType ?? {})) {
        byClass[className] = methods.flatMap((method) =>
            createCallCompletions({ ...method, kind: 'method' }),
        )

        for (const method of methods) {
            for (const completion of createCallCompletions({
                ...method,
                kind: 'method',
            })) {
                if (!allMethods.has(completion.label)) {
                    allMethods.set(completion.label, completion)
                }
            }
        }
    }

    return { byClass, allMethods: Array.from(allMethods.values()) }
}

const findActiveCall = (context) => {
    const beforeCursor = context.state.doc.sliceString(
        context.state.doc.lineAt(context.pos).from,
        context.pos,
    )
    const match = beforeCursor.match(/(?:^|[^\w.])((?:make\.)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\(([^()]*)$/)
    if (!match) return null

    return { callee: match[1], argumentsText: match[2] }
}

const createParameterCompletions = (entry, argumentsText) => {
    const used = new Set(
        Array.from(argumentsText.matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*=/g)).map(
            (match) => match[1],
        ),
    )
    return entry.parameters
        .filter((parameter) => !used.has(parameter.name))
        .map((parameter) => {
            const value = parameter.required ? '${1}' : parameter.default
            return snippetCompletion(`${parameter.name}=${value}`, {
                label: `${parameter.name}=${parameter.required ? '' : parameter.default}`,
                type: 'property',
                info: () => createCompletionInfo(entry.description),
            })
        })
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
    const activeCall = findActiveCall(context)
    if (activeCall && /(?:^|,)\s*[A-Za-z_]*$/.test(activeCall.argumentsText)) {
        let callable = editorApi.members.find(
            (entry) => entry.path === activeCall.callee,
        )

        if (!callable) {
            const [receiver, methodName] = activeCall.callee.split('.')
            const receiverType = inferVariableTypes(
                context.state.doc.sliceString(0, context.pos),
            ).get(receiver)
            callable = editorApi.methodsByType?.[receiverType]?.find(
                (method) => method.name === methodName,
            )
        }

        if (callable) {
            return {
                from: context.pos,
                options: createParameterCompletions(
                    callable,
                    activeCall.argumentsText,
                ),
            }
        }
    }

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
            : []

        return {
            from: memberFrom,
            options: options ?? [],
        }
    }

    return {
        from: word.from,
        options: completions,
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
    {
        readonly,
        noGutter,
    } = { readonly: false, noGutter: false },
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
