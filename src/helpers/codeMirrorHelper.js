/*
 * Creates Python CodeMirror views, combines Pyrefly's semantic results with
 * generated API documentation, and presents autocomplete and lint behavior.
 * Read-only views reuse only the display portion of the configuration.
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
import { getCompletionsWithPyrefly } from './pyreflyHelper'

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
 * @param {Set<string>} allowedNames Parameter names approved by Pyrefly.
 * @returns {object[]} Parameter snippet completions.
 */
function buildParameterCompletions(entry, argumentsText, allowedNames) {
    // Named arguments already present in the call should not be suggested
    // again, even when the cursor is after a later comma.
    const used = new Set(
        Array.from(argumentsText.matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*=/g)).map(
            (match) => match[1],
        ),
    )
    return entry.parameters
        .filter(
            (parameter) =>
                allowedNames.has(parameter.name) && !used.has(parameter.name),
        )
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
 * Returns the callable name represented by an enriched snippet completion.
 * @param {object} completion CodeMirror completion.
 * @returns {string} Function, constructor, or method name.
 */
function callableNameFromCompletion(completion) {
    const path = completion.label.split('(', 1)[0]
    return path.split('.').at(-1)
}

/**
 * Resolves a callable's documentation entry without trying to infer its type.
 * Pyrefly has already determined which parameter names are valid.
 * @param {{callee: string}} call Active call details.
 * @param {Set<string>} allowedParameterNames Parameters returned by Pyrefly.
 * @returns {object|null} Matching callable entry.
 */
function findVocabularyCallable(call, allowedParameterNames) {
    const topLevelEntry = autocompleteApi.members.find(
        (entry) => entry.path === call.callee,
    )
    if (topLevelEntry) {
        return topLevelEntry
    }

    const methodName = call.callee.split('.').at(-1)
    if (!methodName) {
        return null
    }

    const matchingMethods = Object.values(autocompleteApi.methodsByType ?? {})
        .flat()
        .filter((method) => method.name === methodName)

    return (
        matchingMethods.find((method) =>
            [...allowedParameterNames].every((parameterName) =>
                method.parameters.some(
                    (parameter) => parameter.name === parameterName,
                ),
            ),
        ) ??
        matchingMethods[0] ??
        null
    )
}

/**
 * Extracts the inferred receiver type from Pyrefly's rendered method signature.
 * @param {object[]} completions Pyrefly completion items.
 * @returns {string|null} Inferred API type name.
 */
function receiverTypeFromPyrefly(completions) {
    for (const completion of completions) {
        const match = completion.detail?.match(
            /\bself:\s*([A-Za-z_][A-Za-z0-9_]*)/,
        )
        if (match) {
            return match[1]
        }
    }
    return null
}

/**
 * Requests completions at CodeMirror's cursor using Pyrefly's one-based
 * browser coordinates.
 * @param {object} context CodeMirror completion context.
 * @returns {Promise<object[]>} Pyrefly completion items.
 */
async function requestPyreflyCompletions(context) {
    const document = context.state.doc
    const line = document.lineAt(context.pos)
    const column = context.pos - line.from + 1

    try {
        return await getCompletionsWithPyrefly(
            document.toString(),
            line.number,
            column,
        )
    } catch {
        // Other CodeMirror completion sources should remain usable if the WASM
        // service cannot answer an incomplete file.
        return []
    }
}

/**
 * Filters enriched vocabulary completions to names approved by Pyrefly.
 * @param {object[]} completions Enriched CodeMirror completions.
 * @param {Set<string>} allowedNames Pyrefly completion labels.
 * @returns {object[]} Semantically valid enriched completions.
 */
function filterCompletionsByName(completions, allowedNames) {
    const seenLabels = new Set()
    return completions.filter((completion) => {
        const isAllowed = allowedNames.has(
            callableNameFromCompletion(completion),
        )
        if (!isAllowed || seenLabels.has(completion.label)) {
            return false
        }

        seenLabels.add(completion.label)
        return true
    })
}

/**
 * Chooses parameter, member, or top-level completions from cursor context.
 * Pyrefly determines semantic validity and receiver types; the vocabulary adds
 * learner-friendly snippets, defaults, and documentation.
 * @param {object[]} topLevelCompletions Public make API completions.
 * @param {Record<string, object[]>} methodCompletionsByType Methods by API type.
 * @returns {(context: object) => Promise<object|null>} Async completion source.
 */
function createApiCompletionSource(
    topLevelCompletions,
    methodCompletionsByType,
) {
    return async (context) => {
        const activeCall = findCallAtCursor(context)
        const isStartingParameter =
            activeCall && /(?:^|,)\s*[A-Za-z_]*$/.test(activeCall.argumentsText)

        if (isStartingParameter) {
            const pyreflyCompletions = await requestPyreflyCompletions(context)
            const allowedParameterNames = new Set(
                pyreflyCompletions
                    .map((completion) => completion.label)
                    .filter((label) => label.endsWith('='))
                    .map((label) => label.slice(0, -1)),
            )
            const callable = findVocabularyCallable(
                activeCall,
                allowedParameterNames,
            )
            if (callable) {
                const parameterWord = context.matchBefore(/[A-Za-z_]\w*$/)
                return {
                    from: parameterWord?.from ?? context.pos,
                    options: buildParameterCompletions(
                        callable,
                        activeCall.argumentsText,
                        allowedParameterNames,
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
        const pyreflyCompletions = await requestPyreflyCompletions(context)
        const allowedNames = new Set(
            pyreflyCompletions.map((completion) => completion.label),
        )

        if (receiver === 'make') {
            // These completion labels contain `make.`, so replace the entire
            // token rather than only the text after the period.
            return {
                from: word.from,
                options: filterCompletionsByName(
                    topLevelCompletions,
                    allowedNames,
                ),
            }
        }

        const receiverType = receiverTypeFromPyrefly(pyreflyCompletions)
        const methodCompletions = receiverType
            ? (methodCompletionsByType[receiverType] ?? [])
            : Object.values(methodCompletionsByType).flat()

        return {
            from: word.from + dotIndex + 1,
            options: filterCompletionsByName(methodCompletions, allowedNames),
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
