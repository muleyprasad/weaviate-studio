# Feature Spec: Query Agent Integration

**weaviate-studio VS Code Extension — v1.7.0**

_Self-contained implementation spec. Feed directly to an AI coding agent._
_Version 2.1 — API corrections applied after fact-check against weaviate-agents TS SDK_

---

## Project Context

**Repo:** `https://github.com/muleyprasad/weaviate-studio`
**Language:** TypeScript (83%), React webviews, CSS
**Build:** Webpack (`webpack.config.js`, `webpack.webview.config.js`)
**Extension entry:** `src/` — VS Code extension core
**Relevant module:** `src/rag-chat/` — self-contained module with its own panel, API wrapper, and React webview. This is the ONLY module you will modify.
**State storage:** VS Code `context.workspaceState` and `context.secrets` — never use `localStorage` or `sessionStorage` (blocked in webview sandboxes)
**Webview messaging:** Standard VS Code webview message-passing pattern (`panel.webview.postMessage` / `window.vscodeApi.postMessage`)
**Weaviate client:** `weaviate-client` npm package (already installed, v4 API)
**Connection object shape:** Each connection has `{ host, port, apiKey, scheme, connectionType }` where `connectionType` is either `"cloud"` or `"local"`.

---

## What Currently Exists in `src/rag-chat/`

The existing Generative Search (RAG Chat Panel) works as follows:

1. User selects a single collection from a dropdown
2. User types a natural language query
3. Extension calls `collection.generate.nearText(query, { groupedTask: prompt })` on the single collection using the `weaviate-client` v4 API
4. The LLM-generated response is displayed in the chat thread as a message bubble
5. Source objects (nearest results used as context) are shown below the response as expandable cards
6. There is no streaming — it waits for the full response before rendering
7. Conversation history is stored in React component state (in-memory, not persisted)

**Do not break any of this existing behavior.** All changes are additive or are routing-layer swaps that preserve the UI contract.

---

## Goal

Upgrade the existing Generative Search / Chat Panel to optionally route through the **official Weaviate Query Agent** (`weaviate-agents` npm package). The Query Agent is a cloud-hosted Weaviate service that:

- Accepts a natural language question and a list of collections
- Autonomously decides which collections to search, what search strategies to use, and how to combine results
- Supports querying across **multiple collections simultaneously**
- Returns a structured response with an LLM-generated answer, cited source objects, and internal reasoning metadata
- Supports **streaming** responses token by token

The user experience stays identical: one chat interface. The agent is an engine swap triggered by two conditions: (a) the user explicitly enables "Agent Mode" via a toggle, or (b) the user selects "All Collections" from the scope dropdown (which requires the agent).

---

## New npm Dependency

```bash
npm install weaviate-agents
```

Import in the extension backend (not webview):

```typescript
import { QueryAgent } from 'weaviate-agents';
```

**Important:** Before writing any implementation code, read the full TypeScript type definitions exported by `weaviate-agents` (`node_modules/weaviate-agents/dist/index.d.ts` or equivalent). All response field names must be derived from those TypeScript definitions — do not hardcode assumed field names. The response shape notes in this spec are directional; the actual field names on the response objects must be confirmed from the SDK types.

---

## Connection Config Changes

Add two optional fields to the connection configuration. These fields exist ONLY when `connectionType === "cloud"`. For `"local"` connections, these fields are absent and Agent Mode is unavailable.

```typescript
interface WeaviateConnection {
  host: string;
  port: number;
  apiKey: string;
  scheme: string;
  connectionType: 'cloud' | 'local';
  // NEW — optional, cloud only:
  inferenceProviderApiKey?: string; // OpenAI / Cohere / etc. key for the vectorizer
  agentSystemPrompt?: string; // persisted per connection, user-editable
}
```

- `inferenceProviderApiKey` is passed as the `"X-INFERENCE-PROVIDER-API-KEY"` header when instantiating the `weaviate-client` connection used by the agent. Store this value in `context.secrets` (VS Code secure storage), not in plain workspace config.
- `agentSystemPrompt` is stored in `context.workspaceState` keyed by connection ID. Default value: `"Answer concisely. Always cite the source objects you used to generate your answer. Format lists in markdown."`

Expose both fields in the existing connection edit UI (add-connection / edit-connection form), under a collapsible **"Agent Settings (Weaviate Cloud)"** section that only renders when `connectionType === "cloud"`.

