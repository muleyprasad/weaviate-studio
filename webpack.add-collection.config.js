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
          try {
            // Read all CSS files
            const themeCss = fs.readFileSync(path.resolve(__dirname, 'src/webview/theme.css'), 'utf8');
            const componentCss = fs.readFileSync(path.resolve(__dirname, 'node_modules/weaviate-add-collection/src/styles.css'), 'utf8');
            const overrideCss = fs.readFileSync(path.resolve(__dirname, 'src/webview/AddCollection.override.css'), 'utf8');
            const customCss = fs.readFileSync(path.resolve(__dirname, 'src/webview/AddCollection.css'), 'utf8');
            
            // Combine all CSS
            const allCss = `
              /* VS Code Theme Base */
              ${themeCss}
              
              /* Component Library Styles */
              ${componentCss}
              
              /* VS Code Theme Overrides */
              ${overrideCss}
              
              /* Custom Webview Styles */
              ${customCss}
            `;
            
            // Inject CSS into HTML
            data.html = data.html.replace(
              '</head>',
              `<style id="injected-styles">${allCss}</style></head>`
            );
          } catch (error) {
            console.error('Error injecting CSS:', error);
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

