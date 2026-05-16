# 🚀 Release Guide for Weaviate Studio Extension

> **📖 The full release guide lives on the companion website:** > **[https://muleyprasad.github.io/weaviate-studio/guide/release](https://muleyprasad.github.io/weaviate-studio/guide/release)**

That page is the **single source of truth** and covers:

- Pre-release checklist (code quality, docs, repo state)
- CI/CD workflows (`ci.yml` + `deploy-docs.yml`)
- Required GitHub secrets and marketplace platforms
- **Quick release steps** — the six-step automated flow (`version bump → changelog → commit → tag`)
- Manual marketplace publishing (VS Code Marketplace, Open VSX, Windsurf) as a fallback
- Release notes style and template ("Product Update" format)
- Post-release monitoring and maintenance tasks
- Troubleshooting (publishing fails, extension won't load, marketplace rejection)

## Why is this file a stub?

To eliminate documentation drift. The full release process is maintained on the companion website (built from `site/guide/release.md`) so there is **one place** to update. See the [Documentation Structure](https://muleyprasad.github.io/weaviate-studio/guide/contributing#documentation-structure) section on the companion site for the reasoning.

---

**TL;DR — quick release flow:**

```bash
npm version <patch|minor|major> --no-git-tag-version
# update CHANGELOG.md, README.md, and the companion site as needed
git add package.json CHANGELOG.md
git commit -m "chore(release): X.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin vX.Y.Z
# Then create a GitHub Release — CI publishes to both marketplaces.
```

See the [full guide](https://muleyprasad.github.io/weaviate-studio/guide/release) for details.
