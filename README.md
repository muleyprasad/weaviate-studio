# Weaviate Studio - VS Code Extension

A VS Code extension for managing Weaviate vector database instances, browsing collections, and visualizing data with an intuitive interface.

## Features

- Connect to Weaviate instances
- Browse and manage collections
- Run GraphQL queries with syntax highlighting
- View query results in a structured format
- Visualize vector data
- Manage schema and data models

## Prerequisites

- Node.js (v14 or later)
- npm (v7 or later) or yarn
- VS Code (v1.85.0 or later)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/weaviate-studio.git
   cd weaviate-studio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Development Workflow

### Development Mode

To start the development environment with automatic rebuilding:

```bash
# In the project root directory
npm run dev
```

This will start two processes in parallel:
1. TypeScript compiler in watch mode for the extension code
2. Webpack in watch mode for the webview

### Launching the Extension

1. Open the project in VS Code
2. Press `F5` to start debugging
   - This will open a new VS Code window with the extension loaded

### Making Changes

- **Extension Code**: Changes to `.ts` files will be automatically compiled
- **Webview Code**: Changes to files in `src/webview/` will be automatically rebuilt

### Building for Production

To create a production build:

```bash
npm run package
```

This will create a VSIX package in the project root that can be installed in VS Code.

## Project Structure

- `src/extension.ts` - Main extension entry point
- `src/webview/` - Webview UI source code
  - `index.tsx` - Main webview component
  - `components/` - Reusable React components
  - `styles/` - CSS/SCSS files
- `resources/` - Icons and other static assets

## Available Scripts

- `npm run dev` - Start development mode (watch both extension and webview)
- `npm run watch:extension` - Watch extension TypeScript files
- `npm run watch:webview` - Watch webview files and rebuild
- `npm run build` - Build the extension for production
- `npm run package` - Create VSIX package for distribution
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Weaviate](https://weaviate.io/) - Vector database
- [VS Code Extension API](https://code.visualstudio.com/api)
- [React](https://reactjs.org/) - UI library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
