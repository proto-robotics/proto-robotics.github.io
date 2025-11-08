export const checkSyntax = async (code) => {
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
        return {
            error: `Pyodide internal error: ${err.message}`,
            warnings: [],
        }
    }
}
