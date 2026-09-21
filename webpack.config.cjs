const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

/*
 * Every built file except index.html carries a content hash in its name, so a
 * deploy never changes a file in place. GitHub Pages lets browsers cache JS,
 * CSS and fonts for hours; a page holding a stale copy of one of those used to
 * request files that no longer existed. Now index.html (cached for ten
 * minutes at most) is the only file that changes in place, and it always
 * points at the matching hashed files.
 */
module.exports = {
    entry: {
        bundled: './src/main.js',
    },
    resolve: {
        alias: {
            // Force any import of "blockly" (including inside linked jenga)
            // to use THIS project's copy:
            blockly: path.resolve(__dirname, 'node_modules/blockly'),
        },
        symlinks: true,
    },
    output: {
        filename: '[name].[contenthash].js',
        assetModuleFilename: '[name].[contenthash][ext]',
        path: path.resolve(__dirname, 'dist'),
        // Relative URLs, so dist/ works served from the site root or from a
        // subfolder such as Live Server on the repo root.
        publicPath: 'auto',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.(ttf|otf|woff2?)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[name].[contenthash][ext]',
                },
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' }),
        new HtmlWebpackPlugin({
            template: './index.html',
            scriptLoading: 'module',
        }),
        new CopyWebpackPlugin({
            patterns: [
                // Images are looked up by path at runtime (see src/assets.js),
                // so they keep their names.
                { from: 'assets/images', to: 'assets/images' },
                { from: 'favicon.ico' },
                { from: 'CNAME', to: 'CNAME', toType: 'file' },
            ],
        }),
    ],
    devServer: {
        port: 5501,
        open: true,
        hot: false,
        liveReload: true,
    },
    mode: 'development',
}
