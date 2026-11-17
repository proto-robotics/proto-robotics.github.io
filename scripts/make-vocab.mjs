// Builds src/data/pythonLibraryVocab.json, the line editor's list of the
// make library's names, from make's own source, so it keeps up with make.
//
//   npm run vocab                       (make checked out at ../../make)
//   node scripts/make-vocab.mjs <path to make/src/lib>
//
// It reads make.py for what `from make import *` brings in, each class's
// public methods with their signatures and docstrings, and the board the
// library is set up for (system_config.py) for the built-in buttons and
// lights (button_a, light_l1). Programs start with `from make import *`, so
// every name is bare: `wait`, not `make.wait`.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lib = resolve(process.argv[2] ?? join(here, '../../../make/src/lib'))
const out = join(here, '../src/data/pythonLibraryVocab.json')
const read = (path) =>
    readFileSync(join(lib, path), 'utf8').replace(/\r\n/g, '\n')

/** Which toolbox category a name belongs to, for completion grouping. */
const CATEGORIES = {
    wait: 'Time',
    wait_until: 'Time',
    wait_while: 'Time',
    repeat_for: 'Time',
    drive_motor: 'Motor',
    encoder: 'Motor',
    drivetrain: 'Drivetrain',
    button: 'Board',
    light: 'Board',
}

/**
 * Result types to state more narrowly than make does. Every PROTO kit's
 * drive motors have encoders, so get_encoder() always gives one; typed as
 * make has it (`encoder | None`) the checker would flag every
 * `arm.get_encoder().get_degrees()` the blocks write.
 */
const RESULT_TYPES = { 'drive_motor.get_encoder': 'encoder' }

/** Constructor parameters a learner never passes. */
const HIDDEN_PARAMETERS = new Set(['self', 'schema'])

/**
 * Parts of make the editor leaves out: PROTO kits use drive motors, so
 * simple motors (continuous servos) and servos are not offered. A type
 * that names one (`simple_motor | drive_motor`) keeps the rest.
 */
const LEFT_OUT = new Set(['simple_motor', 'servo'])
/** Descriptions to say in the editor's words, where make's mention what is left out. */
const DESCRIPTIONS = {
    drivetrain: 'A drivetrain made from 2 drive motors.',
}

const withoutLeftOut = (annotation) => {
    if (!annotation) return annotation
    const kept = annotation
        .split('|')
        .map((part) => part.trim())
        .filter((part) => !LEFT_OUT.has(part))
    return kept.length ? kept.join(' | ') : annotation
}

/**
 * Splits text at top-level commas (not inside brackets).
 * @param {string} text
 * @returns {string[]}
 */
const splitTop = (text) => {
    const parts = []
    let depth = 0
    let current = ''
    for (const ch of text) {
        if ('([{'.includes(ch)) depth++
        if (')]}'.includes(ch)) depth--
        if (ch === ',' && depth === 0) {
            parts.push(current)
            current = ''
        } else {
            current += ch
        }
    }
    if (current.trim()) parts.push(current)
    return parts.map((part) => part.trim()).filter(Boolean)
}

/**
 * @param {string} text A Python parameter list.
 * @returns {object[]} { name, annotation, default, required }
 */
const parseParameters = (text) =>
    splitTop(text)
        .map((part) => {
            const [left, ...rest] = part.split('=')
            const value = rest.join('=').trim()
            const [name, annotation] = left.split(':').map((s) => s.trim())
            return {
                name,
                annotation: withoutLeftOut(annotation) || null,
                default: value || null,
                required: !value,
            }
        })
        .filter(
            (p) => !HIDDEN_PARAMETERS.has(p.name) && !p.name.startsWith('*'),
        )

/**
 * The docstring right after a definition, dedented.
 * @param {string} body The source after the `def ...:` line.
 * @returns {string}
 */
const docstring = (body) => {
    const m = body.match(/^\s*("""([\s\S]*?)"""|"([^"\n]*)")/)
    if (!m) return ''
    const raw = (m[2] ?? m[3] ?? '').replace(/^\n/, '')
    const lines = raw.split('\n')
    const indent = Math.min(
        ...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length),
    )
    return lines
        .map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
        .join('\n')
        .trim()
}

/**
 * Every `def` in a stretch of source, at the given indent.
 * @param {string} source
 * @param {string} indent '' for module functions, '    ' for methods.
 * @returns {object[]} { name, parameters, resultType, description }
 */
