/**
 * QueryTrace — Expandable disclosure panel for Query Agent trace metadata
 *
 * Displays:
 * - Sub-queries run (queries and collections)
 * - Collections touched
 * - Token/model unit usage
 * - Query execution time
 * - Source objects (clickable to open in Data Explorer)
 */

import React from 'react';
import type { RagChatVSCodeAPI, RagChatWebviewMessage } from '../../types';

interface QueryTraceProps {
  rawResponse: unknown;
  expanded: boolean;
  onToggleExpanded: () => void;
  vscodeApi: RagChatVSCodeAPI;
}

export function QueryTrace({
  rawResponse,
  expanded,
  onToggleExpanded,
  vscodeApi,
}: QueryTraceProps) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return (
      <div className="query-trace">
        <button
          type="button"
          className="query-trace-toggle"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <span className="query-trace-chevron">{expanded ? '▼' : '▸'}</span>
          How this was answered
        </button>
        <div className="query-trace-unavailable">(Trace unavailable)</div>
      </div>
    );
  }

  const trace = rawResponse as any;

  return (
    <div className="query-trace">
      <button
        type="button"
        className="query-trace-toggle"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
      >
        <span className="query-trace-chevron">{expanded ? '▼' : '▸'}</span>
        How this was answered
      </button>

      {expanded && (
        <div className="query-trace-content">
          {/* Queries */}
          {trace.searches && Array.isArray(trace.searches) && trace.searches.length > 0 && (
            <div className="query-trace-section">
              <h4 className="query-trace-heading">Queries</h4>
              <ul className="query-trace-list">
                {trace.searches.map((search: any, idx: number) => (
                  <li key={idx}>
                    {search.query && (
                      <>
                        <code className="query-trace-code">{search.query}</code>
                        <span className="query-trace-annotation">{search.collection}</span>
                      </>
                    )}
                    {!search.query && (
                      <span className="query-trace-annotation">
                        Collection: {search.collection}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Collections */}
          {trace.collectionNames && Array.isArray(trace.collectionNames) && (
            <div className="query-trace-section">
              <h4 className="query-trace-heading">Collections</h4>
              <div className="query-trace-pills">
                {trace.collectionNames.map((col: string, idx: number) => (
                  <span key={idx} className="query-trace-pill">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="query-trace-section">
            <h4 className="query-trace-heading">Metadata</h4>
            <div className="query-trace-metadata">
              {trace.totalTime !== undefined && (
                <div className="query-trace-row">
                  <span className="query-trace-label">Execution Time:</span>
                  <span className="query-trace-value">{trace.totalTime}ms</span>
                </div>
              )}
              {trace.usage && (
                <div className="query-trace-row">
                  <span className="query-trace-label">Model Units:</span>
                  <span className="query-trace-value">{trace.usage.modelUnits}</span>
                </div>
              )}
              {trace.isPartialAnswer && (
                <div className="query-trace-row query-trace-warning">
                  <span className="query-trace-label">Status:</span>
                  <span className="query-trace-value">Partial answer</span>
                </div>
              )}
              {trace.missingInformation &&
                Array.isArray(trace.missingInformation) &&
                trace.missingInformation.length > 0 && (
                  <div className="query-trace-row">
                    <span className="query-trace-label">Missing Info:</span>
                    <span className="query-trace-value">{trace.missingInformation.join(', ')}</span>
                  </div>
                )}
            </div>
          </div>

          {/* Sources */}
          {trace.sources && Array.isArray(trace.sources) && trace.sources.length > 0 && (
            <div className="query-trace-section">
              <h4 className="query-trace-heading">Sources</h4>
              <ul className="query-trace-list">
                {trace.sources.map((source: any, idx: number) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className="query-trace-source-link"
                      onClick={() => {
                        if (vscodeApi && source.objectId && source.collection) {
                          vscodeApi.postMessage({
                            command: 'openInDataExplorer',
                            collectionName: source.collection,
                            uuid: source.objectId,
                          } satisfies RagChatWebviewMessage);
                        }
                      }}
                      title={`Open in Data Explorer: ${source.collection}`}
                    >
                      {source.objectId}
                    </button>
                    <span className="query-trace-annotation">{source.collection}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
