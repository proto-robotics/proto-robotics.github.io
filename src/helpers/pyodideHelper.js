/**
 * Minimal access to the optional browser Pyodide runtime.
 *
 * Pyodide is loaded by index.html and is intentionally separate from the
 * editor's Pyrefly linting. Nothing executes Python unless a caller invokes
 * one of the functions below.
 */
let runtimePromise = null

/** @returns {Promise<object>} Shared Pyodide runtime instance. */
export const getPythonRuntime = () => {
    if (!runtimePromise) {
        if (typeof globalThis.loadPyodide !== 'function') {
            throw new Error('Pyodide is not available on this page.')
        }

        runtimePromise = globalThis.loadPyodide()
    }

    return runtimePromise
}

/**
 * Runs Python that completes synchronously and returns its result.
 * @param {string} code Python source to execute.
 * @returns {Promise<*>} Python result converted by Pyodide.
 */
export const runPython = async (code) => {
    const runtime = await getPythonRuntime()
    return runtime.runPython(code)
}

/**
 * Runs Python that may await and returns its resolved result.
 * @param {string} code Python source to execute.
 * @returns {Promise<*>} Resolved Python result converted by Pyodide.
 */
export const runPythonAsync = async (code) => {
    const runtime = await getPythonRuntime()
    return runtime.runPythonAsync(code)
}
