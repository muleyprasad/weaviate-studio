# AGENTS.md

Guidance for coding agents working in this repository.

## What this repository is

Weaviate Studio is a VS Code extension written in TypeScript. The extension host code
lives in `src/`, and each panel UI is a React webview under `src/*/webview/`, bundled by
webpack into `dist/webview/` as `<name>.bundle.js` + `<name>.css` + `<name>.html`.

## Commands

```bash
npx tsc -p . --noEmit --skipLibCheck        # typecheck (see caveat below)
npx jest src/data-explorer/webview          # focused webview tests
npm test                                    # full Jest suite
npm run lint                                # ESLint over src, then the webview colour check
npm run lint:theme                          # only the webview colour check (see below)
npm run format:check                        # Prettier check
npm run build:webview                       # build the webview bundles into dist/webview
npm run preview:webview                     # see "Visual testing" below
```

Typecheck caveat: plain `npx tsc -p . --noEmit` reports a pre-existing
`node_modules/weaviate-client/.../gql.d.ts(1,27): error TS1479`, which is unrelated to
webview changes. Use `--skipLibCheck` to isolate real errors.

`npm run build:webview` **empties `dist/webview/`** before writing, so anything placed
there by hand disappears on the next build.

## Visual testing webviews with dummy data

Webviews only render inside VS Code, and the real extension needs a connection to a live
Weaviate instance. For layout, spacing, icon, and theming work, render the built bundle in
a mock VS Code host instead: sample data, no connection, no extension host, no packaging.

```bash
npm run preview:webview                     # build + serve on http://127.0.0.1:4180/__preview.html
npm run preview:webview -- --no-build       # reuse the current dist/webview
npm run preview:webview -- --port 5000      # different port
```

Open the printed URL in a browser: light theme by default, `?dark=1` for the Dark Modern
palette. The script writes `dist/webview/__preview.html` (gitignored, regenerated on every
run) and serves `dist/webview/` with a dependency-free static server.

### Change the sample data

Edit the `SAMPLE DATA` block in `scripts/webview-preview/harness.html`: the
`collectionName`, `schema` (properties, `vectorizerConfig`, `multiTenancy`), and `objects`
(properties, `vector`, `metadata`). That is the only file to touch to reach a state —
sparse collections, many properties, missing vectors, long text, multi-tenancy.

`mock` note: the mock host lives in the same file. Its `reply()` function answers the
messages the webview posts, using the shapes the real extension sends:

| Webview sends               | Mock replies                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `initialize`, `fetchSchema` | `init` (collection, schema, serverVersion, readOnly…) + `objectsLoaded`                                         |
| `fetchObjects`, `refresh`   | `objectsLoaded` (with `distance`/`certainty`/`score` when the request id starts with `vs-`, i.e. vector search) |
| `getObjectDetail`           | `objectDetailLoaded`                                                                                            |
| `getTenants`                | `tenantsLoaded`                                                                                                 |

Anything else (copy, export, delete, update) is ignored — a layout review does not need it.
The webview also reads `window.initialData` (`collectionName`, `optional targetUuid`) and
calls `acquireVsCodeApi()`; both are provided by the harness.

Timestamps in sample data are **milliseconds** (`Date.now() - 6 * 60 * 1000`). Microseconds
render as "In the future".

### Review checklist for theme work

- Look at **both** themes (`?dark=1`) before calling UI work done.
- Colours must come from `--vscode-*` variables. A bare `rgba(255, 255, 255, …)` or hex
  background usually looks fine in dark and disappears in light (or the reverse). The
  fallback inside `var(--vscode-x, fallback)` is only a last resort for hosts that do not
  set the variable.
- `npm run lint` ends with `lint:theme`, which enforces this: it scans every `src/**/*.css` for colour literals
  outside a `var(--vscode-…)` group and fails on new ones. Reviewed exceptions (shadows,
  scrims, tints over a coloured surface, brand fills with matching foreground) live in
  `scripts/webview-theme-baseline.json`; add one with `npm run lint:theme -- --update`
  only after looking at the rule in both themes. Entries that stop matching are reported
  as stale so the file does not rot.
- The harness palettes must include every `--vscode-*` variable the bundle references;
  `grep -o 'var(--vscode-[a-z-]*' dist/webview/data-explorer.css | sort -u` lists them.
  The palette blocks sit **after** the bundle stylesheets on purpose.
- Icons are `@vscode/codicons` spans (`<span className="codicon codicon-close">`), not
  emoji or text glyphs like `✕`, `📌`, `🔍` — emoji ignore theme colours and render at
  inconsistent sizes.
- Interactive states: hover, disabled, primary vs secondary, and the z-index of dialogs
  opened from a side panel.

### Screenshots

When a screenshot is requested, capture at a fixed viewport (for example 1440×900) with
the sample data above, and state which views were captured. `screenshots/` is local review
output unless the user asks to commit it.

### What the mock host does not cover

It is a browser page, not a VS Code webview. CSP/nonce wiring, the extension host
messaging layer, command execution, and real Weaviate behaviour are **not** exercised.
After visual checks, still run the typecheck, the relevant Jest tests, and
`npm run build:webview`; for anything touching extension ↔ webview messaging, verify in a
real VS Code window with a sandbox Weaviate instance.
