const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isProduction = process.env.NODE_ENV === 'production';

// Ensure that all automatically injected <script> tags include the nonce placeholder expected by
// VS Code's webview template ({{nonce}}). Without this each bundle is blocked by the CSP that
// requires a matching nonce value. The runtime extension code later replaces the placeholder with
// the real nonce.
class WebviewNoncePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('WebviewNoncePlugin', (compilation) => {
      const HtmlWebpackPlugin = require('html-webpack-plugin');

      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap(
        'WebviewNoncePlugin',
        (data) => {
          const addNonce = (tag) => {
            if (tag.tagName === 'script' || tag.tagName === 'link') {
              tag.attributes = tag.attributes || {};
              // VS Code extension will replace this placeholder at runtime.
              tag.attributes.nonce = '{{nonce}}';
            }
          };

          data.headTags.forEach(addNonce);
          data.bodyTags.forEach(addNonce);
        }
      );
    });
  }
}

module.exports = {
  target: 'web',
  mode: isProduction ? 'production' : 'development',
  entry: {
    main: './src/webview/index.tsx',
    backup: './src/webview/Backup.tsx',
    'backup-restore': './src/webview/BackupRestore.tsx',
    cluster: './src/webview/ClusterPanel.tsx',
    'data-explorer': './src/data-explorer/webview/index.tsx',
    alias: './src/webview/Alias.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: isProduction ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
    chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
    publicPath: '',
    clean: true, // Clean the output directory before each build
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco',
          chunks: 'all',
          priority: 20,
        },
        sharedStyles: {
          test: /[\\/]src[\\/]webview[\\/]theme\.css$/,
          name: 'shared-theme',
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
      },
    },
    usedExports: true,
    sideEffects: false,
    minimize: isProduction,
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
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/webview/index.html',
      filename: 'index.html',
      chunks: ['main'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new HtmlWebpackPlugin({
      template: './src/webview/backup.html',
      filename: 'backup.html',
      chunks: ['backup'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new HtmlWebpackPlugin({
      template: './src/webview/backup-restore.html',
      filename: 'backup-restore.html',
      chunks: ['backup-restore'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new HtmlWebpackPlugin({
      template: './src/webview/cluster.html',
      filename: 'cluster.html',
      chunks: ['cluster'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new HtmlWebpackPlugin({
      template: './src/data-explorer/webview/data-explorer.html',
      filename: 'data-explorer.html',
      chunks: ['data-explorer'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new HtmlWebpackPlugin({
      template: './src/webview/alias.html',
      filename: 'alias.html',
      chunks: ['alias'],
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    // Attach the nonce placeholder to every injected script tag.
    new WebviewNoncePlugin(),
    new MiniCssExtractPlugin({
      filename: isProduction ? '[name].[contenthash].css' : '[name].css',
    }),
    new MonacoWebpackPlugin({
      languages: ['json'], // Rely on custom monaco-graphql language bundle
      customLanguages: [
        {
          label: 'graphql',
          entry: 'monaco-graphql/esm/monaco.contribution.js',
          worker: {
            id: 'graphql',
            entry: 'monaco-graphql/esm/graphql.worker.js',
          },
        },
      ],
      features: [
        // Essential features only to reduce bundle size
        'bracketMatching',
        'clipboard',
        'codeAction',
        'comment',
        'contextmenu',
        'coreCommands',
        'find',
        'folding',
        'format',
        'hover',
        'linesOperations',
        'multicursor',
        'suggest',
        'wordHighlighter',
        'wordOperations',
      ],
      filename: '[name].worker.[contenthash].js',
      publicPath: '',
    }),
  ],
  devtool: isProduction ? 'hidden-source-map' : 'source-map',
  performance: {
    maxAssetSize: 4000000, // 4MB - Monaco bundle is large by nature
    maxEntrypointSize: 5000000, // 5MB - Main entrypoint includes Monaco
    hints: isProduction ? 'warning' : false, // Only show warnings in production
  },
  infrastructureLogging: {
    level: 'log',
  },
  stats: {
    errorDetails: true,
    chunks: false,
    modules: false,
  },
};
