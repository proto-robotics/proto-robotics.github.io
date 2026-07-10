import pythonLibraryVocab from '../data/pythonLibraryVocab.json'

let pyodide = null
let runtimeLoaded = false

const pythonKeywords = new Set([
    'False',
    'None',
    'True',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
])

const pythonBuiltins = new Set([
    'abs',
    'all',
    'any',
    'bool',
    'dict',
    'float',
    'int',
    'len',
    'list',
    'max',
    'min',
    'print',
    'range',
    'round',
    'str',
    'sum',
    'tuple',
])

const makeMembers = new Set(
    (pythonLibraryVocab.completions ?? [])
        .map((completion) => completion.label.match(/^make\.([A-Za-z_]\w*)/)?.[1])
        .filter(Boolean),
)

const classNames = new Set(
    Object.keys(pythonLibraryVocab.methodCompletionsByClass ?? {}),
)

const methodsByClass = Object.fromEntries(
    Object.entries(pythonLibraryVocab.methodCompletionsByClass ?? {}).map(
        ([className, methods]) => [
            className,
            new Set(methods.map((method) => method.label.split('(')[0])),
        ],
    ),
)

const allKnownMethods = new Set(
    Object.values(methodsByClass).flatMap((methods) => Array.from(methods)),
)

const getLineAndColumn = (code, index) => {
    const before = code.slice(0, index)
    const lines = before.split('\n')

    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    }
}

const makeStaticError = (message, code, index) => {
    const location = getLineAndColumn(code, index)

    return {
        error: message,
        error_line_num: location.line,
        error_line_offset: location.column,
        warnings: [],
        warnings_linenum: [],
        warnings_offset: [],
    }
}

const makeDiagnostic = (message, code, index, length = 1) => {
    const location = getLineAndColumn(code, index)

    return {
        message,
        line: location.line,
        column: location.column,
        from: index,
        to: index + Math.max(length, 1),
        severity: 'error',
    }
}

const singleErrorResult = (message, line = 1, column = 1) => ({
    error: message,
    error_line_num: line,
    error_line_offset: column,
    diagnostics: [
        {
            message,
            line,
            column,
            severity: 'error',
        },
    ],
    warnings: [],
    warnings_linenum: [],
    warnings_offset: [],
})

