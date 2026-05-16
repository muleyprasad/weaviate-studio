# Contributing

We welcome contributions to Weaviate Studio! This guide will help you get set up for development.

## Prerequisites

- **Node.js** v16 or later
- **npm** v8 or later
- **VS Code** v1.80.0 or later
- **Git**

## Development Setup

### 1. Fork and Clone

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/weaviate-studio.git
cd weaviate-studio
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development

```bash
npm run dev
```

### 4. Launch Extension

Press `F5` in VS Code to launch the extension in development mode.

## Project Structure

```
src/
├── extension.ts                   # Main extension entry point
├── WeaviateTreeDataProvider/      # Tree view provider
├── services/                      # Business logic (ConnectionManager, etc.)
├── types/                         # TypeScript definitions
├── views/                         # Custom views and panels
├── query-editor/                  # GraphQL editor components
├── data-explorer/                 # Data Explorer panel and React webview
├── rag-chat/                      # Generative Search module
└── webview/                       # Shared React-based UI components
```

## Documentation Site

The companion website is built with [VitePress](https://vitepress.dev) and auto-deployed to GitHub Pages on every push to `main` (when `site/**` changes).

**Live site:** [https://muleyprasad.github.io/weaviate-studio/](https://muleyprasad.github.io/weaviate-studio/)

```bash
# Start docs dev server (hot-reload)
npm run docs:dev

# Build docs for production
npm run docs:build

# Preview production build locally
npm run docs:preview
```

The deployment is handled by `.github/workflows/deploy-docs.yml` — no manual steps required.

## Coding Standards

- Strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use functional React components with hooks
- Format with Prettier, lint with ESLint

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | Usage                    |
| ----------- | ------------------------ |
| `feat:`     | New features             |
| `fix:`      | Bug fixes                |
| `docs:`     | Documentation changes    |
| `style:`    | Code style changes       |
| `refactor:` | Code refactoring         |
| `test:`     | Adding or updating tests |
| `chore:`    | Maintenance tasks        |

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Write unit tests for utility functions and integration tests for components.

## Telemetry Development

To test telemetry locally, set the environment variable and rebuild:

```bash
export APPLICATION_INSIGHTS_CONN_STRING="your-connection-string"
npm install && npm run compile && npm run build:webview && npm run build:add-collection
```

Telemetry is automatically disabled when no connection string is available.

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes following coding standards
3. Add tests for new functionality
4. Run `npm test` and `npm run lint`
5. Commit using conventional commit format
6. Push and open a pull request

All PRs must pass linting and tests before merging.
