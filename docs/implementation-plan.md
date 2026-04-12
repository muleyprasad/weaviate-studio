# Query Agent Integration — Iterative Implementation Plan

Below is a chronological sequence of atomic stories. Each leaves the extension in a stable, shippable state, so you can pause, review, test, or ship at any story boundary. Stories are ordered so that later work can always consume earlier work.

---

## Story 0 — Add dependency and verify SDK types

**Goal:** Install `weaviate-agents`, confirm the real exported types, and record the verified field names that the rest of the work will depend on. The spec repeatedly says "verify from SDK types" — doing this once up front removes uncertainty from every later story.

**Files:**

- `package.json`
- `package-lock.json`
- New: `src/rag-chat/extension/queryAgent/types.ts` _(thin local type alias file, see below)_

**Changes (high level):**

- `npm install weaviate-agents`.
- Open `node_modules/weaviate-agents/dist/index.d.ts`, identify:
  - `QueryAgent` constructor signature
  - `.ask()`, `.search()`, `.stream()` return types
  - Chat-history message type (exact export name)
  - Response fields for: answer text, sources (collection + uuid), sub-queries, collections used, reranking flag, token count, streaming chunk shape
- In `queryAgent/types.ts`, re-export / alias the SDK types under local names (`QueryAgentAskResponse`, `QueryAgentSearchResponse`, `QueryAgentStreamChunk`, `QueryAgentChatMessage`, `QueryAgentTrace`) so the rest of the codebase depends on a single place. Add a comment documenting the exact SDK field paths confirmed today.
- **No runtime code yet.** Build must still pass (`npm run compile`).

**Test state:** Existing RAG chat unchanged. Compiles. Nothing wired up.

---

## Story 1 — Extend `WeaviateConnection` type with Agent-only fields

**Goal:** Add the two optional Agent fields to the shared connection type without reading, writing, or migrating them yet.

**Files:**

- `src/types/index.ts` (or wherever `WeaviateConnection` is defined)

**Changes:**

- Add two optional fields to `WeaviateConnection`:
  - `inferenceProviderApiKey?: string` (cloud only — commented)
  - `agentSystemPrompt?: string`
- Export a new constant `DEFAULT_AGENT_SYSTEM_PROMPT`.

**Test state:** Purely additive type change. No runtime behavior change. `tsc` and existing tests must still pass.

---

## Story 2 — Persist Agent settings in `ConnectionManager`

**Goal:** Storage-layer support for the new fields. UI still doesn't expose them.

**Files:**

- `src/services/ConnectionManager.ts`

**Changes:**

- When reading a connection from `globalState`, populate `agentSystemPrompt` as-is (workspace/global state, not secret).
- When writing a connection, persist `agentSystemPrompt` in plain state.
- Treat `inferenceProviderApiKey` like the existing API key: store in `context.secrets` under a new key pattern `weaviate-connection-{id}-inferenceProviderApiKey`. Add `getInferenceProviderApiKey(id)` and `setInferenceProviderApiKey(id, value)` helpers parallel to existing apiKey helpers.
- No migration bump needed (fields are optional — existing connections remain valid).
- Add unit tests mirroring existing ConnectionManager tests for the new getters/setters.

**Test state:** Persistence layer ready. Still invisible to the user.

---

## Story 3 — Add "Agent Settings (Weaviate Cloud)" section to connection form

**Goal:** UI to edit the two new fields, cloud-only, collapsible. Fully independent of any backend Query Agent code.

**Files:**

- `src/webview/ConnectionForm.tsx`
- `src/webview/connection-form.css` (or equivalent) if needed
- Corresponding panel handler (wherever ConnectionForm posts save messages back to the extension) — likely `src/extension.ts` add/edit connection command handler, or a dedicated panel file.

**Changes:**

