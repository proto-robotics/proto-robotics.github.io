/*
 * The Python vocabulary the line editor completes from and the checker
 * types against: every spliced library's `vocab` folded together. The core
 * library brings make's (pythonLibraryVocab.json, generated from make's
 * source by scripts/make-vocab.mjs); another library can add the names its
 * blocks write. Read it through getVocab(), so every library counts.
 */

/** The libraries' vocabularies, in the order they were added. */
const vocabs = []

/**
 * Adds a library's vocabulary. The engine (src/libraries/engine.js) calls
 * it when it registers a library, before an editor is built: the checker
 * writes its stub from the vocabulary when it starts.
 * @param {object} vocab In the shape of pythonLibraryVocab.json:
 *     { lint: { pythonVersion }, autocomplete: { members, methodsByType } }.
 */
export const addVocab = (vocab) => {
    vocabs.push(vocab)
}

/** @returns {object} The vocabularies folded together: the first one's lint settings, every one's names. */
export const getVocab = () => {
    const members = []
    const methodsByType = {}
    for (const { autocomplete = {} } of vocabs) {
        members.push(...(autocomplete.members ?? []))
        for (const [typeName, methods] of Object.entries(autocomplete.methodsByType ?? {})) {
            ;(methodsByType[typeName] ??= []).push(...methods)
        }
    }
    return {
        lint: vocabs.find((vocab) => vocab.lint)?.lint ?? {},
        autocomplete: { members, methodsByType },
    }
}
