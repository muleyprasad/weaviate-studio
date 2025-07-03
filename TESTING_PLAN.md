# Weaviate Studio ‑ Testing Roadmap

> This document breaks down the testing effort into **bite-sized, sequential steps** so we can tackle them methodically.  Tick the check-boxes as each task is completed.

---

## 0. Initial Setup  
*(Before writing the first test)* ✅ **Done**

- [x] **Install dev dependencies**  
- [ ] **Install dev dependencies**  
  `npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom @vscode/test-electron @testing-library/react @testing-library/jest-dom`
- [x] **Add Jest config** (`jest.config.js`) with TypeScript + jsdom preset
- [x] **Create test bootstrap** (`src/test/setup.ts`) – register `@testing-library/jest-dom` & mock VS Code API / Monaco / Weaviate client
- [x] **Update `package.json` scripts**  
  - `test` → `jest`  
  - `test:watch` → `jest --watch`  
  - `test:coverage` → `jest --coverage`

---

## 1. Unit Tests (Phase 1 – Core Logic)

| Module | Critical paths to test | File | Status |
| ------ | ---------------------- | ---- | ------ |
| **ConnectionManager** | URL validation, duplicate checks, connect / disconnect, persistence, error handling | `src/services/ConnectionManager.ts` | [ ] |
| **GraphQL Templates** | Template substitution, dynamic schema-aware generation, formatting | `src/query-editor/webview/graphqlTemplates.ts` | [ ] |
| **WeaviateTreeDataProvider** | Tree structure, children resolution, context keys, status icons | `src/WeaviateTreeDataProvider.ts` | [ ] |
| **Utility Functions** | `formatGraphQLQuery`, helper methods | `src/webview/formatGraphQL.ts` | [ ] |

Checklist:
- [x] Write mocks for `weaviate-ts-client`
- [ ] Achieve ≥ 80 % line coverage for each core module

### Upcoming Unit-Test Add-ons

*WeaviateTreeDataProvider*
  - [ ] getStatusIcon returns correct green / gray theme icon
  - [ ] Root children include `serverInfo`, `clusterHealth`, `modules`, `collectionsGroup`
  - [ ] Collection group label reflects collection count
  - [ ] Item `contextValue`s match package-menu expectations (`weaviateConnectionActive`, `weaviateCollection`, …)

*Utility `formatGraphQLQuery`*
  - [ ] Properly formats/minifies prettified GraphQL strings

### Upcoming Integration Tests

*extension activation & commands*
  - [ ] All command IDs from `package.json` are registered
  - [ ] execute `weaviate.connect` delegates to ConnectionManager.connect
  - [ ] Tree-view context keys drive menu visibility (spot-check one item)

---

## 2. Integration Tests (Phase 2 – Extension Glue)

Focus on VS Code API interactions without launching the full editor UI.

- [ ] **Extension activation** – ensure commands register & TreeView loads ( `src/extension.ts` )
- [ ] **Command routing** – simulate `weaviate.queryCollection` etc., assert correct panels invoked
- [ ] **Webview messaging** – mock `vscode.Webview` & verify message passing contract

Tools: `@vscode/test-electron` + Jest environment set to `node`

---

## 3. End-to-End Tests (Phase 3 – Real Editor)

Run the compiled extension inside a headless VS Code instance.

- [ ] **Connection flow**: add → connect → fetch schema → disconnect
- [ ] **Query editor flow**: open editor → insert template → run query (mock Weaviate) → render results

Directory: `tests/e2e/`

---

## 4. Continuous Integration

- [ ] Add GitHub Action: `npm ci && npm run lint && npm test -- --ci`
- [ ] Upload code-coverage artifact
- [ ] Fail build if coverage < 80 %

---

## 5. Nice-to-Have (Stretch)

- [ ] Visual regression for React components with Storybook + Chromatic
- [ ] Mutation testing (e.g. with Stryker) on core logic

---

### Progress Tracking
Update this table each sprint:

| Sprint | Goal | Owner | Result |
| ------ | ---- | ----- | ------ |
| _e.g._ 1 | Complete Jest setup & 20 % coverage | Alice |  ✅ |

---

**Let's start with section 0 – once setup is complete we can move on to the unit tests.** 