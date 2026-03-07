/**
 * RagChat - Root component for the RAG Chat webview
 * Provides a chat interface for asking questions about Weaviate collection data
 * using generative AI (Retrieval-Augmented Generation).
 * Supports multi-collection selection via an add-and-pill UI.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'markdown-to-jsx';
import type {
  RagChatHistoryEntry,
  RagContextObject,
  RagChatExtensionMessage,
  RagChatWebviewMessage,
} from '../types';

// Initial data injected by the extension into window.initialData
interface RagChatInitialData {
  connectionId: string;
  initialCollectionName: string | null;
}

function getInitialData(): RagChatInitialData | undefined {
  return (window as any).initialData as RagChatInitialData | undefined;
}

// Acquire VS Code API once at module level.
// NOTE: acquireVsCodeApi() can only be called once per webview session.
// Calling it again (e.g. during HMR) will throw. This matches the Data Explorer pattern.
const vscodeApi = (window as any).acquireVsCodeApi();

function generateRequestId(): string {
  return `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Top-k limit options
const TOP_K_OPTIONS = [3, 5, 10, 20] as const;

// ─── Sub-components ──────────────────────────────────────────────────

/** Collapsible section for retrieved context objects, grouped by collection */
function ContextSection({ contextObjects }: { contextObjects: RagContextObject[] }) {
  const [expanded, setExpanded] = useState(false);

  if (contextObjects.length === 0) {
    return null;
  }

  // Group context objects by collectionName for multi-collection attribution
  const hasCollectionNames = contextObjects.some((obj) => obj.collectionName);
  const grouped: Map<string, RagContextObject[]> = new Map();
  if (hasCollectionNames) {
    for (const obj of contextObjects) {
      const key = obj.collectionName || 'Unknown';
      const list = grouped.get(key) || [];
      list.push(obj);
      grouped.set(key, list);
    }
  }

  return (
    <div className="rag-context-section">
      <button
        type="button"
        className="rag-context-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="rag-context-list"
      >
        <span
          className={`codicon codicon-chevron-${expanded ? 'down' : 'right'}`}
          aria-hidden="true"
        />
        Retrieved Context ({contextObjects.length} objects)
      </button>
      {expanded && (
        <ul id="rag-context-list" className="rag-context-list" role="list">
          {hasCollectionNames
            ? Array.from(grouped.entries()).map(([collectionName, objects]) => (
                <li key={collectionName} className="rag-context-group">
                  <div className="rag-context-collection-label">{collectionName}</div>
                  <ul className="rag-context-list" role="list">
                    {objects.map((obj) => (
                      <ContextItem key={obj.uuid} obj={obj} collectionName={collectionName} />
                    ))}
                  </ul>
                </li>
              ))
            : contextObjects.map((obj) => (
                <ContextItem key={obj.uuid} obj={obj} collectionName={obj.collectionName} />
              ))}
        </ul>
      )}
    </div>
  );
}

