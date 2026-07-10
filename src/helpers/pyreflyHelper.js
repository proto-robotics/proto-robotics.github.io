import pythonLibraryVocab from '../data/pythonLibraryVocab.json'
import * as pyrefly from '../pyrefly/pyrefly_wasm'

let pyreflyState = null

const mainFileName = 'main.py'
const pythonVersion = '3.12'

const runtimeFilesForPyrefly = () => {
    const files = {
        [mainFileName]: '',
        'pyrefly.toml': [
            `python-version = "${pythonVersion}"`,
            '[errors]',
            "unimported-directive = 'ignore'",
        ].join('\n'),
    }

    for (const [path, source] of Object.entries(
        pythonLibraryVocab.runtimeFiles ?? {},
    )) {
        files[path.replace(/^\/lib\//, '')] = source
    }

    return files
}

const ensurePyreflyState = async () => {
    if (typeof pyrefly.State !== 'function') {
        return null
    }

    if (!pyreflyState) {
        if (typeof pyrefly.default === 'function') {
            await pyrefly.default()
        }

        pyreflyState = new pyrefly.State(pythonVersion)
        pyreflyState.updateSandboxFiles(runtimeFilesForPyrefly(), true)
        pyreflyState.setActiveFile(mainFileName)
    }

    return pyreflyState
}

const lineOffsetToIndex = (code, lineNumber, column) => {
    const safeLine = Math.max(lineNumber ?? 1, 1)
    const lineStart =
        safeLine > 1 ? code.split('\n').slice(0, safeLine - 1).join('\n').length + 1 : 0

    return lineStart + Math.max((column ?? 1) - 1, 0)
}

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

export const checkWithPyrefly = async (code) => {
    const state = await ensurePyreflyState()

    if (!state) {
        return null
    }

    const files = runtimeFilesForPyrefly()
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

    return diagnostics.length
        ? {
              error: diagnostics[0].message,
              error_line_num: diagnostics[0].line,
              error_line_offset: diagnostics[0].column,
              diagnostics,
              warnings: [],
              warnings_linenum: [],
              warnings_offset: [],
              checker: 'pyrefly',
          }
        : {
              error: null,
              error_line_num: null,
              error_line_offset: null,
              diagnostics: [],
              warnings: [],
              warnings_linenum: [],
              warnings_offset: [],
              checker: 'pyrefly',
          }
}
