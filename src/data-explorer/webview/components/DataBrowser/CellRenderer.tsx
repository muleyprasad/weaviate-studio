/**
 * CellRenderer - Type-specific cell rendering component
 * Renders values based on their data type with appropriate formatting
 */

import React, { useState, useCallback } from 'react';
import { renderCellValue, copyToClipboard, formatAbsoluteTime } from '../../utils/typeRenderers';

interface CellRendererProps {
  value: unknown;
  dataTypeHint?: string;
  columnName: string;
  onExpand?: (value: unknown) => void;
}

function CellRendererComponent({ value, dataTypeHint, columnName, onExpand }: CellRendererProps) {
  const [showCopied, setShowCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const cellData = renderCellValue(value, dataTypeHint);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const textToCopy =
        typeof cellData.fullValue === 'object'
          ? JSON.stringify(cellData.fullValue, null, 2)
          : String(cellData.fullValue);

      const success = await copyToClipboard(textToCopy);
      if (success) {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 1500);
      }
    },
    [cellData.fullValue]
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onExpand) {
        onExpand(cellData.fullValue);
      } else {
        setExpanded(!expanded);
      }
    },
    [onExpand, cellData.fullValue, expanded]
  );

  // Render based on data type
  switch (cellData.dataType) {
    case 'null':
      return <span className="cell-value cell-null">—</span>;

    case 'boolean':
      return (
        <span
          className={`cell-value cell-boolean ${cellData.fullValue ? 'cell-true' : 'cell-false'}`}
        >
          {cellData.displayValue}
        </span>
      );

    case 'int':
    case 'number':
      return (
        <span className="cell-value cell-number" title={String(cellData.fullValue)}>
          {cellData.displayValue}
        </span>
      );

    case 'uuid':
      return (
        <span className="cell-value cell-uuid">
          <code title={String(cellData.fullValue)}>{cellData.displayValue}</code>
          <button
            className="cell-action-btn copy-btn"
            onClick={handleCopy}
            title="Copy UUID"
            aria-label="Copy UUID"
          >
            {showCopied ? '✓' : '📋'}
          </button>
        </span>
      );

    case 'date':
      return (
        <span
          className="cell-value cell-date"
          title={formatAbsoluteTime(String(cellData.fullValue))}
        >
          {cellData.displayValue}
        </span>
      );

    case 'text':
    case 'string':
      const isLong = cellData.isExpandable;
      return (
        <span
          className={`cell-value cell-text ${isLong ? 'truncated' : ''}`}
          title={String(cellData.fullValue)}
        >
          {cellData.displayValue}
          {isLong && (
            <button
              className="cell-action-btn expand-btn"
              onClick={handleExpandClick}
              title="View full text"
              aria-label="View full text"
            >
              ⋯
            </button>
          )}
        </span>
      );

    case 'geoCoordinates':
      return (
        <span className="cell-value cell-geo" title={JSON.stringify(cellData.fullValue)}>
          {cellData.displayValue}
        </span>
      );

    case 'phoneNumber':
      return (
        <span className="cell-value cell-phone" title={JSON.stringify(cellData.fullValue)}>
          {cellData.displayValue}
        </span>
      );

    case 'object':
      return (
        <span className="cell-value cell-object">
          <span className="cell-badge object-badge" title="Click to expand">
            {cellData.displayValue}
          </span>
          <button
            className="cell-action-btn expand-btn"
            onClick={handleExpandClick}
            title="View object"
            aria-label="View object properties"
          >
            🔍
          </button>
          {expanded && !onExpand && (
            <div className="cell-expanded-content">
              <pre>{JSON.stringify(cellData.fullValue, null, 2)}</pre>
            </div>
          )}
        </span>
      );

    case 'vector':
      return (
        <span className="cell-value cell-vector">
          <span className="cell-badge vector-badge" title="View in detail panel">
            {cellData.displayValue}
          </span>
        </span>
      );

    case 'blob':
      return (
        <span className="cell-value cell-blob" title="Binary data">
          {cellData.displayValue}
        </span>
      );

    default:
      // Handle arrays and other types
      if (cellData.dataType.endsWith('[]')) {
        return (
          <span className="cell-value cell-array">
            <span className="cell-badge array-badge" title="Click to expand">
              {cellData.displayValue}
            </span>
            <button
              className="cell-action-btn expand-btn"
              onClick={handleExpandClick}
              title="View array"
              aria-label="View array items"
            >
              🔍
            </button>
            {expanded && !onExpand && (
              <div className="cell-expanded-content">
                <pre>{JSON.stringify(cellData.fullValue, null, 2)}</pre>
              </div>
            )}
          </span>
        );
      }

      return (
        <span className="cell-value" title={String(cellData.fullValue)}>
          {cellData.displayValue}
        </span>
      );
  }
}

/**
 * Custom comparison function for React.memo
 * Only re-render if value or dataTypeHint changes
 */
function arePropsEqual(prevProps: CellRendererProps, nextProps: CellRendererProps): boolean {
  return (
    prevProps.value === nextProps.value &&
    prevProps.dataTypeHint === nextProps.dataTypeHint &&
    prevProps.columnName === nextProps.columnName &&
    prevProps.onExpand === nextProps.onExpand
  );
}

export const CellRenderer = React.memo(CellRendererComponent, arePropsEqual);
