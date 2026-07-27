import pythonLibraryVocab from '../data/pythonLibraryVocab.json'
import * as pyrefly from '../pyrefly/pyrefly_wasm'

// Browser-side bridge between the editor and Pyrefly's WebAssembly API.
// The vocabulary remains the public API source of truth. This helper presents
// that API to Pyrefly as a small, non-executable `make.pyi` file.

const MAIN_FILE_NAME = 'main.py'
const API_STUB_FILE_NAME = 'make.pyi'
const CONFIG_FILE_NAME = 'pyrefly.toml'
const PYTHON_VERSION = pythonLibraryVocab.lint?.pythonVersion ?? '3.12'

const INFORMATIONAL_DIAGNOSTICS = new Set([
    'unused-import',
    'unused-variable',
    'unused-parameter',
])

const STRING_SEVERITIES = {
    ignore: 'ignore',
    info: 'info',
    warn: 'warning',
    warning: 'warning',
    error: 'error',
}

const NUMERIC_SEVERITIES = {
    1: 'error',
    2: 'warning',
    3: 'info',
    4: 'info',
}

let pyreflyStatePromise = null

/**
 * Formats structured vocabulary parameters as typed Python stub parameters.
 * @param {object[]} parameters Structured API parameters.
 * @returns {string} Comma-separated Python parameters.
 */
function formatStubParameters(parameters = []) {
    return parameters
        .map(({ name, annotation, default: defaultValue }) => {
            const type = annotation ?? 'Any'
            const defaultExpression =
                defaultValue === null ? '' : ` = ${defaultValue}`

            return `${name}: ${type}${defaultExpression}`
        })
        .join(', ')
}

/**
 * Formats parameters that follow `self` in a class method signature.
 * @param {object[]} parameters Structured API parameters.
 * @returns {string} Empty text or a comma-prefixed parameter list.
 */
function formatMethodParameters(parameters = []) {
    const formattedParameters = formatStubParameters(parameters)
    return formattedParameters ? `, ${formattedParameters}` : ''
}

/**
 * Builds the public `make` API stub used for type checking and completion.
 * @returns {string} Non-executable Python stub source.
 */
function buildPublicApiStub() {
    const autocomplete = pythonLibraryVocab.autocomplete ?? {}
    const definitions = ['from typing import Any', '']

    for (const member of autocomplete.members ?? []) {
        if (member.kind === 'function') {
            const parameters = formatStubParameters(member.parameters)
            const resultType = member.resultType ?? 'Any'

            definitions.push(
                `def ${member.name}(${parameters}) -> ${resultType}: ...`,
                '',
            )
            continue
        }

        const constructorParameters = formatMethodParameters(member.parameters)
        definitions.push(
            `class ${member.name}:`,
            `    def __init__(self${constructorParameters}) -> None: ...`,
        )

        const methods = autocomplete.methodsByType?.[member.name] ?? []
        for (const method of methods) {
            const parameters = formatMethodParameters(method.parameters)
            const resultType = method.resultType ?? 'Any'

            definitions.push(
                `    def ${method.name}(self${parameters}) -> ${resultType}: ...`,
            )
        }

        definitions.push('')
    }

    return definitions.join('\n')
}

/**
 * Builds the virtual files Pyrefly needs when its shared state is initialized.
 * @returns {Record<string, string>} Filename-to-source mapping.
 */
function buildInitialPyreflyFiles() {
    const configuration = [
        `python-version = "${PYTHON_VERSION}"`,
        '[errors]',
        "unimported-directive = 'ignore'",
    ].join('\n')

    return {
        [MAIN_FILE_NAME]: '',
        [CONFIG_FILE_NAME]: configuration,
        [API_STUB_FILE_NAME]: buildPublicApiStub(),
    }
}

/**
 * Initializes the WASM module and its in-memory project.
 * @returns {Promise<object|null>} Initialized Pyrefly state, or null when the
 * bundled API is unavailable.
 */
async function createPyreflyState() {
    if (typeof pyrefly.State !== 'function') {
        return null
    }

    // wasm-bindgen exposes its module loader as the default export. Some builds
    // initialize it elsewhere, so only invoke it when the function is present.
    if (typeof pyrefly.default === 'function') {
        await pyrefly.default()
    }

    const state = new pyrefly.State(PYTHON_VERSION)
    state.updateSandboxFiles(buildInitialPyreflyFiles(), true)
    state.setActiveFile(MAIN_FILE_NAME)
    return state
}

/**
 * Returns the single shared Pyrefly state used by linting and autocomplete.
 * Storing the promise prevents both features from initializing WASM at once.
 * @returns {Promise<object|null>} Shared Pyrefly state.
 */
function getPyreflyState() {
    if (!pyreflyStatePromise) {
        pyreflyStatePromise = createPyreflyState()
    }

    return pyreflyStatePromise
}