const isKeywordArgument = (code, index, name) => {
    const lineStart = code.lastIndexOf('\n', index) + 1
    const beforeOnLine = code.slice(lineStart, index)
    const afterName = code.slice(index + name.length)

    return /[(,]\s*$/.test(beforeOnLine) && /^\s*=/.test(afterName)
}

const blankPreservingNewlines = (value) =>
    value.replace(/[^\n]/g, ' ')

const stripStringsAndComments = (code) =>
    code
        .replace(
            /("""[\s\S]*?"""|'''[\s\S]*?'''|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
            blankPreservingNewlines,
        )
        .replace(/#.*/g, blankPreservingNewlines)

const splitSimpleArguments = (args) => args.split(',').map((arg) => arg.trim())

const checkStaticApiUsage = (code) => {
    const visibleCode = stripStringsAndComments(code)
    const definedNames = new Set([...pythonBuiltins])
    const variableTypes = new Map()
    const makeConstructedNames = new Set()
    const diagnostics = []
    const reported = new Set()

    const addDiagnostic = (key, message, index, length = 1) => {
        if (reported.has(key)) {
            return
        }

        reported.add(key)
        diagnostics.push(makeDiagnostic(message, code, index, length))
    }

    for (const match of visibleCode.matchAll(/(?:^|\n)\s*import\s+([A-Za-z_]\w*)/g)) {
        definedNames.add(match[1])
    }

    for (const match of visibleCode.matchAll(/(?:^|\n)\s*from\s+[\w.]+\s+import\s+([^\n]+)/g)) {
        for (const importedName of match[1].split(',')) {
            definedNames.add(importedName.trim().split(/\s+as\s+/).pop())
        }
    }

    for (const match of visibleCode.matchAll(/(?:^|\n)\s*([A-Za-z_]\w*)\s*:\s*(?:make\.)?([A-Za-z_]\w*)/g)) {
        definedNames.add(match[1])
        if (classNames.has(match[2])) {
            variableTypes.set(match[1], match[2])
        }
    }

    for (const match of visibleCode.matchAll(/(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*make\.([A-Za-z_]\w*)\s*\(/g)) {
        definedNames.add(match[1])
        makeConstructedNames.add(match[1])
        if (classNames.has(match[2])) {
            variableTypes.set(match[1], match[2])
        }
    }

    for (const match of visibleCode.matchAll(/(?:^|\n)\s*([A-Za-z_]\w*)\s*=/g)) {
        definedNames.add(match[1])
    }

    for (const match of visibleCode.matchAll(/\bmake\.([A-Za-z_]\w*)/g)) {
        if (!makeMembers.has(match[1])) {
            addDiagnostic(
                `make.${match[1]}`,
                `make has no member ${match[1]}`,
                match.index + 'make.'.length,
                match[1].length,
            )
        }
    }

    for (const match of visibleCode.matchAll(/\bmake\.([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
        if (!makeMembers.has(match[1])) {
            continue
        }

        let searchFrom = match.index + match[0].indexOf('(') + 1

        for (const argument of splitSimpleArguments(match[2])) {
            if (!argument || argument.includes('=')) {
                searchFrom += argument.length + 1
                continue
            }

            const nameMatch = argument.match(/^([A-Za-z_]\w*)$/)
            if (!nameMatch) {
                searchFrom += argument.length + 1
                continue
            }

            const name = nameMatch[1]
            const nameIndex = visibleCode.indexOf(name, searchFrom)

            if (
                !definedNames.has(name) &&
                !pythonBuiltins.has(name) &&
                !pythonKeywords.has(name) &&
                !classNames.has(name)
            ) {
                addDiagnostic(name, `${name} is not defined`, nameIndex, name.length)
            }

            searchFrom = nameIndex + name.length
        }
    }

    for (const match of visibleCode.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/g)) {
        const receiver = match[1]
        const method = match[2]

        if (receiver === 'make') {
            continue
        }

        const receiverType = variableTypes.get(receiver)
        if (receiverType && !methodsByClass[receiverType]?.has(method)) {
            addDiagnostic(
                `${receiverType}.${method}`,
                `${receiverType} has no method ${method}`,
                match.index + receiver.length + 1,
                method.length,
            )
        } else if (
            !receiverType &&
            makeConstructedNames.has(receiver) &&
            !allKnownMethods.has(method)
        ) {
            addDiagnostic(
                `${receiver}.${method}`,
                `${receiver} has no known method ${method}`,
                match.index + receiver.length + 1,
                method.length,
            )
        }
    }

    for (const match of visibleCode.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\([^)]*\)\s*\(/g)) {
        const receiver = match[1]
        const method = match[2]

        if (receiver === 'make') {
            continue
        }

        addDiagnostic(
            `${receiver}.${method}.called-result`,
            `The result of ${receiver}.${method}(...) is not callable`,
            match.index,
            match[0].length,
        )
    }

    for (const match of visibleCode.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)) {
        const receiver = match[1]

        if (
            receiver === 'make' ||
            definedNames.has(receiver) ||
            pythonBuiltins.has(receiver) ||
            classNames.has(receiver)
        ) {
            continue
        }

        addDiagnostic(
            `${receiver}.receiver`,
            `${receiver} is not defined`,
            match.index,
            receiver.length,
        )
    }

    for (const match of visibleCode.matchAll(/\b[A-Za-z_]\w*\b/g)) {
        const name = match[0]
        const previous = visibleCode[match.index - 1]
        const next = visibleCode[match.index + name.length]

        if (
            pythonKeywords.has(name) ||
            definedNames.has(name) ||
            isKeywordArgument(visibleCode, match.index, name) ||
            previous === '.' ||
            next === '.' ||
            classNames.has(name)
        ) {
            continue
        }

        addDiagnostic(name, `${name} is not defined`, match.index, name.length)
    }

    return diagnostics.length ? { diagnostics } : null
}

const ensureDirectory = (path) => {
    const parts = path.split('/').filter(Boolean)
    let current = ''

    for (const part of parts) {
        current += `/${part}`
        const analyzedPath = pyodide.FS.analyzePath(current)

        if (analyzedPath.exists) {
            if (!pyodide.FS.isDir(analyzedPath.object.mode)) {
                throw new Error(`${current} exists but is not a directory`)
            }
            continue
        }

        pyodide.FS.mkdir(current)
    }
}

const loadRuntimeFiles = () => {
    if (runtimeLoaded) {
        return
    }

    for (const [path, source] of Object.entries(
        pythonLibraryVocab.runtimeFiles ?? {},
    )) {
        const directory = path.split('/').slice(0, -1).join('/')
        ensureDirectory(directory)
        pyodide.FS.writeFile(path, source)
    }

    pyodide.runPython(`
import sys

if "/lib" not in sys.path:
    sys.path.insert(0, "/lib")
`)

    runtimeLoaded = true
}

export const checkSyntax = async (code) => {
    if (!pyodide) {
        pyodide = await loadPyodide()
    }

    try {
        loadRuntimeFiles()
        pyodide.globals.set('code_str', code)
        await pyodide.runPythonAsync(`
import ast
import importlib

error = None
error_line_num = None
error_line_offset = None
warnings_list = []
warnings_linenum = []
warnings_offset = []

try:
    tree = ast.parse(code_str)
    compile(tree, "main.py", "exec")
except SyntaxError as e:
    error = e.msg
    error_line_num = e.lineno
    error_line_offset = e.offset

if error is None:
    for node in ast.walk(tree):
        module_name = None
        imported_names = []

        if isinstance(node, ast.Import):
            for alias in node.names:
                try:
                    importlib.import_module(alias.name)
                except Exception as e:
                    error = f"Could not import {alias.name}: {e}"
                    error_line_num = node.lineno
                    error_line_offset = node.col_offset + 1
                    break
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            module_name = node.module
            imported_names = [alias.name for alias in node.names if alias.name != "*"]
            try:
                imported_module = importlib.import_module(module_name)
                for imported_name in imported_names:
                    if not hasattr(imported_module, imported_name):
                        error = f"Could not import {imported_name} from {module_name}"
                        error_line_num = node.lineno
                        error_line_offset = node.col_offset + 1
                        break
            except Exception as e:
                error = f"Could not import {module_name}: {e}"
                error_line_num = node.lineno
                error_line_offset = node.col_offset + 1

        if error is not None:
            break

result = {"error": error, "error_line_num": error_line_num, "error_line_offset": error_line_offset, "warnings": warnings_list, "warnings_linenum": warnings_linenum, "warnings_offset": warnings_offset}
`)

        const result = pyodide.globals.get('result').toJs()
        const diagnostics = []

        if (result.error) {
            const lineStart =
                result.error_line_num > 1
                    ? code.split('\n').slice(0, result.error_line_num - 1).join('\n')
                          .length + 1
                    : 0
            const from = lineStart + Math.max((result.error_line_offset ?? 1) - 1, 0)
            diagnostics.push({
                message: result.error,
                line: result.error_line_num ?? 1,
                column: result.error_line_offset ?? 1,
                from,
                to: from + 1,
                severity: 'error',
            })
        }

        diagnostics.push(...(checkStaticApiUsage(code)?.diagnostics ?? []))

        return diagnostics.length
            ? {
                  ...result,
                  diagnostics,
              }
            : result
    } catch (err) {
        return singleErrorResult(`Pyodide internal error: ${err.message}`)
    }
}