- In `ConnectionForm.tsx`: add a `<details>` collapsible section titled **"Agent Settings (Weaviate Cloud)"** that only renders when `connectionType === 'cloud'`.
  - Field 1: password-style input for `inferenceProviderApiKey` with a help line.
  - Field 2: textarea for `agentSystemPrompt` with `DEFAULT_AGENT_SYSTEM_PROMPT` as placeholder.
- Extend the form's save payload type to carry these two fields.
- In the extension-side save handler, route `inferenceProviderApiKey` through `ConnectionManager.setInferenceProviderApiKey()` and `agentSystemPrompt` through the normal connection update path.
- On edit, pre-populate from the loaded connection.

**Test state:** User can now save/edit these values. Nothing consumes them yet.

---

## Story 4 — Skeleton `QueryAgentService` wrapper (no UI wiring)

**Goal:** Isolated, unit-testable service that knows how to instantiate `QueryAgent`, call `.ask()`, `.search()`, and `.stream()`, and map responses to internal types. Not yet called from anywhere.

**Files:**

- New: `src/rag-chat/extension/queryAgent/QueryAgentService.ts`
- New: `src/rag-chat/extension/queryAgent/traceMapping.ts`
- New: `src/rag-chat/extension/queryAgent/__tests__/QueryAgentService.test.ts`

**Changes:**

- `QueryAgentService` constructor takes a `WeaviateClient`, collections array, and `systemPrompt`. Internally instantiates `QueryAgent` from `weaviate-agents`.
- Methods: `ask(message, chatHistory)`, `search(message)`, `stream(message)`.
- `traceMapping.ts` exports `mapAskResponseToTrace(raw)` and `mapChatHistory(internalMessages)` — strips to `{ role, content }` only.
- Unit tests mock the SDK module and assert: (a) `.ask()` is called with chatHistory, (b) `.search()` is called without it, (c) trace mapping produces the shape expected by the webview.

**Test state:** Service compiles and is unit tested in isolation. No behavioral change to the app.

---

## Story 5 — Backend routing: Agent Mode OFF branch is untouched; wire the ON branch

**Goal:** Add the routing seam inside `RagChatPanel._handleExecuteRagQuery` without removing the existing generative-search path. When `agentModeEnabled=false` (the default), behavior is byte-identical to today.

**Files:**

- `src/rag-chat/extension/RagChatPanel.ts`
- `src/rag-chat/types/index.ts` (extend message type with `agentModeEnabled`, `scopeMode`)

**Changes:**

- Extend `RagChatWebviewMessage` with `agentModeEnabled?: boolean` and `scopeMode?: 'single' | 'all'`.
- In `_handleExecuteRagQuery`: early-branch — if `agentModeEnabled && connection.connectionType === 'cloud'`, call a new private method `_handleAgentQuery(message)`; otherwise the existing flow runs unchanged.
- `_handleAgentQuery` (stub in this story): reads `agentSystemPrompt` and `inferenceProviderApiKey`, constructs a `QueryAgentService`, calls `.ask(cleanMessage)` with no command parsing yet, posts back a new `agentResponse` extension message containing `answer` and raw `trace`. Non-streaming only. No slash commands. No "all collections" support.
- Add a new `agentResponse` extension message command (pass trace as `rawResponse: unknown`).
- Add try/catch that on agent instantiation/call failure falls back to the existing generative-search path (graceful degradation rule for cloud-but-agent-broken).

**Test state:** Feature is reachable only if a webview manually posts `agentModeEnabled: true`. Default chat behavior unchanged.

---

## Story 6 — Webview: Agent Mode toggle (cloud-only, persisted)

**Goal:** User-facing control that flips `agentModeEnabled` and persists it per-connection. This is the first UI surfacing.

**Files:**

- `src/rag-chat/webview/RagChat.tsx`
- `src/rag-chat/webview/RagChat.css`
- `src/rag-chat/extension/RagChatPanel.ts` (handle two new webview→ext messages: `getAgentModeState`, `setAgentModeState`)
- `src/rag-chat/types/index.ts` (add those two commands)

