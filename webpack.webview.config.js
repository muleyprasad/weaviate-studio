const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

// Ensure that all automatically injected <script> tags include the nonce placeholder expected by
// VS Code's webview template ({{nonce}}). Without this each bundle is blocked by the CSP that
// requires a matching nonce value. The runtime extension code later replaces the placeholder with
// the real nonce.
class WebviewNoncePlugin {
  apply (compiler) {
    compiler.hooks.compilation.tap('WebviewNoncePlugin', (compilation) => {
      const HtmlWebpackPlugin = require('html-webpack-plugin');

      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap(
        'WebviewNoncePlugin',
        (data) => {
          const addNonce = (tag) => {
            if (tag.tagName === 'script') {
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

// Plugin to inject CSS styles inline into the HTML for backup webview
class InjectBackupCssPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('InjectBackupCssPlugin', (compilation) => {
      const HtmlWebpackPlugin = require('html-webpack-plugin');
      
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        'InjectBackupCssPlugin',
        (data, cb) => {
          // Inject CSS for backup.html
          if (data.outputName.includes('backup.html')) {
            const cssFiles = [
              { path: path.resolve(__dirname, 'src/webview/theme.css'), name: 'VS Code Theme Base' },
              { path: path.resolve(__dirname, 'src/webview/Backup.css'), name: 'Custom Backup Styles' },
            ];

            try {
              let cssContent = '';
              cssFiles.forEach(({ path: filePath, name }) => {
                if (fs.existsSync(filePath)) {
                  const content = fs.readFileSync(filePath, 'utf8');
                  cssContent += `\n/* ${name} */\n${content}\n`;
                }
              });

              if (cssContent) {
                data.html = data.html.replace(
                  '</head>',
                  `<style nonce="{{nonce}}">${cssContent}</style></head>`
                );
              }

              cb(null, data);
            } catch (err) {
              console.error('Error injecting CSS:', err);
              cb(err);
            }
            return;
          }
          
          // Inject CSS for backup-restore.html
          if (data.outputName.includes('backup-restore.html')) {
            const cssFiles = [
              { path: path.resolve(__dirname, 'src/webview/theme.css'), name: 'VS Code Theme Base' },
              { path: path.resolve(__dirname, 'src/webview/BackupRestore.css'), name: 'Custom Backup Restore Styles' },
            ];

            try {
              let cssContent = '';
              cssFiles.forEach(({ path: filePath, name }) => {
                if (fs.existsSync(filePath)) {
                  const content = fs.readFileSync(filePath, 'utf8');
                  cssContent += `\n/* ${name} */\n${content}\n`;
                }
              });

              if (cssContent) {
                data.html = data.html.replace(
                  '</head>',
                  `<style nonce="{{nonce}}">${cssContent}</style></head>`
                );
              }

              cb(null, data);
            } catch (err) {
              console.error('Error injecting CSS:', err);
              cb(err);
            }
            return;
          }

          cb(null, data);
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
      },
    },
    usedExports: true,
    sideEffects: false,
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
        use: isProduction
          ? [MiniCssExtractPlugin.loader, 'css-loader']
          : ['style-loader', 'css-loader'],
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
    // Attach the nonce placeholder to every injected script tag.
    new WebviewNoncePlugin(),
    // Inject CSS for backup webview
    new InjectBackupCssPlugin(),
    ...(isProduction ? [new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    })] : []),
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
    maxAssetSize: 1000000, // 1MB
    maxEntrypointSize: 1000000, // 1MB
    hints: 'warning',
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
