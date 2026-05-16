# 🧪 Testing Guide for Weaviate Studio Extension

> **📖 The full testing guide lives on the companion website:** > **[https://muleyprasad.github.io/weaviate-studio/guide/testing](https://muleyprasad.github.io/weaviate-studio/guide/testing)**

That page is the **single source of truth** and covers:

- Pre-testing setup (packaging the VSIX, preparing the environment)
- Compatibility requirements
- **Full end-to-end testing checklist:** installation, UI/UX, connection management, tree view, query editor, schema management, data explorer, multi-vector search (Muvera), generative search, RBAC, advanced features, performance, error handling, cross-platform, webview security (CSP/nonce), Weaviate compatibility
- Common issues and troubleshooting
- Test results template
- Pre-publishing checklist

## Why is this file a stub?

To eliminate documentation drift. The full testing checklist is maintained on the companion website (built from `site/guide/testing.md`) so there is **one place** to update. See the [Documentation Structure](https://muleyprasad.github.io/weaviate-studio/guide/contributing#documentation-structure) section on the companion site for the reasoning.

---

**Quick verify before publishing:**

```bash
npm ci
npm test
npm run lint
npm run compile && npm run build:webview && npm run build:add-collection
vsce package
code --install-extension weaviate-studio-<version>.vsix --force
```

See the [full guide](https://muleyprasad.github.io/weaviate-studio/guide/testing) for the complete manual-test checklist.
