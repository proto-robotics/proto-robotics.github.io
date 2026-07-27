/*
 * Creates Python CodeMirror views and translates the generated API vocabulary
 * into autocomplete and lint behavior. Read-only views reuse only the display
 * portion of the configuration.
 */

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
import {
    bracketMatching,
    defaultHighlightStyle,
    foldKeymap,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language'
import {
    globalCompletion,
    localCompletionSource,
    python,
} from '@codemirror/lang-python'
import {
    linter,
    lintGutter,
    lintKeymap,
    setDiagnostics,
} from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
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

const autocompleteApi = pythonLibraryVocab.autocomplete

/**
 * Renders API documentation in a completion panel.
 * @param {string} description Markdown API description.
 * @returns {HTMLDivElement} Rendered completion information.
 */
function renderCompletionDocumentation(description) {
    const info = document.createElement('div')
    info.innerHTML = marked.parse(description ?? '')
    return info
}

/**
 * Creates a CodeMirror snippet, leaving required arguments as tab stops.
 * @param {string} path Callable name or path.
 * @param {object[]} parameters Parameters included in the call.
 * @returns {string} CodeMirror snippet template.
 */
function buildCallSnippet(path, parameters) {
    let placeholder = 1
    const args = parameters.map((parameter) => {
        if (parameter.required) {
            return `${parameter.name}=\${${placeholder++}}`
        }
        return `${parameter.name}=${parameter.default}`
    })
    return `${path}(${args.join(', ')})`
}

/**
 * Produces the readable label shown beside a call completion.
 * @param {string} path Callable name or path.
 * @param {object[]} parameters Parameters included in the call.
 * @returns {string} Completion label.
 */
function formatCallLabel(path, parameters) {
    return `${path}(${parameters
        .map((parameter) =>
            parameter.required
                ? `${parameter.name}=`
                : `${parameter.name}=${parameter.default}`,
        )
        .join(', ')})`
}

/**
 * Creates one completion for each valid optional-argument prefix.
 * This lets learners choose a short call or add optional arguments gradually.
 * @param {object} entry Structured vocabulary entry.
 * @returns {object[]} CodeMirror snippet completions.
 */
function buildCallableCompletions(entry) {
    const required = entry.parameters.filter((parameter) => parameter.required)
    const optional = entry.parameters.filter((parameter) => !parameter.required)

    // Generate the required-only call plus one call for each progressively
    // longer optional-parameter prefix.
    return Array.from({ length: optional.length + 1 }, (_, index) => {
        const parameters = [...required, ...optional.slice(0, index)]
        const template = buildCallSnippet(entry.path ?? entry.name, parameters)
        return snippetCompletion(template, {
            label: formatCallLabel(entry.path ?? entry.name, parameters),
            type: entry.kind === 'constructor' ? 'class' : 'function',
            detail: entry.description?.split('\n')[0],
            info: () => renderCompletionDocumentation(entry.description),
        })
    })
}

/** @returns {object[]} Completions for top-level public make API entries. */
function buildTopLevelCompletions() {
    return autocompleteApi.members.flatMap(buildCallableCompletions)
}

/**
 * Groups method completions by the API type of their receiver.
 * @returns {Record<string, object[]>} Method completions keyed by receiver type.
 */
function buildMethodCompletionsByType() {
    const completionsByType = {}

    for (const [typeName, methods] of Object.entries(
        autocompleteApi.methodsByType ?? {},
    )) {
        completionsByType[typeName] = methods.flatMap((method) =>
            buildCallableCompletions({ ...method, kind: 'method' }),
        )
    }

    return completionsByType
}

/**
 * Finds the unfinished call expression on the cursor's current line.
 * @param {object} context CodeMirror completion context.
 * @returns {{callee: string, argumentsText: string}|null} Active call details.
 */
function findCallAtCursor(context) {
    const beforeCursor = context.state.doc.sliceString(
        context.state.doc.lineAt(context.pos).from,
        context.pos,
    )
    // Match only an unfinished, non-nested call on the current line. Full
    // Python parsing and validation remain Pyrefly's responsibility.
    const match = beforeCursor.match(
        /(?:^|[^\w.])((?:make\.)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\(([^()]*)$/,
    )
    if (!match) return null

    return { callee: match[1], argumentsText: match[2] }
}

/**
 * Offers only parameters that have not already been provided in this call.
 * @param {object} entry Structured callable entry.
 * @param {string} argumentsText Current argument-list text.
 * @returns {object[]} Parameter snippet completions.
 */
function buildParameterCompletions(entry, argumentsText) {
    // Named arguments already present in the call should not be suggested
    // again, even when the cursor is after a later comma.
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
                info: () => renderCompletionDocumentation(entry.description),
            })
        })
}

