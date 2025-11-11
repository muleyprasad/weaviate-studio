const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
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

// Plugin to inject CSS styles inline into the HTML for better VS Code webview compatibility
class InjectCssPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('InjectCssPlugin', (compilation) => {
      const HtmlWebpackPlugin = require('html-webpack-plugin');
      
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        'InjectCssPlugin',
        (data, cb) => {
          const cssFiles = [
            { path: path.resolve(__dirname, 'src/webview/theme.css'), name: 'VS Code Theme Base', required: true },
            { path: path.resolve(__dirname, 'node_modules/weaviate-add-collection/src/styles.css'), name: 'Component Library Styles', required: true },
            { path: path.resolve(__dirname, 'src/webview/AddCollection.override.css'), name: 'VS Code Theme Overrides', required: true },
            { path: path.resolve(__dirname, 'src/webview/AddCollection.css'), name: 'Custom Webview Styles', required: true },
          ];

          try {
            // Validate all CSS files exist before reading
            const missingFiles = cssFiles.filter(file => !fs.existsSync(file.path));
            if (missingFiles.length > 0) {
              const errorMsg = `InjectCssPlugin: Missing required CSS files:\n${missingFiles.map(f => `  - ${f.name}: ${f.path}`).join('\n')}`;
              compilation.errors.push(new Error(errorMsg));
              return cb(new Error(errorMsg));
            }

            // Read all CSS files
            const cssContents = cssFiles.map(file => {
              try {
                const content = fs.readFileSync(file.path, 'utf8');
                return { ...file, content };
              } catch (error) {
                const errorMsg = `InjectCssPlugin: Failed to read ${file.name} (${file.path}): ${error.message}`;
                throw new Error(errorMsg);
              }
            });
            
            // Combine all CSS
            const allCss = cssContents.map(({ name, content }) => 
              `/* ${name} */\n${content}`
            ).join('\n\n');
            
            // Inject CSS into HTML
            const injectedHtml = data.html.replace(
              '</head>',
              `<style id="injected-styles">${allCss}</style></head>`
            );

            // Verify injection succeeded
            if (injectedHtml === data.html) {
              const errorMsg = 'InjectCssPlugin: Failed to inject CSS - </head> tag not found in HTML template';
              compilation.errors.push(new Error(errorMsg));
              return cb(new Error(errorMsg));
            }

            data.html = injectedHtml;
            cb(null, data);
          } catch (error) {
            // Log to console for immediate visibility
            console.error('\x1b[31m%s\x1b[0m', `❌ ${error.message}`);
            // Add to compilation errors to fail the build
            compilation.errors.push(error);
            cb(error);
          }
        }
      );
    });
  }
}

module.exports = {
  target: 'web',
  mode: isProduction ? 'production' : 'development',
  entry: './src/webview/AddCollection.tsx',
  output: {
    path: path.resolve(__dirname, 'dist', 'webview-add-collection'),
    filename: isProduction ? '[name].[contenthash].bundle.js' : '[name].bundle.js',
    chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
    publicPath: '',
    clean: true,
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
      },
    },
    usedExports: true,
    sideEffects: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
    fallback: {
      path: require.resolve('path-browserify'),
    },
    alias: {
      // Force all react imports to use the same instance
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
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
        test: /\.jsx?$/,
        exclude: /node_modules\/(?!weaviate-add-collection)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-react',
              ['@babel/preset-env', { targets: { node: 'current' } }]
            ],
          },
        },
      },
      // CSS is now injected inline, so we skip the loaders
      {
        test: /\.css$/,
        use: 'null-loader',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/webview/add-collection.html',
      filename: 'index.html',
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    new InjectCssPlugin(),
    new WebviewNoncePlugin(),
    ...(isProduction
      ? [new MiniCssExtractPlugin({
          filename: '[name].[contenthash].css',
          chunkFilename: '[id].[contenthash].css',
        })]
      : []),
  ],
  devtool: isProduction ? 'hidden-source-map' : 'inline-source-map',
};

