/**
 * URL parameters that shape the editor. Used by the embed page (`?embed`) and,
 * for `mode`, by the main page too.
 *
 *   mode=block|line            Which editor to show. Default block.
 *   toolbox=Motor,Time         Keep only these toolbox categories (by name,
 *                              case-insensitive). Default all.
 *   blocks=largemotor,spin     Keep only these block types. Categories left
 *                              empty are dropped. Default all.
 *   maxBlocks=5                Cap on blocks in the workspace. A counter shows
 *                              how many are left.
 *   maxInstances=spin:2,wait:1 Per-type caps, `type:count` pairs.
 *   preview=0                  Hide the Python pane beside the blocks.
 */

/**
 * Reads the editor parameters from a query string.
 * @param {URLSearchParams} params The page's query parameters.
 * @returns {{
 *   mode: 'block'|'line',
 *   categories: string[]|null,
 *   blocks: string[]|null,
 *   maxBlocks: number|undefined,
 *   maxInstances: Record<string, number>|undefined,
 *   codePreview: boolean,
 * }} Parsed options. Lists are null when the parameter is absent.
 */
export const readEditorParams = (params) => {
    const list = (name) => {
        const value = params.get(name)
        if (value === null) {
            return null
        }
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
    }

    const maxBlocks = Number.parseInt(params.get('maxBlocks') ?? '', 10)

    let maxInstances
    for (const pair of list('maxInstances') ?? []) {
        const [type, count] = pair.split(':')
        const limit = Number.parseInt(count ?? '', 10)
        if (type && Number.isFinite(limit) && limit >= 0) {
            maxInstances ??= {}
            maxInstances[type] = limit
        }
    }

    const preview = (params.get('preview') ?? '').toLowerCase()

    return {
        mode: params.get('mode') === 'line' ? 'line' : 'block',
        categories: list('toolbox'),
        blocks: list('blocks'),
        maxBlocks: Number.isFinite(maxBlocks) && maxBlocks > 0 ? maxBlocks : undefined,
        maxInstances,
        codePreview: !['0', 'false', 'off', 'no'].includes(preview),
    }
}

/**
 * Narrows a category toolbox to the requested categories and block types.
 * @param {object} toolbox Toolbox from processJengaTower.
 * @param {object} options
 * @param {string[]|null} [options.categories] Category names to keep, or null for all.
 * @param {string[]|null} [options.blocks] Block types to keep, or null for all.
 * @returns {object} A new toolbox with the same shape.
 */
export const filterToolbox = (toolbox, { categories = null, blocks = null } = {}) => {
    if (!categories && !blocks) {
        return toolbox
    }

    const wantedCategories = categories
        ? new Set(categories.map((name) => name.toLowerCase()))
        : null
    const wantedBlocks = blocks ? new Set(blocks) : null

    const contents = toolbox.contents
        .filter(
            (category) =>
                !wantedCategories ||
                wantedCategories.has(category.name.toLowerCase()),
        )
        .map((category) => ({
            ...category,
            contents: category.contents.filter(
                (block) => !wantedBlocks || wantedBlocks.has(block.type),
            ),
        }))
        .filter((category) => category.contents.length > 0)

    return { ...toolbox, contents }
}
