---
title: Contributing to Weaviate Studio — Developer Setup & Workflow Guide
description: Complete guide to contributing to Weaviate Studio — local development setup, extension architecture, code conventions, testing, and pull request workflow.
---

# Contributing

We welcome contributions to Weaviate Studio! This guide is the **single source of truth** for contributor setup, conventions, and workflows.

::: tip Source of truth
The root [`CONTRIBUTING.md`](https://github.com/muleyprasad/weaviate-studio/blob/main/CONTRIBUTING.md) in the repository is a short stub that links here. GitHub still auto-detects that file (so the "Contribute" UI on issues/PRs keeps working), but all real content lives on this page. See [Documentation Structure](#documentation-structure) for the reasoning.
:::

## Prerequisites

- **Node.js** v16 or later
- **npm** v8 or later
- **VS Code** v1.80.0 or later
- **Git**

## Development Setup

### 1. Fork and Clone

Fork the repository on GitHub: <https://github.com/muleyprasad/weaviate-studio>. Then clone your fork (replace `YOUR_GITHUB_USERNAME`):

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

Press `F5` in VS Code (or use "Run Extension" from the Run and Debug panel) to launch the extension in development mode.

## Project Structure

```
src/
├── extension.ts                   # Main extension entry point
├── WeaviateTreeDataProvider/      # Tree view provider and tests
├── services/                      # Business logic (ConnectionManager, etc.)
├── types/                         # TypeScript definitions
├── views/                         # Custom views (including AddCollectionPanel)
├── query-editor/                  # GraphQL editor components
├── data-explorer/                 # Data Explorer panel, API, and React webview
├── rag-chat/                      # Generative Search module
│   ├── extension/                 #   RagChatPanel.ts, RagChatAPI.ts
│   ├── webview/                   #   RagChat.tsx, RagChat.css, index.tsx
│   └── types/                     #   Message/state/context-object interfaces
└── webview/                       # Shared React-based UI components
```

## Documentation Site

The companion website is built with [VitePress](https://vitepress.dev) and auto-deploys to GitHub Pages on every push to `main` (when `site/**` changes).

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

## Development Workflow

1. **Create a feature branch:** `git checkout -b feature/your-feature-name`
2. **Make your changes** following the coding standards below
3. **Add tests** for new functionality
4. **Update documentation** as needed (see [Documentation Structure](#documentation-structure))
5. **Test your changes:** `npm test && npm run lint`
6. **Build the project:**

   ```bash
   # Build everything
   npm run compile

   # Or build specific components
   npm run build:extension      # Main extension code
   npm run build:add-collection # Add Collection webview
   ```

7. **Commit using [Conventional Commits](https://www.conventionalcommits.org/):**
   ```bash
   git commit -m "feat: add your feature description"
   ```
8. **Push and open a pull request**

All PRs must pass linting and tests before merging.

## Commit Message Convention

| Prefix      | Usage                    |
| ----------- | ------------------------ |
| `feat:`     | New features             |
| `fix:`      | Bug fixes                |
| `docs:`     | Documentation changes    |
| `style:`    | Code style changes       |
| `refactor:` | Code refactoring         |
| `test:`     | Adding or updating tests |
| `chore:`    | Maintenance tasks        |

## Coding Standards

- Strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use functional React components with hooks
- Format with Prettier, lint with ESLint

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

For the full end-to-end testing checklist (installation, UI/UX, query editor, multi-vector search, performance, cross-platform, etc.), see the [Testing Guide](/guide/testing).

### Testing Add Collection UI

When making changes that affect the Add Collection flow:

```bash
npm test -- src/WeaviateTreeDataProvider/__tests__/AddCollection.test.ts
```

**Manual checklist:**

- [ ] Create new collection from scratch
- [ ] Clone existing collection (verify schema is prefilled)
- [ ] Import collection from file (verify schema is loaded)
- [ ] Test with different vectorizers
- [ ] Test with multi-tenant collections
- [ ] Verify error handling (invalid schema, network errors)

## Working with Dependencies

### Updating `weaviate-add-collection`

The Add Collection UI is provided by an external React component package: [`weaviate-add-collection`](https://github.com/weaviate/weaviate-add-collection).

**Live demo:** [https://weaviate.github.io/weaviate-add-collection/](https://weaviate.github.io/weaviate-add-collection/)

To update to the latest version:

```bash
npm install github:weaviate/weaviate-add-collection
```

Or pin to a specific commit, branch, or tag:

```bash
npm install github:weaviate/weaviate-add-collection#commit-hash
npm install github:weaviate/weaviate-add-collection#branch-name
npm install github:weaviate/weaviate-add-collection#v1.0.0
```

Then rebuild the webview and verify:

```bash
npm run build:add-collection
# Press F5 → test Create / Clone / Import flows
```

The version is locked in `package-lock.json`. Updates require network access since the package is installed from GitHub.

### Developing `weaviate-add-collection` Locally

If you need to make changes to the `weaviate-add-collection` component itself:

```bash
# 1. Clone the component repo as a sibling
cd ..
git clone https://github.com/weaviate/weaviate-add-collection.git
cd weaviate-add-collection
npm install

# 2. Link it
npm link
cd ../weaviate-studio
npm link weaviate-add-collection

# 3. Make changes in weaviate-add-collection

# 4. Rebuild in weaviate-studio
npm run build:add-collection

# 5. Press F5 to test

# 6. Unlink when done
npm unlink weaviate-add-collection
npm install
```

Always submit changes to the `weaviate-add-collection` repo first, then bump the dependency in `weaviate-studio`.

## Telemetry Development

The extension uses **Azure Application Insights** for anonymous usage telemetry. In production builds, the connection string is injected at build time via CI/CD secrets. Telemetry is automatically disabled when no connection string is available — no errors, no user impact.

| Environment | Connection String     | Result                |
| ----------- | --------------------- | --------------------- |
| Local dev   | Not set               | ❌ Telemetry disabled |
| Local debug | Set via env var       | ✅ Telemetry enabled  |
| CI/CD       | Set via GitHub Secret | ✅ Telemetry enabled  |

### Testing Telemetry Locally

```bash
export APPLICATION_INSIGHTS_CONN_STRING="your-connection-string"
npm install && npm run compile && npm run build:webview && npm run build:add-collection
```

Then restart VS Code. Events will appear in your Application Insights resource. Get your connection string from **Azure Portal → Application Insights → Overview → Connection String**.

### Telemetry Event Naming Convention

| Event Type           | Pattern                       | Example                      |
| -------------------- | ----------------------------- | ---------------------------- |
| Feature activation   | `{feature}.opened`            | `queryEditor.opened`         |
| Operation completion | `{feature}.{action}Completed` | `queryEditor.queryCompleted` |

Events should be added to `src/telemetry/TelemetryTypes.ts` and tracked in the appropriate `createOrShow()` method for panels.

### Dashboards

Deploy pre-built Azure dashboards for monitoring extension usage:

```bash
cd scripts/telemetry
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

# Interactive mode (prompts for cleanup choice)
./deploy.sh

# Or use command-line flags for CI/CD:
./deploy.sh --cleanup        # Cleanup first, then deploy
./deploy.sh --skip-cleanup   # Deploy without cleanup
```

See [docs/TELEMETRY_DASHBOARDS.md](https://github.com/muleyprasad/weaviate-studio/blob/main/docs/TELEMETRY_DASHBOARDS.md) for detailed dashboard documentation and Kusto queries.

### CI/CD Telemetry Injection

The GitHub Actions pipeline injects `APPLICATION_INSIGHTS_CONN_STRING` from the repository secret of the same name. See `.github/workflows/ci.yml` for details.

## Documentation Structure

To avoid documentation drift, Weaviate Studio follows a **single-source-of-truth-per-document** model:

| Document           | Source of Truth                              | Why                                                                                                                              |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`        | **Repository root** (rich)                   | VS Code Marketplace ingests `README.md` directly as the listing page; it must stay self-contained, image-rich, and detailed.     |
| `CHANGELOG.md`     | **Repository root** (rich)                   | Consumed by `vsce` packaging, the VS Code Marketplace's "Changelog" tab, and GitHub Releases. Tooling expects it at the root.    |
| `LICENSE`          | **Repository root**                          | Standard convention; tooling and GitHub require it at the root.                                                                  |
| `CONTRIBUTING.md`  | **This page** (`site/guide/contributing.md`) | Root file is a stub so GitHub's "Contribute" UI still surfaces it on issues/PRs, but the content lives on the companion website. |
| `RELEASE_GUIDE.md` | **`site/guide/release.md`**                  | Internal maintainer doc; one comprehensive copy on the site.                                                                     |
| `TESTING_GUIDE.md` | **`site/guide/testing.md`**                  | Internal maintainer doc; one comprehensive copy on the site.                                                                     |
| Feature guides     | **`site/features/*.md`**                     | Discoverable, searchable, and cross-linked on the public site.                                                                   |

**Rule:** if a document exists in both `site/` and at the repo root, the **root copy must be a stub** (a brief description + a link to the site). This prevents duplication and ensures updates only need to happen in one place.

The few cases where content **is** duplicated (README and CHANGELOG) are listed above with explicit reasons — both are consumed by external tooling that does not know how to follow links.

## Bug Reports & Feature Requests

Please use [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues). Include clear steps to reproduce, environment details, and screenshots if applicable.

---

Thank you for contributing to Weaviate Studio!
