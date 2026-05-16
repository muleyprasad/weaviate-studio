---
title: Release Guide — Publishing Weaviate Studio to VS Code Marketplace & Open VSX
description: Step-by-step guide for releasing Weaviate Studio — version bumping, PAT token setup, publishing to VS Code Marketplace and Open VSX Registry, and post-release checklist.
---

# Release Guide

This guide is the **single source of truth** for releasing the Weaviate Studio extension to the VS Code Marketplace and Open VSX Registry.

::: tip Source of truth
The root [`RELEASE_GUIDE.md`](https://github.com/muleyprasad/weaviate-studio/blob/main/RELEASE_GUIDE.md) is a short stub that links here. See [Documentation Structure](/guide/contributing#documentation-structure) for the reasoning.
:::

## Pre-Release Checklist

### Code Quality & Testing

- [ ] All tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm install && npm run compile && npm run build:webview && npm run build:add-collection`
- [ ] Manual testing completed across supported VS Code versions (see the [Testing Guide](/guide/testing))
- [ ] All features working as expected

### Documentation & Metadata

- [ ] `README.md` updated with latest features, new GIFs, and any breaking changes
- [ ] [Companion website](https://muleyprasad.github.io/weaviate-studio/) updated with release highlights
- [ ] `CHANGELOG.md` updated with release notes
- [ ] `package.json` version bumped appropriately
- [ ] `LICENSE` file present and up-to-date
- [ ] All marketplace assets ready (screenshots, logos, etc.)

### Repository State

- [ ] All changes committed and pushed to `main`
- [ ] No uncommitted changes in working directory
- [ ] Git tag created (`v<version>`) for release

## CI/CD Workflows

Weaviate Studio uses **two GitHub Actions workflows**:

| Workflow           | File                                | Trigger                                  | Purpose                                                |
| ------------------ | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| **CI/CD Pipeline** | `.github/workflows/ci.yml`          | Push to `main`/`develop`, PR, or Release | Lint, test, build, and publish the extension           |
| **Deploy Docs**    | `.github/workflows/deploy-docs.yml` | Push to `main` (when `site/**` changes)  | Build and deploy the companion website to GitHub Pages |

### What the CI/CD Pipeline Does (`ci.yml`)

1. Runs lint and tests
2. Builds the extension (extension + webview + add-collection)
3. Packages with `vsce`
4. Publishes to the VS Code Marketplace
5. Publishes to the Open VSX Registry
6. Attaches the `.vsix` as a release artifact

The pipeline is wired to run automatically when a Git tag that starts with `v` is pushed.

### What the Docs Deploy Workflow Does (`deploy-docs.yml`)

1. Triggers on push to `main` when files in `site/` change
2. Installs dependencies (`npm ci`)
3. Builds the VitePress site (`npm run docs:build`)
4. Deploys to GitHub Pages at <https://muleyprasad.github.io/weaviate-studio/>

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

## Quick Release Steps (Automated)

Follow these six steps to publish a new version. The `ci.yml` workflow runs automatically on tag push.

### 1. Pick the Next Version

Use [Semantic Versioning](https://semver.org):

- Patch fix → `1.0.0` → `1.0.1`
- Back-compatible feature → `1.1.0`
- Breaking change → `2.0.0`

### 2. Update Metadata

```bash
npm version patch|minor|major --no-git-tag-version
```

Then:

- Edit `CHANGELOG.md` — add a section for the new version (see [Release Notes Style](#release-notes-style))
- Update the [companion website](https://muleyprasad.github.io/weaviate-studio/) with release highlights in `site/`
- Update `README.md` if needed

```markdown
## [1.0.1] — 2025-07-08

### Added

- Something new.

### Fixed

- Something fixed.

### Breaking

- Describe any breaking change and required user action
```

### 3. Commit and Push to `main`

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): 1.0.1"
git push origin main
```

### 4. Tag and Publish the Release

```bash
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1
```

Then open **GitHub → Releases → "Draft new release"** and:

- Select the just-pushed tag `v1.0.1`
- Paste the same CHANGELOG section in the description
- Click **Publish release** — this fires the `release` event the workflow listens for

### 5. Watch GitHub Actions

The `ci.yml` workflow will:

- Run tests & build (extension + webview)
- Package with `vsce`
- Publish to VS Code Marketplace using the `VSCE_PAT` secret
- Publish to Open VSX using the `OVSX_PAT` secret
- Attach the `.vsix` file as a build artifact

### 6. Verify

- The marketplace listing should show the new version a few minutes after the job succeeds
- The Open VSX listing should also reflect the new version
- Optionally test the artifact locally:
  ```bash
  code --install-extension weaviate-studio-<version>.vsix --force
  ```
- Verify the docs site auto-deployed (check the **Deploy Docs** workflow)

That's it — no manual `vsce publish` needed. **version bump → changelog → commit → tag**.

## Manual Marketplace Publishing (Fallback)

Use these steps if automation fails.

### VS Code Marketplace

**Prerequisites:**

- Microsoft account with Visual Studio Marketplace publisher access
- Personal Access Token (PAT) from Azure DevOps
- `vsce` CLI tool installed globally

**One-Time Setup:**

1. **Create publisher account** — Visit <https://marketplace.visualstudio.com/manage> and create the `prasadmuley` publisher account.

2. **Generate Personal Access Token** — Go to <https://dev.azure.com/> → User Settings → Personal Access Tokens → create a token with **Marketplace (publish)** scope.

3. **Configure `vsce`:**
   ```bash
   npm install -g vsce
   vsce login prasadmuley
   # Enter your PAT when prompted
   ```

**Publish:**

```bash
# 1. Build
npm run compile
npm run build:webview
npm run build:add-collection

# 2. Package
vsce package

# 3. Smoke-test locally
code --install-extension weaviate-studio-<version>.vsix

# 4. Publish
vsce publish
```

### Open VSX Registry (Cursor, Windsurf, VSCodium)

**One-Time Setup:**

1. **Create account** — Sign up with GitHub at <https://open-vsx.org/>
2. **Install CLI:**
   ```bash
   npm install -g ovsx
   ```
3. **Get access token** — <https://open-vsx.org/user-settings/tokens>

**Publish:**

```bash
ovsx publish weaviate-studio-<version>.vsix -p YOUR_ACCESS_TOKEN
```

### Windsurf

Windsurf supports VS Code extensions via Open VSX. Publishing to Open VSX automatically covers it. Users can also manually install the `.vsix` from GitHub Releases.

## Release Notes Style

Releases (v1.3.0+) follow a **"Product Update"** format rather than a simple changelog. Use this structure for GitHub Release descriptions.

### Structure & Tone

- **Catchy title:** Descriptive name (e.g., `v1.5.0 — GENERATIVE SEARCH & RBAC 🔭🛡️`)
- **Enthusiastic summary:** Brief, inviting summary of the release's value
- **Highlights section:** 3-4 major impact changes with "Why this matters" context
- **Visual categorization** using consistent emojis:
  - 🔭 **DATA EXPLORER / GENERATIVE SEARCH**
  - 🛡️ **RBAC & SECURITY**
  - ⚡ **PERFORMANCE IMPROVEMENTS**
  - 🎨 **UX ENHANCEMENTS**
  - 🐛 **BUG FIXES**
- **PR & Issue links** (e.g., `(PR #63)`)
- **Installation matrix** with links to Marketplace, Open VSX, and direct VSIX downloads

### Formatting Guidelines

- Use horizontal separators (`---` or `----------------------------------------`) between major sections
- Use ALL CAPS for section headers
- Bold key features and technical terms
- Acknowledge contributors and include test coverage statistics

### Example

```
v1.7.0 — MULTI-VECTOR SEARCH & BACKUP IMPROVEMENTS 🔍💾

We're thrilled to announce v1.7.0, which brings full support for
Weaviate's named-vector / Muvera search and improved backup UX.

🌟 HIGHLIGHTS
- Multi-Target Vector Search: Query across multiple vector spaces...
- Backup Wildcard Support: Select all collections at once using *...
```

### Release Notes Template

```markdown
# [X.Y.Z] - YYYY-MM-DD — RELEASE TITLE 🚀

We're thrilled to announce the release of **vX.Y.Z**, which brings [brief summary of major theme].

---

### 🌟 HIGHLIGHTS

- **Feature A:** Description...
  - _Why this matters:_ Context...
- **Feature B:** Description...
  - _Why this matters:_ Context...

---

### 🔭 [MAJOR FEATURE CATEGORY]

- **Detailed improvement 1:** Technical details... (PR #00)
- **Detailed improvement 2:** Technical details...

### 🛡️ [SECURITY / RBAC]

- **Enhancement 1:** ...
- **Enhancement 2:** ...

### ⚡ PERFORMANCE & UX

- **Optimization:** ...
- **UI Tweak:** ...

### 🐛 BUG FIXES

- **Fix 1:** ...
- **Fix 2:** ...

---

### 📦 INSTALLATION

| **VS Code**         | **Cursor / Windsurf** | **Manual**            |
| :------------------ | :-------------------- | :-------------------- |
| [Marketplace](LINK) | [Open VSX](LINK)      | [Download VSIX](LINK) |

---
```

## Post-Release Monitoring

### Key Metrics

- Download counts on each marketplace
- User ratings and reviews
- Issue reports and bug feedback
- Feature requests from users
- Docs site traffic (via GitHub Pages insights)

### Maintenance Tasks

- Regular updates based on VS Code API changes
- Bug fixes from user reports
- Feature enhancements based on feedback
- Security updates for dependencies
- Docs site updates — push changes to `site/` and they deploy automatically

## Troubleshooting

### Publishing Fails

```bash
# Check token permissions
vsce verify-pat

# Verify package.json format
vsce package --no-yarn
```

### Extension Won't Load

- Check VS Code compatibility
- Verify all dependencies are bundled
- Test in clean VS Code environment

### Marketplace Rejection

- Review marketplace guidelines
- Check for policy violations
- Ensure all required metadata is present

### Support Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Registry](https://open-vsx.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Questions or issues?** Open a [GitHub issue](https://github.com/muleyprasad/weaviate-studio/issues) or check the troubleshooting section above.
