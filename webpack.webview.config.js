const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  target: 'web',
  mode: isProduction ? 'production' : 'development',
  entry: './src/webview/index.tsx',
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
      inject: 'body',
      scriptLoading: 'defer',
      minify: isProduction,
    }),
    ...(isProduction ? [new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    })] : []),
    new MonacoWebpackPlugin({
      languages: ['graphql', 'json'], // Only include needed languages
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