/** A single context object item */
function ContextItem({ obj, collectionName }: { obj: RagContextObject; collectionName?: string }) {
  const textProps = Object.entries(obj.properties)
    .filter(([, v]) => typeof v === 'string')
    .slice(0, 3);

  // Resolve the best collection name available
  const resolvedCollection = collectionName || obj.collectionName;

  return (
    <li className="rag-context-item">
      <div className="rag-context-uuid-row">
        <span className="rag-context-uuid" title={obj.uuid}>
          {obj.uuid}
        </span>
        {resolvedCollection ? (
          <button
            type="button"
            className="rag-open-explorer-btn"
            onClick={() =>
              vscodeApi.postMessage({
                command: 'openInDataExplorer',
                collectionName: resolvedCollection,
                uuid: obj.uuid,
              })
            }
            title={`Open in Data Explorer (${resolvedCollection})`}
            aria-label={`Open ${resolvedCollection} in Data Explorer`}
          >
            {/* Inline telescope SVG matching the VS Code codicon used by Data Explorer */}
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M14.447 6.276L11.947 1.276C11.823 1.029 11.523 0.928 11.276 1.052L8.276 2.552C8.029 2.676 7.929 2.976 8.052 3.223L8.078 3.276L4.525 5.052C4.278 5.176 4.178 5.476 4.301 5.723L4.577 6.276L2.024 7.552C1.777 7.676 1.677 7.976 1.8 8.223L2.8 10.223C2.888 10.398 3.065 10.499 3.247 10.499C3.322 10.499 3.398 10.482 3.471 10.446L6.024 9.17L6.3 9.723C6.346 9.814 6.417 9.883 6.499 9.93L4.565 13.248C4.425 13.486 4.506 13.793 4.745 13.932C4.824 13.979 4.911 14 4.997 14C5.169 14 5.336 13.911 5.429 13.752L7.924 9.471L7.997 9.434V14.5C7.997 14.776 8.221 15 8.497 15C8.773 15 8.997 14.776 8.997 14.5V9.346L11.565 13.752C11.658 13.911 11.825 14 11.997 14C12.083 14 12.17 13.979 12.249 13.932C12.487 13.793 12.568 13.487 12.429 13.248L9.707 8.579L10.523 8.171L10.549 8.224C10.637 8.399 10.814 8.5 10.996 8.5C11.071 8.5 11.147 8.483 11.22 8.447L14.22 6.947C14.467 6.823 14.567 6.523 14.444 6.276H14.447ZM3.474 9.329L2.921 8.224L5.026 7.171L5.579 8.276L3.474 9.329ZM6.974 8.829L5.421 5.724L8.526 4.171L10.079 7.276L6.974 8.829ZM11.224 7.329L9.171 3.224L11.276 2.171L13.329 6.276L11.224 7.329Z" />
            </svg>
          </button>
        ) : null}
      </div>
      {textProps.map(([key, value]) => (
        <div key={key} className="rag-context-prop">
          <span className="rag-context-prop-key">{key}:</span>{' '}
          <span className="rag-context-prop-value">
            {String(value).length > 200 ? `${String(value).substring(0, 200)}…` : String(value)}
          </span>
        </div>
      ))}
      {(typeof obj.distance === 'number' ||
        typeof obj.certainty === 'number' ||
        typeof obj.score === 'number') && (
        <div className="rag-context-scores">
          {typeof obj.score === 'number' && (
            <span className="rag-context-score">score: {obj.score.toFixed(4)}</span>
          )}
          {typeof obj.distance === 'number' && (
            <span className="rag-context-score">distance: {obj.distance.toFixed(4)}</span>
          )}
          {typeof obj.certainty === 'number' && (
            <span className="rag-context-score">certainty: {obj.certainty.toFixed(4)}</span>
          )}
        </div>
      )}
    </li>
  );
}

