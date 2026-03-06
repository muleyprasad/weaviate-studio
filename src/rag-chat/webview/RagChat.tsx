/**
 * RagChat - Root component for the RAG Chat webview
 * Provides a chat interface for asking questions about Weaviate collection data
 * using generative AI (Retrieval-Augmented Generation)
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
  collectionNames: string[];
}

function getInitialData(): RagChatInitialData | undefined {
  return (window as any).initialData as RagChatInitialData | undefined;
}

// Acquire VS Code API once at module level
const vscodeApi = (window as any).acquireVsCodeApi();

function generateRequestId(): string {
  return `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
        <div className="rag-bubble-content">{entry.query.question}</div>
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

export function RagChat() {
  const initialData = getInitialData();
  const [collections, setCollections] = useState<string[]>(initialData?.collectionNames ?? []);
  const [selectedCollection, setSelectedCollection] = useState<string>(
    initialData?.collectionNames?.[0] ?? ''
  );
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
          setCollections(names);
          setSelectedCollection((prev) => (names.includes(prev) ? prev : (names[0] ?? '')));
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

  const handleSubmit = useCallback(() => {
    const trimmed = question.trim();
    if (!trimmed || !selectedCollection || loading) {
      return;
    }

    const requestId = generateRequestId();

    const entry: RagChatHistoryEntry = {
      id: requestId,
      query: {
        collectionNames: [selectedCollection],
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
      collectionNames: [selectedCollection],
      question: trimmed,
      requestId,
    } satisfies RagChatWebviewMessage);
  }, [question, selectedCollection, loading]);

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
  const canSubmit = question.trim().length > 0 && selectedCollection && !loading;

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
            <p>Select a collection below and type your question to get started.</p>
          </div>
        )}
        {history.map((entry) => (
          <ChatEntry key={entry.id} entry={entry} />
        ))}
        <div ref={chatEndRef} />
      </main>

      {/* Input area */}
      <footer className="rag-chat-input-area">
        <div className="rag-chat-controls">
          <label htmlFor="rag-collection-select" className="rag-label">
            Collection
          </label>
          <select
            id="rag-collection-select"
            className="rag-select"
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            aria-label="Select collection"
            disabled={collections.length === 0}
          >
            {collections.length === 0 && <option value="">No collections available</option>}
            {collections.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
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
