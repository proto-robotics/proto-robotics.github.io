const path = require('path')

module.exports = {
    entry: {
        bundled: './src/main.js',
        test: './src/test.js',
    },
    resolve: {
      alias: {
        // Force any import of "blockly" (including inside linked jenga)
        // to use THIS project's copy:
        blockly: path.resolve(__dirname, 'node_modules/blockly'),
      },
      // optional but often helpful:
      symlinks: true,
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '.'),
    },
    mode: 'development',
}