**Changes:**

- Add state fields to the React component: `agentModeEnabled`, `showAgentKeyWarning`.
- Render a pill toggle in the header — only when `connection.connectionType === 'cloud'`. Inject `connectionType` via the existing `window.initialData` bootstrap (extend `_getHtmlForWebview` in RagChatPanel).
- On toggle, post `setAgentModeState { enabled }`; on mount, post `getAgentModeState`.
- Backend: persist to `context.workspaceState` under key `ragChat.agentMode.${connectionId}`. Default `false`.
- On send, include `agentModeEnabled` in the executeRagQuery message (Story 5 already consumes it).
- If toggle is ON and `inferenceProviderApiKey` is missing, push a one-time system-message bubble to chat warning the user. Track with `showAgentKeyWarning` locally; reset on connection change.

**Test state:** Cloud users can toggle Agent Mode and ask simple questions via `.ask()` with no trace UI yet. Local users see no toggle.

---

## Story 7 — Webview: Query Trace disclosure on agent replies

**Goal:** Render `▸ How this was answered` expandable section beneath every agent-generated assistant bubble.

**Files:**

- `src/rag-chat/webview/RagChat.tsx`
- `src/rag-chat/webview/RagChat.css`
- `src/rag-chat/webview/components/QueryTrace.tsx` _(new small component)_
- `src/rag-chat/extension/queryAgent/traceMapping.ts` (extend if needed)

**Changes:**

- Extend `InternalChatMessage` (webview-side) with optional `trace?: { rawResponse: unknown; traceExpanded: boolean }`.
- When `agentResponse` arrives, store `rawResponse` unchanged on the message.
- `QueryTrace` component reads the raw response via `traceMapping.ts` helpers and renders: sub-queries run, collections used, reranking flag, token count, sources list.
- Sources render as clickable links that post `openInDataExplorer` (reuse the existing command — already handled in `RagChatPanel._handleMessage`).
- Handle "trace unavailable" fallback text.
- Collapsed by default. Accordion state lives in message.

**Test state:** Every `.ask()` response shows a working, inline trace. `.search()` not supported yet.

---

## Story 8 — Slash-command autocomplete (UI only, no routing yet)

**Goal:** Discoverable `/` menu in the chat input. Commands are inserted as text; the backend still treats everything as `.ask()`. This keeps routing and UI independently testable.

**Files:**

- `src/rag-chat/webview/RagChat.tsx`
- `src/rag-chat/webview/components/SlashMenu.tsx` _(new)_
- `src/rag-chat/webview/RagChat.css`

**Changes:**

- Trigger only when `/` is the first character.
- Keyboard: ↑/↓ navigate, Enter/Tab select, Esc close. Click selects.
- Insert templates exactly as spec'd (including cursor position for `/fetch id:""`).
- Add state: `slashMenuOpen`, `slashMenuSelectedIndex`.
- Fire `ragChat.slashCommandUsed` telemetry on selection (wire in Story 12 — stub a no-op here).

**Test state:** UX is complete; backend still routes everything to `.ask()`.

---

## Story 9 — Backend routing: parse slash commands and call `.search()` vs `.ask()`

**Goal:** Make `/search` route to `QueryAgentService.search()`; all other commands + plain text route to `.ask()`. Strip prefix before sending to SDK.

**Files:**

- `src/rag-chat/extension/RagChatPanel.ts`
- `src/rag-chat/extension/queryAgent/commandRouting.ts` _(new, pure function — easy to unit test)_
- `src/rag-chat/extension/queryAgent/__tests__/commandRouting.test.ts`

**Changes:**

- `commandRouting.ts` exports `parseCommand(input): { method: 'ask' | 'search'; cleanMessage: string; command: string | null }`.
- Special-case `/collections` → `{ method: 'ask', cleanMessage: 'List the available collections' }`.
- In `_handleAgentQuery`, call `parseCommand()` first, then dispatch to `service.search()` or `service.ask()` accordingly.
- For `.search()`, post a new `agentSearchResponse` extension message with the raw objects — do **not** go through the trace-disclosure path.
- Unit test `parseCommand` with every command in the table plus plain text.