/** A single chat history entry (question + response/error/loading) */
function ChatEntry({ entry, showContext }: { entry: RagChatHistoryEntry; showContext: boolean }) {
  return (
    <div className="rag-chat-entry" role="article" aria-label={`Question: ${entry.query.question}`}>
      {/* User question bubble */}
      <div className="rag-bubble rag-bubble-user">
        <div className="rag-bubble-label">You</div>
        <div className="rag-bubble-content">
          {entry.query.question}
          {entry.query.collectionNames.length > 0 && (
            <div className="rag-bubble-collections">
              {entry.query.collectionNames.map((name) => (
                <span key={name} className="rag-collection-pill rag-collection-pill-small">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Response area */}
      <div className="rag-bubble rag-bubble-assistant">
        <div className="rag-bubble-label">Weaviate</div>
        {entry.loading && (
          <div className="rag-loading" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <span>Generating answer…</span>
          </div>
        )}
        {entry.error && (
          <div className="rag-error" role="alert">
            {entry.error}
          </div>
        )}
        {entry.response && (
          <>
            <div className="rag-bubble-content rag-answer">
              <Markdown>{entry.response.answer}</Markdown>
            </div>
            {showContext && <ContextSection contextObjects={entry.response.contextObjects} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Multi-collection selector: dropdown to add + pill list of selected */
function CollectionSelector({
  allCollections,
  selectedCollections,
  onAdd,
  onRemove,
}: {
  allCollections: string[];
  selectedCollections: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  // Collections available for adding (not yet selected)
  const availableCollections = allCollections.filter((c) => !selectedCollections.includes(c));

  // Auto-add on select change (no separate "Add" button)
  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value) {
        onAdd(value);
        e.target.value = ''; // Reset to placeholder
      }
    },
    [onAdd]
  );

  const selectedCount = selectedCollections.length;

  return (
    <div className="rag-collection-selector">
      <div className="rag-collection-header">
        <label className="rag-label" id="rag-collection-label">
          Collections
        </label>
        {selectedCount >= 3 && (
          <span className="rag-collection-summary">{selectedCount} collections selected</span>
        )}
      </div>

      {/* Selected collections as pills */}
      {selectedCount > 0 && (
        <div className="rag-collection-pills" role="list" aria-label="Selected collections">
          {selectedCollections.map((name) => (
            <span key={name} className="rag-collection-pill" role="listitem">
              {name}
              <button
                type="button"
                className="rag-pill-remove"
                onClick={() => onRemove(name)}
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add collection dropdown — auto-adds on selection */}
      {availableCollections.length > 0 && (
        <select
          className="rag-select rag-select-auto"
          aria-labelledby="rag-collection-label"
          value=""
          onChange={handleSelectChange}
        >
          <option value="" disabled>
            {selectedCount === 0 ? 'Select a collection…' : 'Add another collection…'}
          </option>
          {availableCollections.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}

      {/* Validation hint */}
      {selectedCount === 0 && allCollections.length > 0 && (
        <span className="rag-validation-hint">Select at least one collection to start</span>
      )}

      {allCollections.length === 0 && (
        <span className="rag-no-collections">
          No generative collections found. Please ensure your Weaviate instance is configured with a
          generative AI module (e.g., OpenAI, Cohere, etc.).
        </span>
      )}
    </div>
  );
}

/** RAG configuration options: top-k limit and show context toggle */
function RagOptions({
  topK,
  showContext,
  onTopKChange,
  onShowContextChange,
}: {
  topK: number;
  showContext: boolean;
  onTopKChange: (value: number) => void;
  onShowContextChange: (value: boolean) => void;
}) {
  return (
    <div className="rag-options">
      <div className="rag-options-group">
        <label className="rag-options-label" htmlFor="rag-topk-select">
          Top results per collection
        </label>
        <select
          id="rag-topk-select"
          className="rag-select rag-select-small"
          value={topK}
          onChange={(e) => onTopKChange(Number(e.target.value))}
        >
          {TOP_K_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="rag-options-group">
        <label className="rag-options-label rag-options-label-inline" htmlFor="rag-show-context">
          <input
            id="rag-show-context"
            type="checkbox"
            checked={showContext}
            onChange={(e) => onShowContextChange(e.target.checked)}
          />
          Show retrieved context
        </label>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export function RagChat() {
  const initialData = getInitialData();
  const [allCollections, setAllCollections] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(() => {
    const initial = initialData?.initialCollectionName;
    return initial ? [initial] : [];
  });
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<RagChatHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(5);
  const [showContext, setShowContext] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Send initialize message on mount
  useEffect(() => {
    vscodeApi.postMessage({ command: 'initialize' } satisfies RagChatWebviewMessage);
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    function handleMessage(event: MessageEvent<RagChatExtensionMessage>) {
      const msg = event.data;

      switch (msg.command) {
        case 'init':
        case 'collectionsLoaded': {
          const names = msg.collectionNames ?? [];
          setAllCollections(names);
          // If we had a pre-selected collection from initialData and it
          // exists in the list, keep it. Otherwise keep whatever is valid.
          setSelectedCollections((prev) => {
            const valid = prev.filter((c) => names.includes(c));
            if (valid.length > 0) {
              return valid;
            }
            // Pre-select initialCollectionName if it's in the list
            const initial = initialData?.initialCollectionName;
            if (initial && names.includes(initial)) {
              return [initial];
            }
            return [];
          });
          break;
        }
        case 'addCollection': {
          // Extension is telling us to add a collection to the selection
          // (e.g. user right-clicked a different collection while panel is open)
          const toAdd = msg.collectionNames ?? [];
          setSelectedCollections((prev) => {
            const merged = [...prev];
            for (const name of toAdd) {
              if (!merged.includes(name)) {
                merged.push(name);
              }
            }
            return merged;
          });
          break;
        }
        case 'ragResponse': {
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === msg.requestId
                ? {
                    ...entry,
                    loading: false,
                    response: {
                      answer: msg.answer ?? '',
                      contextObjects: msg.contextObjects ?? [],
                      query: entry.query,
                      timestamp: Date.now(),
                    },
                  }
                : entry
            )
          );
          setLoading(false);
          break;
        }
        case 'ragError': {
          setHistory((prev) =>
            prev.map((entry) =>
              entry.id === msg.requestId
                ? { ...entry, loading: false, error: msg.error ?? 'Unknown error' }
                : entry
            )
          );
          setLoading(false);
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Collection add/remove handlers
  const handleAddCollection = useCallback((name: string) => {
    setSelectedCollections((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const handleRemoveCollection = useCallback((name: string) => {
    setSelectedCollections((prev) => prev.filter((c) => c !== name));
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = question.trim();
    if (!trimmed || selectedCollections.length === 0 || loading) {
      return;
    }

    const requestId = generateRequestId();

    const entry: RagChatHistoryEntry = {
      id: requestId,
      query: {
        collectionNames: [...selectedCollections],
        question: trimmed,
        limit: topK,
      },
      response: null,
      error: null,
      loading: true,
      timestamp: Date.now(),
    };

    setHistory((prev) => [...prev, entry]);
    setLoading(true);
    setQuestion('');

    vscodeApi.postMessage({
      command: 'executeRagQuery',
      collectionNames: [...selectedCollections],
      question: trimmed,
      limit: topK,
      requestId,
    } satisfies RagChatWebviewMessage);
  }, [question, selectedCollections, loading, topK]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // initialData is a module-level constant from getInitialData(), so it's
  // stable across renders; listing it in deps is technically correct.
  const handleClearChat = useCallback(() => {
    setHistory([]);
    setQuestion('');
    setSelectedCollections(
      initialData?.initialCollectionName ? [initialData.initialCollectionName] : []
    );
  }, [initialData]);

  const connectionId = initialData?.connectionId ?? '';
  const canSubmit = question.trim().length > 0 && selectedCollections.length > 0 && !loading;

  return (
    <div className="rag-chat">
      {/* Header */}
      <header className="rag-chat-header">
        <div className="rag-header-left">
          <h1 className="rag-chat-title">RAG Chat</h1>
          {connectionId && <span className="rag-chat-subtitle">Connected to {connectionId}</span>}
        </div>
        {history.length > 0 && (
          <button
            type="button"
            className="rag-clear-btn"
            onClick={handleClearChat}
            title="Clear chat"
            aria-label="Clear chat"
          >
            Clear
          </button>
        )}
      </header>

      {/* Chat history area */}
      <main className="rag-chat-history" role="log" aria-label="Chat history" aria-live="polite">
        {history.length === 0 && (
          <div className="rag-chat-empty">
            <p>Ask a question about your Weaviate collection data.</p>
            <p>Select one or more collections below and type your question to get started.</p>
          </div>
        )}
        {history.map((entry) => (
          <ChatEntry key={entry.id} entry={entry} showContext={showContext} />
        ))}
        <div ref={chatEndRef} />
      </main>

      {/* Input area */}
      <footer className="rag-chat-input-area">
        <CollectionSelector
          allCollections={allCollections}
          selectedCollections={selectedCollections}
          onAdd={handleAddCollection}
          onRemove={handleRemoveCollection}
        />
        <RagOptions
          topK={topK}
          showContext={showContext}
          onTopKChange={setTopK}
          onShowContextChange={setShowContext}
        />
        <div className="rag-chat-input-row">
          <textarea
            ref={textareaRef}
            className="rag-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            aria-label="Question input"
            rows={2}
            disabled={loading}
          />
          <button
            type="button"
            className="rag-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Send question"
          >
            Ask
          </button>
        </div>
      </footer>
    </div>
  );
}

export default RagChat;
