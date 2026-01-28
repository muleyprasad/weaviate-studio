/**
 * DetailPanel - Slide-out panel for viewing object details
 * Shows full object data with all properties and metadata
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { PropertyView } from './PropertyView';
import { useDataState } from '../../context';
import { copyToClipboard, formatAbsoluteTime, formatRelativeTime } from '../../utils/typeRenderers';
import type { WeaviateObject } from '../../../types';

interface DetailPanelProps {
  object: WeaviateObject | null;
  onClose: () => void;
  onFindSimilar?: (uuid: string) => void;
}

export const DetailPanel = React.memo(function DetailPanel({
  object,
  onClose,
  onFindSimilar,
}: DetailPanelProps) {
  const dataState = useDataState();
  const panelRef = useRef<HTMLDivElement>(null);
  const [showCopiedUuid, setShowCopiedUuid] = React.useState(false);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    if (object && panelRef.current) {
      panelRef.current.focus();
    }
  }, [object]);

  const handleCopyUuid = useCallback(async () => {
    if (!object) {
      return;
    }

    const success = await copyToClipboard(object.uuid);
    if (success) {
      setShowCopiedUuid(true);
      setTimeout(() => setShowCopiedUuid(false), 1500);
    }
  }, [object]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleFindSimilar = useCallback(() => {
    if (object && onFindSimilar) {
      onFindSimilar(object.uuid);
    }
  }, [object, onFindSimilar]);

  if (!object) {
    return null;
  }

  // Get property entries
  const propertyEntries = Object.entries(object.properties || {});

  // Get data type hints from schema
  const getDataType = (propName: string): string | undefined => {
    const prop = dataState.schema?.properties?.find((p) => p.name === propName);
    return prop?.dataType?.[0];
  };

  // Format metadata times
  const createdAt = object.metadata?.creationTime || object.metadata?.creationTimeUnix;
  const updatedAt = object.metadata?.lastUpdateTime || object.metadata?.lastUpdateTimeUnix;

  return (
    <div
      className="detail-panel-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Object details"
    >
      <div className="detail-panel" ref={panelRef} tabIndex={-1} role="document">
        {/* Header */}
        <div className="detail-panel-header">
          <h2>Object Details</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            title="Close panel"
            aria-label="Close details panel"
          >
            <span className="codicon codicon-close" aria-hidden="true"></span>
          </button>
        </div>

        {/* UUID section */}
        <div className="detail-section uuid-section">
          <div className="uuid-display">
            <label>UUID</label>
            <code className="uuid-value">{object.uuid}</code>
            <button
              type="button"
              className="copy-uuid-btn"
              onClick={handleCopyUuid}
              title="Copy UUID"
              aria-label="Copy UUID to clipboard"
            >
              {showCopiedUuid ? (
                <>
                  <span className="codicon codicon-check" aria-hidden="true"></span>
                  Copied
                </>
              ) : (
                <>
                  <span className="codicon codicon-copy" aria-hidden="true"></span>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metadata section */}
        <div className="detail-section metadata-section">
          <h3>Metadata</h3>
          <div className="metadata-grid">
            {createdAt && (
              <div className="metadata-item">
                <label>Created</label>
                <span title={formatAbsoluteTime(createdAt)}>{formatRelativeTime(createdAt)}</span>
              </div>
            )}
            {updatedAt && (
              <div className="metadata-item">
                <label>Updated</label>
                <span title={formatAbsoluteTime(updatedAt)}>{formatRelativeTime(updatedAt)}</span>
              </div>
            )}
            {object.metadata?.distance !== undefined && (
              <div className="metadata-item">
                <label>Distance</label>
                <span>{object.metadata.distance.toFixed(4)}</span>
              </div>
            )}
            {object.metadata?.certainty !== undefined && (
              <div className="metadata-item">
                <label>Certainty</label>
                <span>{(object.metadata.certainty * 100).toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Properties section */}
        <div className="detail-section properties-section">
          <h3>Properties ({propertyEntries.length})</h3>
          <div className="properties-list">
            {propertyEntries.length === 0 ? (
              <div className="no-properties">No properties</div>
            ) : (
              propertyEntries.map(([name, value]) => (
                <PropertyView key={name} name={name} value={value} dataType={getDataType(name)} />
              ))
            )}
          </div>
        </div>

        {/* Vector section */}
        {(object.vector || object.vectors) && (
          <div className="detail-section vector-section">
            <h3>Vectors</h3>
            {object.vector && (
              <div className="vector-display">
                <div className="vector-header">
                  <span className="vector-name">default</span>
                  <span className="vector-dims">[{object.vector.length} dimensions]</span>
                </div>
                <div className="vector-preview">
                  <code>
                    [
                    {object.vector
                      .slice(0, 5)
                      .map((v) => v.toFixed(4))
                      .join(', ')}
                    {object.vector.length > 5 && `, ... (${object.vector.length - 5} more)`}]
                  </code>
                </div>
              </div>
            )}
            {object.vectors &&
              Object.entries(object.vectors).map(([name, vector]) => (
                <div key={name} className="vector-display">
                  <div className="vector-header">
                    <span className="vector-name">{name}</span>
                    <span className="vector-dims">[{vector.length} dimensions]</span>
                  </div>
                  <div className="vector-preview">
                    <code>
                      [
                      {vector
                        .slice(0, 5)
                        .map((v) => (typeof v === 'number' ? v.toFixed(4) : String(v)))
                        .join(', ')}
                      {vector.length > 5 && `, ... (${vector.length - 5} more)`}]
                    </code>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="detail-panel-actions">
          {onFindSimilar && (
            <button
              className="action-btn primary"
              onClick={handleFindSimilar}
              title="Find objects similar to this one"
            >
              <span className="codicon codicon-search" aria-hidden="true"></span>
              Find Similar
            </button>
          )}
          <button className="action-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