---

## UI Changes

All UI changes are inside the RAG Chat Panel's React webview. The existing layout is not restructured — changes are additive.

### 1. Chat Panel Header — Two New Controls

**A. Scope Dropdown (extends the existing collection picker)**

Add "All Collections" as the first item in the existing collection dropdown:

```
[ All Collections  ▾ ]
[ Collection A        ]
[ Collection B        ]
```

When "All Collections" is selected:

- Set internal state `scopeMode = "all"`
- Auto-set `agentModeEnabled = true`
- Show a small muted inline note below the dropdown: `"Agent Mode enabled — required for multi-collection queries"`
- If the current connection is `"local"`, show instead: `"Agent Mode requires Weaviate Cloud. Querying active collection only."` and set `agentModeEnabled = false`. Fall back to querying the first collection in the list.

When any specific collection is selected: `scopeMode = "single"`. Agent Mode stays at whatever the toggle is set to independently.

**B. Agent Mode Toggle**

A small pill toggle in the top-right corner of the panel header. Only render this control when `connection.connectionType === "cloud"`. On local connections, the toggle is not shown — no explanation needed, local users never encounter it.

```
[⚡ Agent  ●]   ← enabled
[⚡ Agent  ○]   ← disabled
```

Toggle state stored in `context.workspaceState` keyed as `ragChat.agentMode.{connectionId}`. Persists across panel reopens. Default: `false`.

When Agent Mode is enabled but `inferenceProviderApiKey` is not configured, show a one-time inline warning in the chat thread (not a blocking modal): `"⚠ Agent Mode is on but no Inference Provider Key is configured. Add it in connection settings."` Show this warning only once per session as a system message bubble, not on every send.

---

### 2. Chat Input — Slash-Command Autocomplete

When the user types `/` as the **first character** of their input, show an inline autocomplete popup anchored above the input field:

```
┌──────────────────────────────────────────────┐
│  /ask        Answer a question from data     │
│  /search     Pure retrieval, no LLM answer   │
│  /explore    Discover related content        │
│  /fetch      Retrieve object by ID           │
│  /query      Run structured query            │
│  /collections  List all collections          │
└──────────────────────────────────────────────┘
```

Keyboard behavior: `↑` / `↓` to navigate, `Enter` or `Tab` to select, `Escape` to close. Clicking a row selects it.

Selecting a command inserts its template into the input field:

| Command        | Template inserted                                     |
| -------------- | ----------------------------------------------------- |
| `/ask`         | `/ask ` (cursor at end)                               |
| `/search`      | `/search ` (cursor at end)                            |
| `/explore`     | `/explore ` (cursor at end)                           |
| `/fetch`       | `/fetch id:"" ` (cursor inside quotes)                |
| `/query`       | `/query ` (cursor at end)                             |
| `/collections` | `/collections` (complete — no cursor movement needed) |

Only trigger the popup when `/` is the first character. If the user has already typed other text and adds `/`, treat it as a literal character — do not open the popup.

**Unlike v1 of this spec, slash commands ARE parsed and routed differently in the backend.** See the Backend Routing section below for exact routing rules per command.

---

### 3. Message Bubbles — Streaming Render

When Agent Mode is enabled, switch from the current "wait then render" model to a streaming render for `.ask()` calls (if streaming is supported — see backend section).

Show a blinking cursor (`|`) after the last rendered token while streaming is in progress. Remove the cursor when streaming completes or errors. If streaming is unavailable, fall back to the non-streaming `.ask()` silently — the user sees a normal response without token-by-token rendering.

Existing non-agent behavior: unchanged.

---

### 4. Message Bubbles — Query Trace Disclosure

After each assistant message bubble generated by the agent (`.ask()` path only — not `.search()`), add a small disclosure toggle below the message:

```
▸ How this was answered
```

Clicking expands an inline section within the same bubble. Collapsed by default.

**Expanded view:**

```
▾ How this was answered

  Sub-queries run:     2
  Collections used:    Reviews, Products
  Reranking applied:   yes
  Tokens used:         1,842

  Sources:
  [¹] Reviews › object_id_abc123
  [²] Products › object_id_def456
```

