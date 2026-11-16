// The unit tests (tests/*.test.js), run with `npm test`. Blockly and the
// editor's modules expect a page, so they run in jsdom.
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
    },
})
