# Release Guide

This guide covers the complete process for releasing the Weaviate Studio extension.

## Pre-Release Checklist

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run compile && npm run build:webview && npm run build:add-collection`
- [ ] Manual testing completed
- [ ] README, CHANGELOG, and [companion website](https://muleyprasad.github.io/weaviate-studio/) updated
- [ ] Version bumped in `package.json`## CI/CD Workflows

Weaviate Studio uses **two GitHub Actions workflows**:

| Workflow           | File                                | Trigger                                  | Purpose                                                |
| ------------------ | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| **CI/CD Pipeline** | `.github/workflows/ci.yml`          | Push to `main`/`develop`, PR, or Release | Lint, test, build, and publish the extension           |
| **Deploy Docs**    | `.github/workflows/deploy-docs.yml` | Push to `main` (when `site/**` changes)  | Build and deploy the companion website to GitHub Pages |

### Extension Publishing (ci.yml)

The CI/CD pipeline in `.github/workflows/ci.yml` handles automated extension releases.

### Quick Release Steps

1. **Pick the next version** ([Semantic Versioning](https://semver.org)):

   - Patch fix → `1.0.0` → `1.0.1`
   - Back-compatible feature → `1.1.0`
   - Breaking change → `2.0.0`

2. **Update metadata**:

```bash
npm version patch|minor|major --no-git-tag-version
```

Edit `CHANGELOG.md` with the new version section.

3. **Commit and push**:

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): 1.0.1"
git push origin main
```

4. **Tag and publish**:

```bash
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1
```

Then create a GitHub Release — the CI/CD pipeline publishes automatically to the VS Code Marketplace and Open VSX.

## What the CI/CD Pipeline Does

1. Runs lint and tests
2. Builds the extension (extension + webview + add-collection)
3. Packages with `vsce`
4. Publishes to VS Code Marketplace
5. Publishes to Open VSX Registry
6. Attaches `.vsix` as a release artifact

## What the Docs Deploy Workflow Does

1. Triggers on push to `main` when files in `site/` change
2. Installs dependencies (`npm ci`)
3. Builds the VitePress site (`npm run docs:build`)
4. Deploys to GitHub Pages at `https://muleyprasad.github.io/weaviate-studio/`

No manual steps needed — just push documentation changes to `main`.

## Required GitHub Secrets

| Secret                             | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| `VSCE_PAT`                         | VS Code Marketplace publishing token |
| `OVSX_PAT`                         | Open VSX Registry publishing token   |
| `APPLICATION_INSIGHTS_CONN_STRING` | Telemetry connection string          |

## Marketplace Platforms

| Platform                                                                                               | Publisher     | CLI Tool |
| ------------------------------------------------------------------------------------------------------ | ------------- | -------- |
| [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio) | `prasadmuley` | `vsce`   |
| [Open VSX](https://open-vsx.org/extension/prasadmuley/weaviate-studio)                                 | `prasadmuley` | `ovsx`   |

## Release Notes Style

Releases follow a "Product Update" format:

- Catchy title with version and theme
- Highlights section with "Why this matters" context
- Visual categorization with consistent emojis
- PR and Issue links
- Installation matrix

Example:

```
v1.7.0 — MULTI-VECTOR SEARCH & BACKUP IMPROVEMENTS 🔍💾

We're thrilled to announce v1.7.0, which brings full support for
Weaviate's named-vector / Muvera search and improved backup UX.

🌟 HIGHLIGHTS
- Multi-Target Vector Search: Query across multiple vector spaces...
- Backup Wildcard Support: Select all collections at once using *...
```

## Post-Release

- Monitor download counts on each marketplace
- Check for user feedback and issues
- Update the [companion website](https://muleyprasad.github.io/weaviate-studio/) with release highlights
- Verify the docs site auto-deployed correctly (check the **Deploy Docs** workflow in GitHub Actions)
