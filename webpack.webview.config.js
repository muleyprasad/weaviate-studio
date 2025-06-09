const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  target: 'web',
  mode: 'development', // Or 'production' for releases
  entry: './src/webview/index.tsx', // Assuming this is your webview entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'webview.bundle.js',
    publicPath: '', // Use relative paths for assets
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    fallback: {
      path: require.resolve('path-browserify'), // Polyfill for 'path' module in browser
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/webview/index.html', // Assuming you have an HTML template here
      filename: 'index.html',
      inject: false, // Prevent automatic script injection
    }),
    new MonacoWebpackPlugin({
      languages: ['graphql', 'json'], // Include GraphQL and JSON language features
      features: [
        'accessibilityHelp',
        'bracketMatching',
        'caretOperations',
        'clipboard',
        'codeAction',
        'codelens',
        'colorDetector',
        'comment',
        'contextmenu',
        'coreCommands',
        'cursorUndo',
        'dnd',
        'find',
        'folding',
        'fontZoom',
        'format',
        'gotoError',
        'gotoLine',
        'gotoSymbol',
        'hover',
        'iPadShowKeyboard',
        'inPlaceReplace',
        'inspectTokens',
        'linesOperations',
        'links',
        'multicursor',
        'parameterHints',
        'quickCommand',
        'quickHelp',
        'quickOutline',
        'referenceSearch',
        'rename',
        'smartSelect',
        'snippets',
        'suggest',
        'toggleHighContrast',
        'toggleTabFocusMode',
        'transpose',
        'unusualLineTerminators',
        'viewportSemanticTokens',
        'wordHighlighter',
        'wordOperations',
        'wordPartOperations',
      ],
      // filename: '[name].worker.[contenthash].js', // Optional: customize worker filenames
      publicPath: 'auto', // Let the plugin determine the public path for workers
    }),
  ],
  devtool: 'source-map',
  infrastructureLogging: {
    level: 'log',
  },
  stats: {
    errorDetails: true, // Show more details on errors
  },
};