/**
 * Infers API receiver types from simple assignments and annotations.
 * This is intentionally lightweight; Pyrefly remains responsible for linting.
 * @param {string} code Python source before the cursor.
 * @returns {Map<string, string>} Variable names mapped to API type names.
 */
function inferVariableTypes(code) {
    const variableTypes = new Map()
    const constructorAssignment =
        /(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*make\.([A-Za-z_]\w*)\s*\(/g
    const annotatedAssignment =
        /(?:^|\n)\s*([A-Za-z_]\w*)\s*:\s*(?:make\.)?([A-Za-z_]\w*)\s*(?:=|\n|$)/g

    // Infer `motor` from assignments such as `motor = make.drivemotor(...)`.
    for (const match of code.matchAll(constructorAssignment)) {
        variableTypes.set(match[1], match[2])
    }

    // Also support explicit annotations such as `motor: drivemotor`.
    for (const match of code.matchAll(annotatedAssignment)) {
        variableTypes.set(match[1], match[2])
    }

    return variableTypes
}

/**
 * Resolves the vocabulary entry for an unfinished function or method call.
 * @param {{callee: string}} call Active call details.
 * @param {string} codeBeforeCursor Python source before the cursor.
 * @returns {object|null} Matching callable entry.
 */
function findCallableEntry(call, codeBeforeCursor) {
    const topLevelEntry = autocompleteApi.members.find(
        (entry) => entry.path === call.callee,
    )
    if (topLevelEntry) {
        return topLevelEntry
    }

    const [receiver, methodName] = call.callee.split('.')
    if (!receiver || !methodName) {
        return null
    }

    const receiverType = inferVariableTypes(codeBeforeCursor).get(receiver)
    return (
        autocompleteApi.methodsByType?.[receiverType]?.find(
            (method) => method.name === methodName,
        ) ?? null
    )
}

/**
 * Chooses parameter, member, or top-level completions from cursor context.
 * Method suggestions use the simple local type inference above.
 * @param {object[]} topLevelCompletions Public make API completions.
 * @param {Record<string, object[]>} methodCompletionsByType Methods by API type.
 * @returns {(context: object) => object|null} CodeMirror completion source.
 */
function createApiCompletionSource(
    topLevelCompletions,
    methodCompletionsByType,
) {
    return (context) => {
        const activeCall = findCallAtCursor(context)
        const isStartingParameter =
            activeCall && /(?:^|,)\s*[A-Za-z_]*$/.test(activeCall.argumentsText)

        if (isStartingParameter) {
            // Inside a call, parameter names take priority over normal word
            // completion.
            const codeBeforeCursor = context.state.doc.sliceString(
                0,
                context.pos,
            )
            const callable = findCallableEntry(activeCall, codeBeforeCursor)
            if (callable) {
                return {
                    from: context.pos,
                    options: buildParameterCompletions(
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

        const dotIndex = word.text.lastIndexOf('.')
        if (dotIndex === -1) {
            // A plain identifier can refer to any public top-level API entry.
            return {
                from: word.from,
                options: topLevelCompletions,
            }
        }

        const receiver = word.text.slice(0, dotIndex)
        if (receiver === 'make') {
            // These completion labels contain `make.`, so replace the entire
            // token rather than only the text after the period.
            return {
                from: word.from,
                options: topLevelCompletions.filter((completion) =>
                    completion.label.startsWith('make.'),
                ),
            }
        }

        const codeBeforeReceiver = context.state.doc.sliceString(0, word.from)
        const receiverType =
            inferVariableTypes(codeBeforeReceiver).get(receiver)

        // Unknown receiver types deliberately produce no API methods. Python's
        // local completion source still runs after this custom source.
        return {
            from: word.from + dotIndex + 1,
            options: methodCompletionsByType[receiverType] ?? [],
        }
    }
}

/**
 * Constrains a numeric document position to the current document.
 * @param {number} position Requested document position.
 * @param {number} documentLength Current document length.
 * @returns {number} Safe CodeMirror position.
 */
function clampDocumentPosition(position, documentLength) {
    return Math.max(0, Math.min(position, documentLength))
}

/**
 * Converts one verifier diagnostic into a safe CodeMirror diagnostic.
 * Offset ranges are preferred; line and column values support fallback errors.
 * @param {EditorView} view CodeMirror editor view.
 * @param {object} diagnostic Verifier diagnostic.
 * @returns {object} CodeMirror lint diagnostic.
 */
function normalizeLintDiagnostic(view, diagnostic) {
    const document = view.state.doc
    let from
    let to

    if (
        typeof diagnostic.from === 'number' &&
        typeof diagnostic.to === 'number'
    ) {
        from = clampDocumentPosition(diagnostic.from, document.length)
        // Highlight at least one character when the diagnostic is not at EOF.
        to = clampDocumentPosition(
            Math.max(diagnostic.to, from + 1),
            document.length,
        )
    } else {
        const lineNumber = Math.max(
            1,
            Math.min(diagnostic.line ?? 1, document.lines),
        )
        const line = document.line(lineNumber)
        const column = Math.max(diagnostic.column ?? 1, 1)
        from = line.from
        to = Math.min(line.to, line.from + column)
    }

    return {
        from,
        to,
        severity: diagnostic.severity ?? 'error',
        message: diagnostic.message,
    }
}

/**
 * Converts verifier output to bounded CodeMirror ranges.
 * @param {EditorView} view CodeMirror editor view.
 * @param {object|null} verified Latest verifier result.
 * @returns {object[]} CodeMirror lint diagnostics.
 */
function buildLintDiagnostics(view, verified) {
    const diagnostics = (verified?.diagnostics ?? []).map((diagnostic) =>
        normalizeLintDiagnostic(view, diagnostic),
    )

    // Older verifier results expose one error outside the diagnostics array.
    if (diagnostics.length === 0 && verified?.error) {
        diagnostics.push(
            normalizeLintDiagnostic(view, {
                line: verified.error_line_num,
                column: verified.error_line_offset,
                severity: 'error',
                message: verified.error,
            }),
        )
    }

    for (const warning of verified?.warnings ?? []) {
        diagnostics.push({
            from: 0,
            to: 0,
            severity: 'warning',
            message: warning,
        })
    }

    return diagnostics
}

/** @returns {object[]} Extensions shared by editable and read-only views. */
function buildDisplayExtensions() {
    return [
        highlightSpecialChars(),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightSelectionMatches(),
        python(),
        tomorrow,
    ]
}

/** @returns {object[]} Extensions used only by read-only views. */
function buildReadOnlyExtensions() {
    return [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        keymap.of(searchKeymap),
    ]
}

/**
 * Builds editing, autocomplete, history, and lint support.
 * @param {() => object|null} getVerifierResult Returns the latest lint result.
 * @returns {object[]} Extensions used only by editable views.
 */
function buildEditableExtensions(getVerifierResult) {
    const topLevelCompletions = buildTopLevelCompletions()
    const methodCompletionsByType = buildMethodCompletionsByType()
    const verifierLinter = linter((view) =>
        buildLintDiagnostics(view, getVerifierResult()),
    )

    return [
        history(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        closeBrackets(),
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
        verifierLinter,
        autocompletion({
            override: [
                createApiCompletionSource(
                    topLevelCompletions,
                    methodCompletionsByType,
                ),
                localCompletionSource,
                globalCompletion,
            ],
        }),
        highlightActiveLine(),
    ]
}

/**
 * Builds the optional line-number and editable lint gutter.
 * @param {boolean} readonly Whether the view is read-only.
 * @param {boolean} noGutter Whether all gutter UI is hidden.
 * @returns {object[]} Gutter extensions.
 */
function buildGutterExtensions(readonly, noGutter) {
    if (noGutter) {
        return []
    }

    const extensions = [lineNumbers()]
    if (!readonly) {
        extensions.push(highlightActiveLineGutter(), lintGutter())
    }
    return extensions
}

/**
 * Creates a configured Python CodeMirror view.
 * Read-only views keep syntax, selection, and search support without loading
 * editing, autocomplete, history, or lint extensions.
 * @param {object} options Editor display options.
 * @param {boolean} [options.readonly=false] Disables editing and edit-only features.
 * @param {boolean} [options.noGutter=false] Hides the line-number gutter.
 * @returns {EditorView} A detached CodeMirror editor view.
 */
export function createCodeMirrorView({
    readonly = false,
    noGutter = false,
} = {}) {
    let verifierResult = null
    const modeExtensions = readonly
        ? buildReadOnlyExtensions()
        : buildEditableExtensions(() => verifierResult)
    const extensions = [
        ...buildDisplayExtensions(),
        ...modeExtensions,
        ...buildGutterExtensions(readonly, noGutter),
    ]

    const view = new EditorView({
        doc: 'import make\n\n',
        extensions,
    })

    if (!readonly) {
        view.dom.addEventListener('perform-linting', (event) => {
            verifierResult = event.detail
            // The lint extension reads verifierResult on future runs. Dispatch
            // immediately as well so this external result appears without
            // waiting for another document change.
            view.dispatch(
                setDiagnostics(
                    view.state,
                    buildLintDiagnostics(view, verifierResult),
                ),
            )
        })
    }

    return view
}

/**
 * Returns the complete document text from an editor view.
 * @param {EditorView} view The CodeMirror editor view.
 * @returns {string} Current editor contents.
 */
export function getCodeMirrorText(view) {
    return view.state.doc.toString()
}

/**
 * Replaces an editor view's complete document text.
 * @param {EditorView} view The CodeMirror editor view.
 * @param {string} text New editor contents.
 */
export function setCodeMirrorText(view, text) {
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    })
}