**Data mapping:** All field names must be read from the `weaviate-agents` TypeScript response type definitions — do not hardcode assumed names. The agent response contains search result metadata and source objects. Map them to the above UI labels once you have confirmed the actual field names from the SDK types. Directional guidance:

| UI label          | Expected source (verify field names from SDK types)           |
| ----------------- | ------------------------------------------------------------- |
| Sub-queries run   | Count of sub-query entries in the response                    |
| Collections used  | Unique collection names across all search results             |
| Reranking applied | Boolean flag on the response                                  |
| Tokens used       | Token count field on the response                             |
| Sources           | Array of source objects — each has a collection name and UUID |

**Source deep-links:** Each `[¹] Reviews › object_id_abc123` line is a clickable link. Clicking fires a `postMessage` to the extension backend:

```typescript
{
  type: 'openObjectInExplorer',
  collection: 'Reviews',
  objectId: 'object_id_abc123'
}
```

The backend handler for `openObjectInExplorer` should call the existing Data Explorer open logic — find how the Data Explorer panel is opened elsewhere in the codebase and reuse that path.

If trace data is unavailable (streaming error, partial response): render `"Trace unavailable for this response."` Never show an empty expanded section.

For `.search()` responses (pure retrieval — no LLM answer generated), do not show the `▸ How this was answered` disclosure. Instead show retrieved objects directly as result cards using the existing source-card component pattern already in the RAG Chat Panel.

---

### 5. No New Panels

Do **not** create a new VS Code panel, webview, or sidebar section. All changes are entirely within the existing `src/rag-chat/` module.

---

## Backend Routing Logic

In the extension backend (the TypeScript file in `src/rag-chat/` that handles `postMessage` events from the webview), modify the message-send handler:

```typescript
// Pseudocode — adapt to match existing handler structure in src/rag-chat/
// Read existing code first. Match naming conventions and patterns exactly.

async function handleSendMessage(message: string, options: ChatOptions) {
  if (options.agentModeEnabled && connection.connectionType === 'cloud') {
    return await sendViaQueryAgent(message, options);
  } else {
    return await sendViaGenerativeSearch(message, options); // EXISTING CODE — do not touch
  }
}

async function sendViaQueryAgent(message: string, options: ChatOptions) {
  const client = getWeaviateClient(connection); // existing client factory — reuse it

  const collections =
    options.scopeMode === 'all'
      ? await getAllCollectionNames(client) // reuse existing collection listing logic
      : [options.selectedCollection];

  const qa = new QueryAgent(client, {
    collections: collections,
    systemPrompt: connection.agentSystemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  });

  // Parse the command prefix to determine which agent method to call.
  // This matters because .search() skips LLM generation — faster and cheaper
  // (1 WCD request vs 4 for .ask()).
  const trimmed = message.trim();
  const isPureSearch = trimmed.startsWith('/search');

  // Strip command prefix before sending to agent.
  // e.g. "/search wireless headphones" → "wireless headphones"
  const cleanMessage = trimmed.replace(/^\/\w+\s*/, '');

  if (isPureSearch) {
    // Pure retrieval path — no LLM answer generated
    const response = await qa.search(cleanMessage);
    // Map response to UI using actual field names from SDK types.
    // Send source objects back to webview as result cards.
    panel.webview.postMessage({
      type: 'searchResponse',
      objects: response /* extract source objects per SDK type definition */,
    });
  } else {
    // Standard ask path — retrieval + LLM answer generation
    // Attempt streaming first; fall back to non-streaming if unavailable.
    // NOTE: Verify the exact streaming API shape against SDK types before implementing.
    // The stream emits progress events and a final complete response.
    try {
      for await (const chunk of qa.stream(cleanMessage)) {
        // chunk shape must be verified from SDK types.
        // Expected: token delta events during generation, final event with complete response.
        panel.webview.postMessage({ type: 'streamChunk', delta: /* chunk token */ '' });
      }
      panel.webview.postMessage({
        type: 'streamEnd',
        trace: /* extract trace from final chunk */ null,
      });
    } catch (streamError) {
      // Streaming failed or unsupported — fall back silently
      const response = await qa.ask(cleanMessage, {
        chatHistory: mapToChatHistory(options.conversationHistory),
      });
      panel.webview.postMessage({
        type: 'agentResponse',
        answer: response /* verify exact answer field from SDK types */,
        trace: response /* extract trace fields from response per SDK types */,
      });
    }
  }
}

// Map the extension's internal message format to the weaviate-agents ChatMessage shape.
// The weaviate-agents SDK expects: { role: 'user' | 'assistant', content: string }
// Strip all internal fields (id, timestamp, trace, etc.) before passing.
function mapToChatHistory(messages: InternalChatMessage[]): WeaviateChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content, // plain text only — no metadata
    }));
}
```

