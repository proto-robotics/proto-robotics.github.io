/*
 * A block the editor does not have: one from a library this editor was
 * not given (a sandbox's Move forward in a robot program), or one from
 * before a block was renamed or retired. It loads as a grey stand-in that
 * keeps the whole block (and what is inside it) and saves it again
 * unchanged, so nothing is lost; an editor that has the block loads the
 * real one. The linter marks the stand-in (blockLinter.js), so the learner
 * sees which block cannot run here, and its Python stops the program with
 * the same words rather than skipping the block.
 */

import { common, FieldLabel } from 'blockly'
import { pythonGenerator } from 'blockly/python'

import { blockEntries } from './engine'

/** The stand-in for a statement block, and for one in a slot. */
export const UNKNOWN_BLOCK = 'unknownBlock'
export const UNKNOWN_VALUE = 'unknownValue'

/**
 * What a block is called for a learner: its words from the library that
 * has it, or its type.
 * @param {string} type
 * @returns {string}
 */
export const blockLabel = (type) => {
    const found = blockEntries[type]
    if (!found) {
        return type
    }
    return found.entry.blocklyTemplate
        .map((part) => (part.text ?? '…').trim())
        .filter(Boolean)
        .filter((word, i, all) => !(word === '…' && all[i - 1] === '…'))
        .join(' ')
}

/**
 * Why a stand-in cannot run, in a learner's words.
 * @param {string} type The block it stands in for.
 * @returns {string}
 */
export const unknownMessage = (type) =>
    blockEntries[type]
        ? `${blockLabel(type)} is not one of this editor's blocks, so this program cannot run it here. Take it out.`
        : `This block (${type}) is not a block any more. Take it out and use one from the toolbox.`

const standIn = {
    init() {
        this.appendDummyInput().appendField(new FieldLabel('?'), 'label')
        this.setColour('#9a9a9a')
        this.setInputsInline(true)
        this.original_ = null
    },
    saveExtraState() {
        return { original: this.original_ }
    },
    loadExtraState(state) {
        this.original_ = state?.original ?? null
        this.setFieldValue(`${blockLabel(this.original_?.type ?? '?')} (can't run here)`, 'label')
        this.setTooltip(unknownMessage(this.original_?.type ?? '?'))
    },
}

common.defineBlocks({
    [UNKNOWN_BLOCK]: {
        ...standIn,
        init() {
            standIn.init.call(this)
            this.setPreviousStatement(true, null)
            this.setNextStatement(true, null)
        },
    },
    [UNKNOWN_VALUE]: {
        ...standIn,
        init() {
            standIn.init.call(this)
            this.setOutput(true, null)
        },
    },
})

const stop = (block) => `raise RuntimeError(${JSON.stringify(unknownMessage(block.original_?.type ?? '?'))})`
pythonGenerator.forBlock[UNKNOWN_BLOCK] = (block) => `${stop(block)}\n`
pythonGenerator.forBlock[UNKNOWN_VALUE] = (block) => [`(lambda: (_ for _ in ()).throw(RuntimeError(${JSON.stringify(unknownMessage(block.original_?.type ?? '?'))})))()`, 0]

/**
 * A saved program with every block the editor does not have swapped for a
 * stand-in holding it, and every stand-in whose block the editor now has
 * swapped back. A stand-in for a block under another (`next`) keeps the
 * blocks under it as real blocks.
 * @param {object} state A serialized workspace.
 * @param {(type: string) => boolean} known Whether the editor has a block type.
 * @returns {object}
 */
export const standInForUnknown = (state, known) => {
    /** Is this input of the parent a statement input (blocks stack in it)? */
    const statementInput = (parentType, name) =>
        blockEntries[parentType]?.entry.blocklyTemplate.some(
            (part) => part.blocklyInput?.name === name && part.blocklyInput?.type === 'Void',
        ) ?? true
    const visit = (blockState, statement) => {
        if (!blockState || typeof blockState !== 'object') {
            return blockState
        }
        // a stand-in whose block is known now: the real block again
        if ((blockState.type === UNKNOWN_BLOCK || blockState.type === UNKNOWN_VALUE) && blockState.extraState?.original) {
            const original = blockState.extraState.original
            if (known(original.type)) {
                return visit({ ...original, ...(blockState.next ? { next: blockState.next } : {}) }, statement)
            }
        }
        if (blockState.type && !known(blockState.type) && blockState.type !== UNKNOWN_BLOCK && blockState.type !== UNKNOWN_VALUE) {
            // eslint-disable-next-line no-unused-vars
            const { next, x, y, id, ...original } = blockState
            return {
                type: statement ? UNKNOWN_BLOCK : UNKNOWN_VALUE,
                ...(id ? { id } : {}),
                ...(x !== undefined ? { x, y } : {}),
                extraState: { original },
                ...(statement && next?.block ? { next: { block: visit(next.block, true) } } : {}),
            }
        }
        const inputs = Object.fromEntries(
            Object.entries(blockState.inputs ?? {}).map(([name, input]) => [
                name,
                {
                    ...input,
                    ...(input?.block ? { block: visit(input.block, statementInput(blockState.type, name)) } : {}),
                },
            ]),
        )
        return {
            ...blockState,
            ...(blockState.inputs ? { inputs } : {}),
            ...(blockState.next?.block ? { next: { ...blockState.next, block: visit(blockState.next.block, true) } } : {}),
        }
    }
    if (!state?.blocks?.blocks) {
        return state
    }
    return { ...state, blocks: { ...state.blocks, blocks: state.blocks.blocks.map((b) => visit(b, true)) } }
}
