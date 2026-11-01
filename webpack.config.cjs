const fs = require('fs')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

/*
 * Two builds: the site (dist/) and the editor as a library (dist/lib/) for
 * a page that renders the editor itself, see src/lib.js.
 *
 * Every built file of the site except index.html carries a content hash in
 * its name, so a deploy never changes a file in place. GitHub Pages lets
 * browsers cache JS, CSS and fonts for hours; a page holding a stale copy of
 * one of those used to request files that no longer existed. Now index.html
 * (cached for ten minutes at most) is the only file that changes in place,
 * and it always points at the matching hashed files.
 */

const resolve = {
    alias: {
        // Force any import of "blockly" (including inside linked jenga)
        // to use THIS project's copy:
        blockly: path.resolve(__dirname, 'node_modules/blockly'),
    },
    symlinks: true,
}

const fontRule = {
    test: /\.(ttf|otf|woff2?)$/i,
    type: 'asset/resource',
    generator: {
        filename: 'assets/fonts/[name].[contenthash][ext]',
    },
}

const copyImages = { from: 'assets/images', to: 'assets/images' }

const site = {
    name: 'site',
    entry: {
        bundled: './src/main.js',
    },
    resolve,
    // Emit a real ES module. The bundle then finds its own URL through
    // import.meta.url, so asset URLs (the Pyrefly wasm) resolve next to it.
    // A classic script cannot do that when loaded with type="module":
    // document.currentScript is null there, and webpack's fallback picks the
    // last <script> on the page, which on the live site is the analytics
    // beacon Cloudflare injects at the end of <body>.
    experiments: {
        outputModule: true,
    },
    output: {
        module: true,
        filename: '[name].[contenthash].js',
        assetModuleFilename: '[name].[contenthash][ext]',
        path: path.resolve(__dirname, 'dist'),
        // Relative URLs, so dist/ works served from the site root or from a
        // subfolder such as Live Server on the repo root.
        publicPath: 'auto',
        clean: {
            // the library build writes dist/lib beside this one
            keep: /^lib\//,
        },
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            fontRule,
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' }),
        new HtmlWebpackPlugin({
            // Read the template directly: the plugin's template loader emits
            // a `with` statement, which webpack rejects for ES module output.
            templateContent: () =>
                fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8'),
            scriptLoading: 'module',
        }),
        new CopyWebpackPlugin({
            patterns: [
                // Images are looked up by path at runtime (see src/assets.js),
                // so they keep their names.
                copyImages,
                { from: 'favicon.ico' },
                { from: 'CNAME', to: 'CNAME', toType: 'file' },
            ],
        }),
    ],
    devServer: {
        // templateContent bypasses webpack's dependency tracking for the
        // template, so watch it explicitly.
        watchFiles: ['index.html'],
        port: 5501,
        open: true,
        hot: false,
        liveReload: true,
    },
    mode: 'development',
}

/** The class of the library editor's root element. */
const LIB_ROOT = '.proto-ide'

/**
 * Scopes the stylesheet to the editor's root element for the library build:
 * `body` and `html` become the root itself, every other top-level selector
 * gets the root as an ancestor, and the cascade layers are flattened (a
 * host page's unlayered styles would otherwise beat all of them).
 * @returns {import('postcss').Plugin}
 */
const scopeToRoot = () => ({
    postcssPlugin: 'scope-to-root',
    Once(css) {
        // flatten @layer blocks in place, innermost first
        for (;;) {
            const layers = []
            css.walkAtRules('layer', (atRule) => layers.push(atRule))
            if (layers.length === 0) {
                break
            }
            for (const atRule of layers.reverse()) {
                if (atRule.nodes) {
                    atRule.replaceWith(...atRule.nodes)
                } else {
                    atRule.remove()
                }
            }
        }
        css.walkRules((rule) => {
            // nested rules are relative to their parent; keyframe steps are
            // not selectors
            if (rule.parent.type === 'rule') {
                return
            }
            if (
                rule.parent.type === 'atrule' &&
                /keyframes$/.test(rule.parent.name)
            ) {
                return
            }
            rule.selectors = rule.selectors.map((selector) => {
                const trimmed = selector.trim()
                if (/^(html|body)(?![\w-])/.test(trimmed)) {
                    return trimmed.replace(/^(html|body)/, LIB_ROOT)
                }
                if (trimmed.startsWith(LIB_ROOT)) {
                    return trimmed
                }
                return `${LIB_ROOT} ${trimmed}`
            })
        })
    },
})
scopeToRoot.postcss = true

const lib = {
    name: 'lib',
    entry: {
        'proto-ide': './src/lib.js',
    },
    resolve,
    experiments: {
        outputModule: true,
    },
    output: {
        module: true,
        library: { type: 'module' },
        // fixed names: the host links them by path
        filename: '[name].js',
        chunkFilename: '[name].[contenthash].js',
        assetModuleFilename: '[name].[contenthash][ext]',
        path: path.resolve(__dirname, 'dist', 'lib'),
        publicPath: 'auto',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: { plugins: [scopeToRoot()] },
                        },
                    },
                ],
            },
            fontRule,
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: '[name].css' }),
        new CopyWebpackPlugin({ patterns: [copyImages] }),
    ],
    mode: 'development',
}

module.exports = [site, lib]