**Routing summary by command:**

| User input starts with  | Method called                              | WCD cost   |
| ----------------------- | ------------------------------------------ | ---------- |
| `/search ...`           | `qa.search(cleanMessage)`                  | 1 request  |
| `/ask ...`              | `qa.ask(cleanMessage)`                     | 4 requests |
| `/explore ...`          | `qa.ask(cleanMessage)`                     | 4 requests |
| `/fetch ...`            | `qa.ask(cleanMessage)`                     | 4 requests |
| `/query ...`            | `qa.ask(cleanMessage)`                     | 4 requests |
| `/collections`          | `qa.ask("List the available collections")` | 4 requests |
| No command (plain text) | `qa.ask(message)`                          | 4 requests |

---

## Graceful Degradation Rules

| Condition                                                  | Behavior                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connectionType === "local"`                               | Toggle hidden, Agent Mode unreachable                                                                                                            |
| Cloud + `inferenceProviderApiKey` missing                  | One-time warning bubble in chat; still allow send                                                                                                |
| Query Agent throws (e.g., permissions, quota)              | Styled error bubble: `"Agent couldn't answer this. Try rephrasing or disable Agent Mode."` + `▸ Error details` disclosure with raw error message |
| Streaming fails mid-response                               | Fall back to `qa.ask()` silently; render as normal response                                                                                      |
| `getAllCollectionNames()` fails                            | Fall back to single selected collection; log to VS Code output channel                                                                           |
| Agent response has no source objects                       | Omit the Sources section from Query Trace; render rest of trace normally                                                                         |
| `qa.search()` returns no results                           | Show empty state in result cards: `"No matching objects found."`                                                                                 |
| Instantiating `QueryAgent` against a local instance throws | Catch the error; fall back to existing generative search path                                                                                    |

---

## State Shape (Webview React Component)

Add to existing React state:

```typescript
// New fields to add to existing chat panel state interface
agentModeEnabled: boolean; // default: false
scopeMode: 'single' | 'all'; // default: 'single'
showAgentKeyWarning: boolean; // default: false — true after first send with missing key
isStreaming: boolean; // default: false
slashMenuOpen: boolean; // default: false
slashMenuSelectedIndex: number; // default: 0
```

Each message in the conversation history array gets an optional `trace` field:

```typescript
interface InternalChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // NEW — only on agent-generated assistant messages
  trace?: {
    rawResponse: unknown; // full response object from SDK — store as-is
    traceExpanded: boolean; // UI accordion toggle state
  };
}
```

Store the full raw SDK response in `trace.rawResponse` rather than pre-extracting fields at send time. This way, if field names are adjusted later, only the rendering code needs updating — not the storage code.

---

## Telemetry Events

Add the following events following the existing telemetry patterns in the codebase. Never include query text, collection names, or API keys in telemetry payloads.

| Event name                  | Trigger                          | Payload                                                                           |
| --------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `ragChat.agentModeToggled`  | User manually toggles Agent Mode | `{ enabled: boolean }`                                                            |
| `ragChat.agentQuerySent`    | Message sent via Query Agent     | `{ method: 'ask' \| 'search', scopeMode: 'single' \| 'all', streaming: boolean }` |
| `ragChat.agentQuerySuccess` | Agent returns successfully       | `{ method: 'ask' \| 'search', collectionsCount: number }`                         |
| `ragChat.agentQueryError`   | Agent returns an error           | `{ method: 'ask' \| 'search', errorType: string }`                                |
| `ragChat.slashCommandUsed`  | User selects a slash command     | `{ command: string }`                                                             |

---

## Files to Modify

Based on the repo structure, expect to touch:

1. **`src/rag-chat/`** — main module:

   - Panel registration file (`RagChatPanel.ts` or similar) — add `sendViaQueryAgent()`, `mapToChatHistory()`, command routing, and `openObjectInExplorer` handler
   - React webview component — add toggle, scope dropdown, slash-command popup, streaming render, query trace disclosure
   - API wrapper file (if present) — add `QueryAgent` wrapper

2. **Connection config type definition** — add the two new optional fields to `WeaviateConnection` interface wherever it is defined

3. **Connection edit UI** — add "Agent Settings" collapsible section (cloud-only) to the add/edit connection form

4. **`package.json`** — add `weaviate-agents` to dependencies

5. **`telemetry.json`** — document the five new events per existing format in that file

Read all existing files in `src/rag-chat/` before writing any code. Match existing code style, naming conventions, import patterns, and error handling approaches exactly. Do not refactor existing code — only add to it.

---

## Acceptance Criteria

- [ ] On a local connection: no Agent Mode toggle visible; chat works exactly as before
- [ ] On a cloud connection: Agent Mode toggle appears in header; defaults to off
- [ ] Enabling Agent Mode and sending a message routes through `QueryAgent.ask()`, not generative search
- [ ] Sending `/search ...` with Agent Mode on calls `QueryAgent.search()` (not `.ask()`)
- [ ] Command prefix is stripped from the message before it is passed to the SDK
- [ ] "All Collections" auto-enables Agent Mode and passes all collection names to the agent
- [ ] "All Collections" on a local connection: non-blocking fallback message; queries single collection
- [ ] Streaming renders token-by-token when Agent Mode is on (with silent fallback if unavailable)
- [ ] Every `.ask()` response has a `▸ How this was answered` disclosure that expands inline
- [ ] `.search()` responses render as result cards — no query trace disclosure
- [ ] Source links in the trace open the correct object in Data Explorer
- [ ] Slash-command popup appears when `/` is first character; keyboard-navigable
- [ ] Missing `inferenceProviderApiKey` shows one-time warning bubble; does not block sending
- [ ] Agent errors render as a styled error bubble with `▸ Error details` disclosure
- [ ] Chat history passed to `.ask()` is mapped to `{ role, content }` only — no internal fields
- [ ] Five new telemetry events fire correctly with no sensitive data in payloads
- [ ] All existing non-agent chat behavior is 100% unchanged
- [ ] No new VS Code panels, sidebar sections, or commands registered

---

## Reference: weaviate-agents TypeScript API

```typescript
import { QueryAgent } from 'weaviate-agents';
// NOTE: WeaviateChatMessage type name — verify exact export name from SDK types
import type { WeaviateChatMessage } from 'weaviate-agents';

