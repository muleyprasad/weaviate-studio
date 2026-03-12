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
  CollectionInfo,
  GenerativeProviderSelection,
  AdvancedRagSettings,
} from '../types';

// Initial data injected by the extension into window.initialData
interface RagChatInitialData {
  connectionId: string;
  initialCollectionName: string | null;
  connectionName: string | null;
  inheritedFilters?: import('../types').FilterCondition[] | null;
  inheritedFilterMatchMode?: import('../types').FilterMatchMode | null;
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

// ─── Shared Primitive Components ─────────────────────────────────────

/**
 * Inline SVG icons — avoids dependency on the codicon TTF font, which
 * does not load reliably in VS Code webview contexts without Monaco.
 * Paths are taken from the VS Code codicon SVG source.
 */
const ICON_SVGS: Record<string, string> = {
  // copy icon
  copy: 'M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7z M7 2H2l-1 1v10l1 1h2v-1H2V3h5v1h1V2z',
  // source-control (used for "raw markdown" toggle)
  'source-control':
    'M7.443 1.946l3.2 3.2-.707.707-3.2-3.2.707-.707zM8.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm4 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM5 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm7.5 9.354l-3.185-3.185.707-.707 3.185 3.185-.707.707zM5 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM4.293 12.5l3.185-3.185-.707-.707-3.185 3.185.707.707z',
  // preview (eye icon)
  preview:
    'M8 4C5.255 4 2.764 5.684 1.09 8c1.674 2.316 4.165 4 6.91 4s5.236-1.684 6.91-4C13.236 5.684 10.745 4 8 4zm0 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  // refresh / retry
  refresh:
    'M5.728 11.485A4.003 4.003 0 0 0 12 8h1a5 5 0 0 1-8.535 3.536L5 12H3v-4h4l-.707.707-.565-.222zM10.272 4.515A4.003 4.003 0 0 0 4 8H3a5 5 0 0 1 8.535-3.536L11 4h2v4h-4l.707-.707.565.222z',
  // chevron-right
  'chevron-right': 'M5.7 13.7L4.3 12.3 8.6 8l-4.3-4.3 1.4-1.4L11.4 8z',
  // chevron-down
  'chevron-down': 'M7.976 10.072l4.357-4.357.62.618L8.285 11h-.618L3 6.333l.619-.618 4.357 4.357z',
  // warning
  warning:
    'M7.557 3l-5.46 9h10.92L7.557 3zm.44 1.5l4.46 7.5H3.597L8 4.5h-.003zM8 11H7v-1h1v1zm0-2H7V6h1v3z',
  // check (used for copy success)
  check:
    'M13.736 4.417a1.002 1.002 0 0 0-1.415-.068l-5.83 5.412-2.5-2.585a1 1 0 1 0-1.436 1.388L5.783 12.062 13.668 5.833a1.002 1.002 0 0 0 .068-1.416z',
};

/**
 * Renders an inline-SVG icon by name.
 * Falls back to a "?" character if the icon is not found.
 */
function SvgIcon({ name, size = 16 }: { name: string; size?: number }) {
  const d = ICON_SVGS[name];
  if (!d) return <span title={name}>?</span>;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

/**
 * IconButton — a small square button with an inline SVG icon.
 * Uses SVGs instead of codicon font to avoid font-loading issues in webview.
 */
function IconButton({
  icon,
  title,
  onClick,
  className = '',
  variant = 'default',
}: {
  icon: string;
  title: string;
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'error';
}) {
  return (
    <button
      type="button"
      className={`rag-icon-btn${variant === 'error' ? ' rag-icon-btn--error' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <SvgIcon name={icon} size={16} />
    </button>
  );
}

/**
 * CollectionPills — renders a horizontal row of badge pills for collection names.
 */
function CollectionPills({
  names,
  size = 'default',
  className = '',
}: {
  names: string[];
  size?: 'small' | 'default';
  className?: string;
}) {
  if (names.length === 0) return null;
  const pillClass = size === 'small' ? 'rag-collection-pill-small' : 'rag-collection-pill';
  return (
    <div className={`rag-collection-pills-row${className ? ` ${className}` : ''}`}>
      {names.map((name) => (
        <span key={name} className={pillClass}>
          {name}
        </span>
      ))}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

/** Format duration in ms to human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${minutes}m`;
}

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
        <SvgIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
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
  const keyFields = ['created_at', 'published_date', 'video_id', 'podcast_id'];
  const keyProps = Object.entries(obj.properties).filter(
    ([k, v]) => keyFields.includes(k) && typeof v === 'string'
  );
  const otherProps = Object.entries(obj.properties)
    .filter(([k, v]) => !keyFields.includes(k) && typeof v === 'string')
    .slice(0, Math.max(0, 3 - keyProps.length));

  const textProps = [...keyProps, ...otherProps];

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
function ChatEntry({
  entry,
  showContext,
  onRetry,
}: {
  entry: RagChatHistoryEntry;
  showContext: boolean;
  onRetry?: (entry: RagChatHistoryEntry) => void;
}) {
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAnswer = useCallback(() => {
    if (entry.response?.answer) {
      navigator.clipboard.writeText(entry.response.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [entry.response?.answer]);

  return (
    <div className="rag-chat-entry" role="article" aria-label={`Question: ${entry.query.question}`}>
      {/* User question bubble */}
      <div className="rag-bubble rag-bubble-user">
        <div className="rag-bubble-label">You</div>
        <div className="rag-bubble-content">
          {entry.query.question}
          {entry.query.collectionNames.length > 0 && (
            <CollectionPills
              names={entry.query.collectionNames}
              size="small"
              className="rag-bubble-pills"
            />
          )}
        </div>
      </div>

      {/* Response area */}
      <div className="rag-bubble rag-bubble-assistant">
        {/* Label row — no actions here anymore */}
        <div className="rag-bubble-header">
          <div className="rag-bubble-label">Weaviate</div>
        </div>

        {entry.loading && (
          <div className="rag-loading" role="status" aria-live="polite">
            <div className="loading-spinner" />
            <span>Generating answer…</span>
          </div>
        )}

        {entry.error && (
          <div className="rag-error" role="alert">
            <div className="rag-error-content">
              <SvgIcon name="warning" size={16} />
              <span>{entry.error}</span>
            </div>
            {onRetry && (
              <IconButton
                icon="refresh"
                title="Retry this query"
                onClick={() => onRetry(entry)}
                variant="error"
              />
            )}
          </div>
        )}

        {entry.response && (
          <>
            <div className="rag-bubble-content rag-answer">
              {/* Action buttons as a top header row for the answer */}
              <div className="rag-answer-actions">
                <IconButton
                  icon={copied ? 'check' : 'copy'}
                  title={copied ? 'Copied!' : 'Copy answer to clipboard'}
                  onClick={handleCopyAnswer}
                />
                <button
                  type="button"
                  className="rag-toggle-btn"
                  onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                  title={showRawMarkdown ? 'Show rendered preview' : 'Show raw markdown'}
                >
                  {showRawMarkdown ? 'Preview' : 'Raw'}
                </button>
              </div>

              {showRawMarkdown ? (
                <pre className="rag-raw-markdown">{entry.response.answer}</pre>
              ) : (
                <Markdown>{entry.response.answer}</Markdown>
              )}

              <div className="rag-query-meta">
                <CollectionPills names={entry.response.query.collectionNames} size="small" />
                <div className="rag-query-meta-right">
                  {entry.response.durationMs && (
                    <span className="rag-query-duration">
                      {formatDuration(entry.response.durationMs)}
                    </span>
                  )}
                  {entry.response.hasError && onRetry && (
                    <IconButton
                      icon="refresh"
                      title="Retry this query"
                      onClick={() => onRetry(entry)}
                      variant="error"
                    />
                  )}
                </div>
              </div>
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
  collectionInfos,
  selectedCollections,
  onAdd,
  onRemove,
  loading,
}: {
  allCollections: string[];
  collectionInfos: CollectionInfo[];
  selectedCollections: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  loading: boolean;
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
  const infoMap = new Map(collectionInfos.map((c) => [c.name, c]));

  return (
    <div className="rag-collection-selector">
      <div className="rag-collection-header">
        <label className="rag-label" id="rag-collection-label">
          Collections
        </label>
        <span className="rag-collection-helper">Used as retrieval sources</span>
        {selectedCount >= 3 && (
          <span className="rag-collection-summary">{selectedCount} collections selected</span>
        )}
      </div>

      {/* Selected collections as removable pills */}
      {selectedCount > 0 && (
        <div className="rag-collection-pills" role="list" aria-label="Selected collections">
          {selectedCollections.map((name) => {
            const info = infoMap.get(name);
            const showBm25Hint = info && !info.hasVectorizer;
            return (
              <span key={name} className="rag-collection-pill" role="listitem">
                {name}
                {showBm25Hint && (
                  <span
                    className="rag-bm25-hint"
                    title="No vectorizer — using BM25 full-text search"
                  >
                    ⚡ BM25
                  </span>
                )}
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
            );
          })}
        </div>
      )}

      {loading && allCollections.length === 0 ? (
        <span className="rag-loading-collections">
          <div
            className="loading-spinner"
            style={{
              width: 12,
              height: 12,
              marginRight: 8,
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
          />
          Loading collections…
        </span>
      ) : (
        <>
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
              No collections found. Connect to a Weaviate instance to see your collections.
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** RAG configuration options: top-k limit, timeout, and show context toggle */
function RagOptions({
  topK,
  timeout,
  showContext,
  onTopKChange,
  onTimeoutChange,
  onShowContextChange,
}: {
  topK: number;
  timeout: number;
  showContext: boolean;
  onTopKChange: (value: number) => void;
  onTimeoutChange: (value: number) => void;
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
        <label className="rag-options-label" htmlFor="rag-timeout-select">
          Query timeout (ms)
        </label>
        <select
          id="rag-timeout-select"
          className="rag-select rag-select-small"
          value={timeout}
          onChange={(e) => onTimeoutChange(Number(e.target.value))}
          title="Maximum time to wait for the RAG query to complete"
        >
          <option value={30000}>30s</option>
          <option value={60000}>60s</option>
          <option value={120000}>2min</option>
          <option value={300000}>5min</option>
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

/** Generative provider selector dropdown */
function ProviderSelector({
  availableModules,
  selectedProvider,
  onChange,
}: {
  availableModules: string[];
  selectedProvider: GenerativeProviderSelection;
  onChange: (p: GenerativeProviderSelection) => void;
}) {
  // Build a combined value string from the discriminated union
  const toValue = (p: GenerativeProviderSelection): string => {
    if (p.kind === 'default') return 'default';
    if (p.kind === 'module') return `module:${p.moduleName}`;
    return 'custom';
  };

  const fromValue = (v: string): GenerativeProviderSelection => {
    if (v === 'default') return { kind: 'default' };
    if (v === 'custom') return { kind: 'custom' };
    return { kind: 'module', moduleName: v.replace('module:', '') };
  };

  return (
    <div className="rag-provider-selector">
      <label className="rag-options-label" htmlFor="rag-provider-select">
        Generative provider
      </label>
      <select
        id="rag-provider-select"
        className="rag-select rag-select-small"
        value={toValue(selectedProvider)}
        onChange={(e) => onChange(fromValue(e.target.value))}
        title="Which generative AI provider to use for answer generation"
      >
        <option value="default">Default (server-configured)</option>
        {availableModules.map((mod) => (
          <option key={mod} value={`module:${mod}`}>
            {mod.replace('generative-', '')}
          </option>
        ))}
        <option value="custom">Custom (Advanced Settings)</option>
      </select>
    </div>
  );
}

/** Collapsible Advanced RAG Settings panel */
function AdvancedRagPanel({
  settings,
  onChange,
  onSave,
}: {
  settings: AdvancedRagSettings;
  onChange: (s: AdvancedRagSettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="rag-advanced-panel">
      <div className="rag-advanced-title">Custom LLM Endpoint (OpenAI-compatible)</div>
      <div className="rag-advanced-fields">
        <div className="rag-advanced-field">
          <label className="rag-options-label" htmlFor="rag-adv-baseurl">
            Base URL
          </label>
          <input
            id="rag-adv-baseurl"
            type="url"
            className="rag-input"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onChange={(e) => onChange({ ...settings, baseUrl: e.target.value })}
          />
        </div>
        <div className="rag-advanced-field">
          <label className="rag-options-label" htmlFor="rag-adv-apikey">
            API Key
          </label>
          <input
            id="rag-adv-apikey"
            type="password"
            className="rag-input"
            placeholder="sk-…"
            value={settings.apiKey}
            onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
          />
        </div>
        <div className="rag-advanced-field">
          <label className="rag-options-label" htmlFor="rag-adv-model">
            Model
          </label>
          <input
            id="rag-adv-model"
            type="text"
            className="rag-input"
            placeholder="gpt-4o-mini"
            value={settings.model}
            onChange={(e) => onChange({ ...settings, model: e.target.value })}
          />
        </div>
      </div>
      <button type="button" className="rag-save-btn" onClick={onSave}>
        Save Settings
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export function RagChat() {
  const initialData = getInitialData();
  const [collectionInfos, setCollectionInfos] = useState<CollectionInfo[]>([]);
  const [allCollections, setAllCollections] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(() => {
    const initial = initialData?.initialCollectionName;
    return initial ? [initial] : [];
  });
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<RagChatHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(5);
  const [queryTimeout, setQueryTimeout] = useState(120000); // Default 2 minutes
  const [showContext, setShowContext] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<GenerativeProviderSelection>({
    kind: 'default',
  });
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedRagSettings>({
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Send initialize message on mount, then load advanced settings
  useEffect(() => {
    vscodeApi.postMessage({ command: 'initialize' } satisfies RagChatWebviewMessage);
    vscodeApi.postMessage({ command: 'getAdvancedSettings' } satisfies RagChatWebviewMessage);
  }, []);

  // Auto-show advanced panel when Custom provider is selected
  useEffect(() => {
    if (selectedProvider.kind === 'custom') {
      setShowAdvancedSettings(true);
    }
  }, [selectedProvider]);

  // Listen for messages from extension
  useEffect(() => {
    function handleMessage(event: MessageEvent<RagChatExtensionMessage>) {
      const msg = event.data;

      switch (msg.command) {
        case 'init':
        case 'collectionsLoaded': {
          const infos = msg.collectionInfos ?? [];
          const names = infos.map((c) => c.name);
          setCollectionInfos(infos);
          setAllCollections(names);
          if (msg.command === 'init' && msg.availableModules) {
            setAvailableModules(msg.availableModules);
          }
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
          setCollectionsLoading(false);
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
        case 'advancedSettingsLoaded': {
          if (msg.advancedSettings) {
            setAdvancedSettings(msg.advancedSettings);
          }
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
                      durationMs: msg.durationMs,
                      hasError: msg.hasError,
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

  const handleSaveAdvancedSettings = useCallback(() => {
    vscodeApi.postMessage({
      command: 'saveAdvancedSettings',
      advancedSettings,
    } satisfies RagChatWebviewMessage);
  }, [advancedSettings]);

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
      timeout: queryTimeout,
      requestId,
      provider: selectedProvider,
      advancedSettings: selectedProvider.kind === 'custom' ? advancedSettings : undefined,
    } satisfies RagChatWebviewMessage);
  }, [
    question,
    selectedCollections,
    topK,
    queryTimeout,
    loading,
    selectedProvider,
    advancedSettings,
  ]);

  /** Retry a failed entry: reset it to loading state and re-send the same query */
  const handleRetry = useCallback(
    (entry: RagChatHistoryEntry) => {
      const newRequestId = generateRequestId();

      // Replace the failed entry with a fresh loading state
      setHistory((prev) =>
        prev.map((h) =>
          h.id === entry.id
            ? {
                ...h,
                id: newRequestId,
                error: null,
                response: null,
                loading: true,
                timestamp: Date.now(),
              }
            : h
        )
      );
      setLoading(true);

      vscodeApi.postMessage({
        command: 'executeRagQuery',
        collectionNames: [...entry.query.collectionNames],
        question: entry.query.question,
        limit: entry.query.limit,
        timeout: queryTimeout, // Use current UI timeout, not the original failed one
        requestId: newRequestId,
        provider: selectedProvider,
        advancedSettings: selectedProvider.kind === 'custom' ? advancedSettings : undefined,
      } satisfies RagChatWebviewMessage);
    },
    [queryTimeout, selectedProvider, advancedSettings]
  );

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
          <h1 className="rag-chat-title">Generative Search</h1>
          <span className="rag-chat-tagline">
            Retrieve, ground, and generate from selected collections
          </span>
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

      {/* Connection status bar */}
      {connectionId && (
        <div className="rag-connection-bar">
          <span className="rag-connection-indicator" />
          <span className="rag-connection-label">Connected to</span>
          <span className="rag-connection-name">{initialData?.connectionName || connectionId}</span>
        </div>
      )}

      {/* Chat history area */}
      <main className="rag-chat-history" role="log" aria-label="Chat history" aria-live="polite">
        {history.length === 0 && (
          <div className="rag-chat-empty">
            <p>Ask a question about your Weaviate collection data.</p>
            <p>Select one or more collections below and type your question to get started.</p>
          </div>
        )}
        {history.map((entry) => (
          <ChatEntry key={entry.id} entry={entry} showContext={showContext} onRetry={handleRetry} />
        ))}
        <div ref={chatEndRef} />
      </main>

      {/* Input area */}
      <footer className="rag-chat-input-area">
        <CollectionSelector
          allCollections={allCollections}
          collectionInfos={collectionInfos}
          selectedCollections={selectedCollections}
          onAdd={handleAddCollection}
          onRemove={handleRemoveCollection}
          loading={collectionsLoading}
        />
        <ProviderSelector
          availableModules={availableModules}
          selectedProvider={selectedProvider}
          onChange={setSelectedProvider}
        />
        {selectedProvider.kind === 'custom' && (
          <button
            type="button"
            className="rag-advanced-toggle"
            onClick={() => setShowAdvancedSettings((v) => !v)}
            aria-expanded={showAdvancedSettings}
          >
            {showAdvancedSettings ? '▲ Hide Advanced Settings' : '▼ Advanced Settings'}
          </button>
        )}
        {showAdvancedSettings && selectedProvider.kind === 'custom' && (
          <AdvancedRagPanel
            settings={advancedSettings}
            onChange={setAdvancedSettings}
            onSave={handleSaveAdvancedSettings}
          />
        )}
        <RagOptions
          topK={topK}
          timeout={queryTimeout}
          showContext={showContext}
          onTopKChange={setTopK}
          onTimeoutChange={setQueryTimeout}
          onShowContextChange={setShowContext}
        />
        <div className="rag-chat-input-row">
          <textarea
            ref={textareaRef}
            className="rag-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the selected collections…"
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
