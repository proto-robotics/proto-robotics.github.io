import pythonLibraryVocab from '../data/pythonLibraryVocab.json'
import * as pyrefly from '../pyrefly/pyrefly_wasm'

/**
 * Browser-side bridge to Pyrefly's WebAssembly API. The generated vocabulary
 * remains the public API source of truth; this module renders it as a small
 * temporary `make.pyi` file for Pyrefly and converts diagnostics for CodeMirror.
 */
let pyreflyState = null

const mainFileName = 'main.py'
const pythonVersion = pythonLibraryVocab.lint?.pythonVersion ?? '3.12'

/**
 * Renders structured vocabulary parameters as typed Python stub parameters.
 * @param {object[]} parameters Structured API parameters.
 * @returns {string} Comma-separated Python parameters.
 */
const lintParameters = (parameters = []) =>
    parameters
        .map(({ name, annotation, default: defaultValue }) => {
            const type = annotation ?? 'Any'
            return `${name}: ${type}${defaultValue === null ? '' : ` = ${defaultValue}`}`
        })
        .join(', ')

/** @returns {string} Non-executable public `make` stub for Pyrefly. */
const publicStubForPyrefly = () => {
    const api = pythonLibraryVocab.autocomplete ?? {}
    const definitions = ['from typing import Any', '']

    for (const member of api.members ?? []) {
        if (member.kind === 'function') {
            definitions.push(
                `def ${member.name}(${lintParameters(member.parameters)}) -> ${member.resultType ?? 'Any'}: ...`,
                '',
            )
            continue
        }

        definitions.push(`class ${member.name}:`)
        definitions.push(
            `    def __init__(self${member.parameters?.length ? `, ${lintParameters(member.parameters)}` : ''}) -> None: ...`,
        )
        for (const method of api.methodsByType?.[member.name] ?? []) {
            definitions.push(
                `    def ${method.name}(self${method.parameters?.length ? `, ${lintParameters(method.parameters)}` : ''}) -> ${method.resultType ?? 'Any'}: ...`,
            )
        }
        definitions.push('')
    }

    return definitions.join('\n')
}

/** @returns {Record<string, string>} In-memory files used by Pyrefly. */
const lintFilesForPyrefly = () => {
    const files = {
        [mainFileName]: '',
        'pyrefly.toml': [
            `python-version = "${pythonVersion}"`,
            '[errors]',
            "unimported-directive = 'ignore'",
        ].join('\n'),
    }

    files['make.pyi'] = publicStubForPyrefly()

    return files
}

/** @returns {Promise<object|null>} Shared Pyrefly state, or null if unavailable. */
const ensurePyreflyState = async () => {
    if (typeof pyrefly.State !== 'function') {
        return null
    }

    if (!pyreflyState) {
        if (typeof pyrefly.default === 'function') {
            await pyrefly.default()
        }

        pyreflyState = new pyrefly.State(pythonVersion)
        pyreflyState.updateSandboxFiles(lintFilesForPyrefly(), true)
        pyreflyState.setActiveFile(mainFileName)
    }

    return pyreflyState
}

/**
 * Converts Pyrefly's one-based line/column locations into CodeMirror offsets.
 * @param {string} code Python source.
 * @param {number} lineNumber One-based line number.
 * @param {number} column One-based column number.
 * @returns {number} Zero-based document offset.
 */
const lineOffsetToIndex = (code, lineNumber, column) => {
    const safeLine = Math.max(lineNumber ?? 1, 1)
    const lineStart =
        safeLine > 1 ? code.split('\n').slice(0, safeLine - 1).join('\n').length + 1 : 0

    return lineStart + Math.max((column ?? 1) - 1, 0)
}

/**
 * Normalizes Pyrefly's string or numeric severities to CodeMirror values.
 * @param {string|number} severity Pyrefly severity value.
 * @returns {string|null} CodeMirror severity, or null when unknown.
 */
const severityFromPyreflyValue = (severity) => {
    if (typeof severity === 'string') {
        const normalizedSeverity = severity.toLowerCase()
        if (normalizedSeverity === 'ignore') return 'ignore'
        if (normalizedSeverity === 'info') return 'info'
        if (normalizedSeverity === 'warn') return 'warning'
        if (normalizedSeverity === 'warning') return 'warning'
        if (normalizedSeverity === 'error') return 'error'

        return null
    }

    if (typeof severity === 'number') {
        if (severity === 1) return 'error'
        if (severity === 2) return 'warning'
        if (severity === 3 || severity === 4) return 'info'
    }

    return null
}

/**
 * Keeps unused-code diagnostics informational while preserving Pyrefly severity.
 * @param {object} error Pyrefly diagnostic.
 * @returns {string} CodeMirror severity.
 */
const toCodeMirrorSeverity = (error) => {
    if (
        ['unused-import', 'unused-variable', 'unused-parameter'].includes(
            error.kind,
        )
    ) {
        return 'info'
    }

    const pyreflySeverity = severityFromPyreflyValue(error.severity)

    if (pyreflySeverity) {
        return pyreflySeverity
    }

    return 'error'
}

/**
 * Maps one Pyrefly diagnostic to the shape consumed by the line editor.
 * @param {object} error Pyrefly diagnostic.
 * @param {string} code Python source.
 * @returns {object|null} CodeMirror diagnostic, or null when ignored.
 */
const mapPyreflyError = (error, code) => {
    const from = lineOffsetToIndex(code, error.startLineNumber, error.startColumn)
    const to = Math.max(
        from + 1,
        lineOffsetToIndex(code, error.endLineNumber, error.endColumn),
    )

    const severity = toCodeMirrorSeverity(error)
    if (severity === 'ignore') {
        return null
    }

    return {
        message: error.message_details
            ? `${error.message_header}\n${error.message_details}`
            : error.message_header,
        line: error.startLineNumber ?? 1,
        column: error.startColumn ?? 1,
        from,
        to,
        severity,
        source: 'pyrefly',
    }
}

/**
 * Lints editor code with the in-memory public API.
 *
 * Returns `null` only when the bundled WASM API is unavailable. Otherwise it
 * returns a normalized CodeMirror-compatible result, including first-error
 * summary fields used by the lint status UI.
 * @param {string} code Python source to lint.
 * @returns {Promise<object|null>} Normalized lint result or null when unavailable.
 */
export const checkWithPyrefly = async (code) => {
    const state = await ensurePyreflyState()

    if (!state) {
        return null
    }

    const files = lintFilesForPyrefly()
    files[mainFileName] = code

    state.updateSandboxFiles(files, false)
    state.updateSingleFile(mainFileName, code)
    state.setActiveFile(mainFileName)

    const diagnostics = state
        .getErrors()
        .filter((error) => {
            const filename = error.filename ?? mainFileName
            return filename === mainFileName
        })
        .map((error) => mapPyreflyError(error, code))
        .filter(Boolean)

    const firstDiagnostic = diagnostics[0] ?? null
    return {
        error: firstDiagnostic?.message ?? null,
        error_line_num: firstDiagnostic?.line ?? null,
        error_line_offset: firstDiagnostic?.column ?? null,
        diagnostics,
        warnings: [],
        warnings_linenum: [],
        warnings_offset: [],
        checker: 'pyrefly',
    }
}