// Instantiate with an existing connected weaviate-client instance
const agent = new QueryAgent(client, {
  collections: ['CollectionA', 'CollectionB'], // or a single string
  systemPrompt: 'Your system prompt here',
});

// --- ASK: Retrieval + LLM answer generation (costs 4 WCD requests) ---
const response = await agent.ask('What are the top products?');
// Verify all field names against SDK TypeScript type definitions before use.
// Directional: response contains an answer string, search result metadata, source objects,
// a reranking boolean, and a token count.

// --- SEARCH: Pure retrieval, no LLM answer (costs 1 WCD request) ---
const searchResponse = await agent.search('wireless headphones under $300');
// Directional: response contains retrieved objects with properties and scores.
// Verify exact field names from SDK types.

// --- STREAMING (verify exact async iterator contract from SDK types) ---
for await (const chunk of agent.stream('What are the top products?')) {
  // chunk shape must be verified from SDK types.
  // Expect: token delta events during generation + a final complete-response event.
}

// --- MULTI-TURN: Pass prior messages as context ---
// weaviate-agents expects { role: 'user' | 'assistant', content: string } ONLY.
// Strip all internal fields (id, timestamp, trace, etc.) before passing.
const history = [
  { role: 'user' as const, content: 'What are laptops under $1000?' },
  { role: 'assistant' as const, content: 'Here are some options: ...' },
];
const followUp = await agent.ask('Which has the best battery?', { chatHistory: history });
```

**Key API facts (verified against SDK):**

- The primary answer method is `.ask()` — not `.run()` (`.run()` does not exist)
- `.search()` is a distinct method for pure retrieval — significantly cheaper on WCD quota
- Both methods accept the same `client` and `QueryAgent` constructor options
- `chatHistory` is passed as an option to `.ask()`, not to `.search()`
- System prompt is set at `QueryAgent` constructor time, not per-call

---

_End of feature spec. Version 2.1._