**Test state:** Users can run `/search ...` for pure retrieval. Other commands still use `.ask()`.

---

## Story 10 — Webview: `.search()` response renders as result cards

**Goal:** Present `/search` results using the existing source-card component instead of a chat bubble with trace.

**Files:**

- `src/rag-chat/webview/RagChat.tsx`
- (Reuse existing context-object card component — no new component expected)

**Changes:**

- Handle `agentSearchResponse` message by pushing a special assistant-side entry whose body is only result cards (no answer text, no trace disclosure).
- Empty-state: `"No matching objects found."`.

**Test state:** `/search` path end-to-end works: cheap (1 WCD request) retrieval, cards shown.

---

## Story 11 — Scope dropdown: "All Collections" + Agent Mode auto-enable

**Goal:** Extend the existing collection picker with an "All Collections" entry that triggers Agent Mode.

**Files:**

- `src/rag-chat/webview/RagChat.tsx`
- `src/rag-chat/extension/RagChatPanel.ts` (expose `getAllCollectionNames` helper — likely already exists as `_handleGetCollections`)

**Changes:**

- Prepend "All Collections" to the existing dropdown.
- On selection: set `scopeMode='all'`, force `agentModeEnabled=true`, show the muted inline note.
- If connection is local: show the fallback note and revert to first collection.
- In `executeRagQuery` payload, include `scopeMode` (Story 5 already accepts it).
- In `_handleAgentQuery`, when `scopeMode==='all'`, fetch all collection names (reuse the cached `_collectionInfosCache`) and pass them to `QueryAgentService`.
- Graceful fallback if listing fails: log to output channel, fall back to single selected collection.

**Test state:** Multi-collection agent queries work via one dropdown click.

---

## Story 12 — Streaming render for `.ask()` with silent fallback ✅ COMPLETE

**Goal:** Token-by-token rendering when the SDK supports streaming; invisibly fall back otherwise.

**Files Modified:**

- `src/rag-chat/extension/RagChatPanel.ts` — Added `_handleAgentAskWithStreaming()` method
- `src/rag-chat/webview/RagChat.tsx` — Added handlers for `streamChunk` and `streamEnd` messages
- `src/rag-chat/types/index.ts` — Added `streamChunk`, `streamEnd` to command types and fields
- `src/rag-chat/webview/RagChat.css` — Added blinking cursor animation

**Changes:**

✅ `QueryAgentService.stream()` used in new `_handleAgentAskWithStreaming()` method with `try { for await }` block
✅ For each chunk → post `streamChunk { delta }`. On final → post `streamEnd { trace }` after fallback ask() call
✅ Stream failure before any chunk → silently fall back to `service.ask()` and post regular `agentResponse`
✅ Stream failure mid-stream → finalize with `streamEnd` and error flag
✅ Webview handlers: `streamChunk` appends delta to message, `streamEnd` attaches trace and sets `loading=false`
✅ Blinking cursor `|` rendered during streaming (CSS animation + JSX conditional)
✅ Non-agent generative search path unchanged

**Test state:** ✅ All tests pass (1573 tests). Feature streaming end-to-end working.

---

## Story 13 — Agent error bubble with `▸ Error details` disclosure ✅ COMPLETE

**Goal:** User-visible, non-blocking error UX for agent failures (quota, permissions, unexpected shapes).

**Files Modified:**

- `src/rag-chat/webview/RagChat.tsx` — Added agentErrorBubble handler and error details disclosure rendering
- `src/rag-chat/webview/RagChat.css` — Added error bubble and disclosure styling
- `src/rag-chat/extension/RagChatPanel.ts` — Updated error handling to post agentErrorBubble messages
- `src/rag-chat/types/index.ts` — Added agentErrorBubble command type, errorDetails fields, and type for history entry

