/**
 * RagChat - Root component for the RAG Chat webview
 * Provides a chat interface for asking questions about Weaviate collection data
 * using generative AI (Retrieval-Augmented Generation).
 * Supports multi-collection selection via an add-and-pill UI.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Acquire VS Code API once at module level
const vscodeApi = (window as any).acquireVsCodeApi();

function generateRequestId(): string {
  return `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────

/** Collapsible section for retrieved context objects */
function ContextSection({ contextObjects }: { contextObjects: RagContextObject[] }) {
  const [expanded, setExpanded] = useState(false);

  if (contextObjects.length === 0) {
    return null;
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
          {contextObjects.map((obj) => {
            const textProps = Object.entries(obj.properties)
              .filter(([, v]) => typeof v === 'string')
              .slice(0, 3);

            return (
              <li key={obj.uuid} className="rag-context-item">
                <div className="rag-context-uuid" title={obj.uuid}>
                  {obj.uuid}
                </div>
                {textProps.map(([key, value]) => (
                  <div key={key} className="rag-context-prop">
                    <span className="rag-context-prop-key">{key}:</span>{' '}
                    <span className="rag-context-prop-value">
                      {String(value).length > 200
                        ? `${String(value).substring(0, 200)}…`
                        : String(value)}
                    </span>
                  </div>
                ))}
                {(obj.distance != null || obj.certainty != null) && (
                  <div className="rag-context-scores">
                    {obj.distance != null && (
                      <span className="rag-context-score">distance: {obj.distance.toFixed(4)}</span>
                    )}
                    {obj.certainty != null && (
                      <span className="rag-context-score">
                        certainty: {obj.certainty.toFixed(4)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A single chat history entry (question + response/error/loading) */
function ChatEntry({ entry }: { entry: RagChatHistoryEntry }) {
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
            <div className="rag-bubble-content rag-answer">{entry.response.answer}</div>
            <ContextSection contextObjects={entry.response.contextObjects} />
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
  const selectRef = useRef<HTMLSelectElement>(null);

  // Collections available for adding (not yet selected)
  const availableCollections = allCollections.filter((c) => !selectedCollections.includes(c));

  const handleAdd = useCallback(() => {
    const value = selectRef.current?.value;
    if (value) {
      onAdd(value);
      // Reset dropdown to placeholder
      if (selectRef.current) {
        selectRef.current.value = '';
      }
    }
  }, [onAdd]);

  return (
    <div className="rag-collection-selector">
      <label className="rag-label" id="rag-collection-label">
        Collections
      </label>

      {/* Selected collections as pills */}
      {selectedCollections.length > 0 && (
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

      {/* Add collection dropdown */}
      {availableCollections.length > 0 && (
        <div className="rag-collection-add-row">
          <select
            ref={selectRef}
            className="rag-select"
            aria-labelledby="rag-collection-label"
            defaultValue=""
          >
            <option value="" disabled>
              {selectedCollections.length === 0
                ? 'Select a collection…'
                : 'Add another collection…'}
            </option>
            {availableCollections.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className="rag-add-btn" onClick={handleAdd} title="Add collection">
            Add
          </button>
        </div>
      )}

      {allCollections.length === 0 && (
        <span className="rag-no-collections">No collections available</span>
      )}
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
      requestId,
    } satisfies RagChatWebviewMessage);
  }, [question, selectedCollections, loading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const connectionId = initialData?.connectionId ?? '';
  const canSubmit = question.trim().length > 0 && selectedCollections.length > 0 && !loading;

  return (
    <div className="rag-chat">
      {/* Header */}
      <header className="rag-chat-header">
        <h1 className="rag-chat-title">RAG Chat</h1>
        {connectionId && <span className="rag-chat-subtitle">Connected to {connectionId}</span>}
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
          <ChatEntry key={entry.id} entry={entry} />
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