const definitions = (source, indent) => {
    const found = []
    const re = new RegExp(
        `^${indent}def ([A-Za-z_]\\w*)\\(([\\s\\S]*?)\\)\\s*(?:->\\s*([^:\\n]+))?:`,
        'gm',
    )
    for (const m of source.matchAll(re)) {
        const [, name, params, result] = m
        found.push({
            name,
            parameters: parseParameters(params.replace(/\s+/g, ' ')),
            resultType: result ? result.trim() : null,
            description: docstring(source.slice(m.index + m[0].length)),
        })
    }
    return found
}

/**
 * A class's docstring, its constructor and its public methods.
 * @param {string} path File under lib/.
 * @param {string} className
 */
const readClass = (path, className) => {
    const source = read(path)
    const start = source.search(
        new RegExp(`^class ${className}\\b[^\\n]*:`, 'm'),
    )
    if (start < 0) throw new Error(`no class ${className} in ${path}`)
    const rest = source.slice(start)
    // the class ends at the next line that starts unindented (not a comment)
    const next = rest.search(/\n(?=[^\s#])/)
    const body = next < 0 ? rest : rest.slice(0, next)
    const defs = definitions(body, '    ')
    const init = defs.find((d) => d.name === '__init__')
    return {
        description: docstring(body.slice(body.indexOf(':') + 1)),
        parameters: init?.parameters ?? [],
        methods: defs
            .filter((d) => !d.name.startsWith('_'))
            .map(({ name, parameters, resultType, description }) => ({
                name,
                description,
                parameters,
                resultType: resultType ?? 'None',
            })),
    }
}

// ---- what make.py exports

const makePy = read('make.py')
const imports = [...makePy.matchAll(/^from (proto[\w.]*) import (.+)$/gm)].map(
    ([, module, names]) => ({
        file: module.replace(/\./g, '/') + '.py',
        names: names.split(',').map((n) => n.trim().split(/\s+as\s+/)),
    }),
)

const members = []
const methodsByType = {}

for (const { file, names } of imports) {
    if (file.startsWith('proto/schemata')) continue // presets, not for learners
    for (const [name, alias] of names) {
        if (LEFT_OUT.has(name)) continue
        if (file === 'proto/general/functions.py') {
            const def = definitions(read(file), '').find((d) => d.name === name)
            members.push({
                name,
                kind: 'function',
                description: def.description,
                parameters: def.parameters,
                resultType: def.resultType ?? 'Any',
                path: name,
                category: CATEGORIES[name] ?? 'Time',
            })
            continue
        }
        const cls = readClass(file, name)
        methodsByType[name] = cls.methods.map((method) => ({
            ...method,
            resultType:
                RESULT_TYPES[`${name}.${method.name}`] ?? method.resultType,
        }))
        // a private import (button as _button) or encoder is a type only:
        // learners get one from make, they never build one
        const typeOnly = Boolean(alias) || name === 'encoder'
        members.push({
            name,
            kind: typeOnly ? 'type' : 'constructor',
            description: DESCRIPTIONS[name] ?? cls.description,
            parameters: typeOnly ? [] : cls.parameters,
            resultType: name,
            path: name,
            category: CATEGORIES[name] ?? 'Motor',
        })
    }
}

// ---- the board's buttons and lights, made at start-up

const config = read('proto/system_config.py')
const boardName = config.match(/^board\s*=\s*(\w+)/m)?.[1]
const boards = read('proto/schemata/board_schema.py')
const boardStart = boards.indexOf(`${boardName}: board_schema = board_schema(`)
if (boardStart < 0) throw new Error(`no board ${boardName}`)
const boardText = boards.slice(boardStart, boards.indexOf('\n)\n', boardStart))
const tuple = (key) =>
    (boardText.match(new RegExp(`${key}=\\(([^)]*)\\)`))?.[1] ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)

for (const port of tuple('buttons')) {
    members.push({
        name: `button_${port.toLowerCase()}`,
        kind: 'instance',
        description:
            `Button ${port}, built into the board.` +
            (port === 'A' ? ' It also starts the program.' : ''),
        parameters: [],
        resultType: 'button',
        path: `button_${port.toLowerCase()}`,
        category: 'Board',
    })
}
for (const port of tuple('lights')) {
    members.push({
        name: `light_${port.toLowerCase()}`,
        kind: 'instance',
        description: `Light ${port}, built into the board.`,
        parameters: [],
        resultType: 'light',
        path: `light_${port.toLowerCase()}`,
        category: 'Board',
    })
}

const vocab = {
    version: 2,
    module: 'make',
    import: 'from make import *',
    lint: { pythonVersion: '3.12' },
    autocomplete: { members, methodsByType },
}
writeFileSync(out, JSON.stringify(vocab, null, 2) + '\n')
console.log(
    `wrote ${out}: ${members.length} names (${board()}), ${Object.keys(methodsByType).length} classes`,
)
function board() {
    return boardName
}