**Changes:**

✅ Extended agent error message shape with `errorType` + `rawDetails` fields
✅ Render styled error bubble with user-facing message: "Agent couldn't answer this. Try rephrasing or disable Agent Mode."
✅ Added `▸ Error details` disclosure showing raw error message (expandable/collapsible)
✅ Updated `_handleAgentQuery` to post `agentErrorBubble` command instead of `ragError` for agent-specific errors
✅ Error bubble has distinct styling (red border, error-colored background, monospace error details)
✅ Disclosure triangle rotates when expanded

**Test state:** ✅ All tests pass (1573 tests). Error handling covers graceful degradation.

---

## Story 14 — Telemetry events

**Goal:** Add the five new events to the existing telemetry pipeline without leaking query/collection/key text.

**Files:**

- `src/telemetry/TelemetryTypes.ts`
- `src/telemetry/__tests__/…` (extend existing tests)
- `src/rag-chat/extension/RagChatPanel.ts` (fire events at the right points)
- `src/rag-chat/webview/RagChat.tsx` (post a message for `slashCommandUsed`; extension forwards to telemetry)
- `telemetry.json` (document events in existing format)

**Changes:**

- Add event name constants: `RAG_CHAT_AGENT_MODE_TOGGLED`, `RAG_CHAT_AGENT_QUERY_SENT`, `RAG_CHAT_AGENT_QUERY_SUCCESS`, `RAG_CHAT_AGENT_QUERY_ERROR`, `RAG_CHAT_SLASH_COMMAND_USED`.
- Fire from: toggle handler; `_handleAgentQuery` entry (sent); on success; on error; slash command selection (via a new `slashCommandSelected` webview→ext message).
- Payloads are strictly the small shapes specified in the spec — no query text, no collection names, no API keys.
- Sanitizer tests to prove no PII leaks.

**Test state:** Observability in place for the whole feature.

---

## Story 15 — Acceptance test pass and cleanup

**Goal:** Walk every box in the spec's Acceptance Criteria, write missing targeted tests, and fix any gaps.

**Files:**

- `src/rag-chat/__tests__/` (new integration tests for agent routing)
- Any files with small polishing fixes

**Changes:**

- Integration test: agent OFF = unchanged behavior (snapshot existing test output).
- Integration test: agent ON + `/search` = `.search()` called, correct webview message.
- Integration test: `/collections` → `ask("List the available collections")`.
- Integration test: command prefix stripped before SDK call.
- Integration test: chat history mapping strips internal fields.
- Manual QA against all acceptance criteria; log issues as sub-tasks.
- Ensure `npm run lint`, `npm test`, `npm run package` all green.

**Test state:** Feature ships.

---

## Dependency graph (informal)

```
0 ─▶ 1 ─▶ 2 ─▶ 3
     │
     └─▶ 4 ─▶ 5 ─▶ 6 ─▶ 7
                  │       │
                  │       └─▶ 12 (streaming) ─▶ 13 (errors) ─▶ 14 (telemetry) ─▶ 15 (QA)
                  │
                  └─▶ 8 (slash UI) ─▶ 9 (slash routing) ─▶ 10 (search cards) ─▶ 11 (all-collections)
```

Stories 3 and 4 can run in parallel; 8–10 and 11 can be swapped; everything else is strictly sequential because later stories depend on earlier message shapes, service methods, or UI components.

---

## Notes on shippability

- **After Story 5**: safe to merge — feature is latent, default-off, no user-visible change.
- **After Story 7**: first user-visible version — cloud users can flip a toggle and get agent `.ask()` with trace. Could be released behind an experimental flag.
- **After Story 12**: feature-complete happy path. Strong candidate for v1.7.0 release.
- **After Story 15**: spec-complete.

---

## Next Steps

Choose a story to begin with and let me know. I'll write the actual implementation code, tests, and integrate it into the codebase following the project's style and conventions.
