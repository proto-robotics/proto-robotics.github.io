/*
 * The Python vocabulary the line editor completes from and the checker
 * types against: the `make` library in pythonLibraryVocab.json, plus
 * whatever a host adds for blocks of its own (src/lib.js, `vocab`). Read it
 * through getVocab() rather than importing the JSON, so additions count.
 */
import pythonLibraryVocab from './pythonLibraryVocab.json'

/** @type {object[]} Extra top-level members, same shape as the JSON's. */
const extraMembers = []
/** @type {Record<string, object[]>} Extra methods keyed by receiver type. */
const extraMethodsByType = {}

/**
 * Adds to the vocabulary. Call before the first editor is built: the
 * checker writes its stub from the vocabulary once, when it starts.
 * @param {object} vocab
 * @param {object[]} [vocab.members] Functions and classes, as in
 *     pythonLibraryVocab.json: { name, kind, description, parameters,
 *     resultType, path, category }.
 * @param {Record<string, object[]>} [vocab.methodsByType] Methods per class.
 */
export const addVocab = ({ members = [], methodsByType = {} } = {}) => {
    extraMembers.push(...members)
    for (const [typeName, methods] of Object.entries(methodsByType)) {
        ;(extraMethodsByType[typeName] ??= []).push(...methods)
    }
}

/** @returns {object} The vocabulary with every addition folded in. */
export const getVocab = () => {
    const base = pythonLibraryVocab.autocomplete ?? {}
    const methodsByType = { ...(base.methodsByType ?? {}) }
    for (const [typeName, methods] of Object.entries(extraMethodsByType)) {
        methodsByType[typeName] = [...(methodsByType[typeName] ?? []), ...methods]
    }
    return {
        ...pythonLibraryVocab,
        autocomplete: {
            ...base,
            members: [...(base.members ?? []), ...extraMembers],
            methodsByType,
        },
    }
}