/**
 * Replaces only the user's virtual file, leaving the API stub untouched.
 * @param {object} state Initialized Pyrefly state.
 * @param {string} code Current Python source.
 */
function updateActivePythonFile(state, code) {
    state.updateSingleFile(MAIN_FILE_NAME, code)
    state.setActiveFile(MAIN_FILE_NAME)
}

/**
 * Converts Pyrefly's one-based line and column into a document offset.
 * @param {string} code Python source.
 * @param {number} lineNumber One-based line number.
 * @param {number} column One-based column number.
 * @returns {number} Zero-based document offset.
 */
function pyreflyPositionToOffset(code, lineNumber, column) {
    const lines = code.split('\n')
    const requestedLineIndex = Math.max((lineNumber ?? 1) - 1, 0)
    const existingLineIndex = Math.min(requestedLineIndex, lines.length - 1)

    // Add one character per preceding newline because split() removes them.
    const lineStart = lines
        .slice(0, existingLineIndex)
        .reduce((offset, line) => offset + line.length + 1, 0)

    const requestedColumnOffset = Math.max((column ?? 1) - 1, 0)
    const lineLength = lines[existingLineIndex]?.length ?? 0
    const columnOffset = Math.min(requestedColumnOffset, lineLength)

    return lineStart + columnOffset
}

/**
 * Normalizes the string and numeric severities emitted by Pyrefly builds.
 * @param {string|number} severity Pyrefly severity value.
 * @returns {string|null} CodeMirror severity, or null when unknown.
 */
function normalizePyreflySeverity(severity) {
    if (typeof severity === 'string') {
        return STRING_SEVERITIES[severity.toLowerCase()] ?? null
    }

    if (typeof severity === 'number') {
        return NUMERIC_SEVERITIES[severity] ?? null
    }

    return null
}

/**
 * Chooses the severity shown by CodeMirror for a Pyrefly diagnostic.
 * @param {object} error Pyrefly diagnostic.
 * @returns {string} CodeMirror severity.
 */
function getDiagnosticSeverity(error) {
    // Unused values are worth showing, but should not make valid student code
    // appear broken.
    if (INFORMATIONAL_DIAGNOSTICS.has(error.kind)) {
        return 'info'
    }

    return normalizePyreflySeverity(error.severity) ?? 'error'
}

/**
 * Converts one Pyrefly diagnostic into the shape consumed by CodeMirror.
 * @param {object} error Pyrefly diagnostic.
 * @param {string} code Python source.
 * @returns {object|null} CodeMirror diagnostic, or null when ignored.
 */
function normalizePyreflyDiagnostic(error, code) {
    const from = pyreflyPositionToOffset(
        code,
        error.startLineNumber,
        error.startColumn,
    )
    const reportedEnd = pyreflyPositionToOffset(
        code,
        error.endLineNumber,
        error.endColumn,
    )
    const to = Math.min(code.length, Math.max(from + 1, reportedEnd))
    const severity = getDiagnosticSeverity(error)

    if (severity === 'ignore') {
        return null
    }

    const message = error.message_details
        ? `${error.message_header}\n${error.message_details}`
        : error.message_header

    return {
        message,
        line: error.startLineNumber ?? 1,
        column: error.startColumn ?? 1,
        from,
        to,
        severity,
        source: 'pyrefly',
    }
}

/**
 * Requests type-aware completions from the bundled Pyrefly WASM state.
 * Pyrefly's browser API expects one-based line and column positions.
 * @param {string} code Current Python source.
 * @param {number} lineNumber One-based cursor line.
 * @param {number} column One-based cursor column.
 * @returns {Promise<object[]>} Completion items, or an empty array when
 * completion is unavailable.
 */
export async function getCompletionsWithPyrefly(code, lineNumber, column) {
    const state = await getPyreflyState()
    if (!state || typeof state.autoComplete !== 'function') {
        return []
    }

    updateActivePythonFile(state, code)
    return state.autoComplete(lineNumber, column) ?? []
}

/**
 * Lints editor code with the in-memory public API.
 *
 * Returns `null` only when the bundled WASM API is unavailable. Otherwise it
 * includes both CodeMirror diagnostics and first-error summary fields retained
 * for the existing Issues UI.
 * @param {string} code Python source to lint.
 * @returns {Promise<object|null>} Normalized lint result or null when unavailable.
 */
export async function checkWithPyrefly(code) {
    const state = await getPyreflyState()
    if (!state) {
        return null
    }

    updateActivePythonFile(state, code)

    const diagnostics = []
    for (const error of state.getErrors()) {
        // Stub/configuration diagnostics are implementation problems and should
        // not be attached to the code the user is editing.
        const filename = error.filename ?? MAIN_FILE_NAME
        if (filename !== MAIN_FILE_NAME) {
            continue
        }

        const diagnostic = normalizePyreflyDiagnostic(error, code)
        if (diagnostic) {
            diagnostics.push(diagnostic)
        }
    }

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
