/**
 * PropertyView - Property display component for detail panel
 * Renders individual properties with appropriate formatting
 */

import React, { useState, useCallback } from 'react';
import {
  renderCellValue,
  formatAbsoluteTime,
  formatNumber,
  copyToClipboard,
} from '../../utils/typeRenderers';

interface PropertyViewProps {
  name: string;
  value: unknown;
  dataType?: string;
  level?: number;
}

export function PropertyView({ name, value, dataType, level = 0 }: PropertyViewProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showCopied, setShowCopied] = useState(false);

  const cellData = renderCellValue(value, dataType);

  const handleCopy = useCallback(async () => {
    const textToCopy = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
    }
  }, [value]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Render value based on type
  const renderValue = () => {
    if (value === null || value === undefined) {
      return <span className="property-value null">null</span>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <div className="property-value array">
          <button className="expand-toggle" onClick={toggleExpand}>
            {isExpanded ? '▼' : '▶'} [{value.length} items]
          </button>
          {isExpanded && (
            <div className="array-items">
              {value.map((item, index) => (
                <div key={index} className="array-item">
                  <span className="array-index">[{index}]</span>
                  {typeof item === 'object' && item !== null ? (
                    <PropertyView name="" value={item} level={level + 1} />
                  ) : (
                    <span className="array-value">{renderPrimitiveValue(item)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Handle objects
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      return (
        <div className="property-value object">
          <button className="expand-toggle" onClick={toggleExpand}>
            {isExpanded ? '▼' : '▶'} {`{${entries.length} properties}`}
          </button>
          {isExpanded && (
            <div className="object-properties">
              {entries.map(([key, val]) => (
                <PropertyView key={key} name={key} value={val} level={level + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Handle primitives
    return <span className="property-value primitive">{renderPrimitiveValue(value)}</span>;
  };

  const renderPrimitiveValue = (val: unknown): React.ReactNode => {
    if (typeof val === 'boolean') {
      return (
        <span className={`boolean-value ${val ? 'true' : 'false'}`}>
          {val ? '✓ true' : '✗ false'}
        </span>
      );
    }

    if (typeof val === 'number') {
      return <span className="number-value">{formatNumber(val)}</span>;
    }

    if (typeof val === 'string') {
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(val)) {
        return (
          <span className="date-value" title={formatAbsoluteTime(val)}>
            {val}
          </span>
        );
      }

      // Check if it's a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
        return <code className="uuid-value">{val}</code>;
      }

      // Regular string
      return <span className="string-value">"{val}"</span>;
    }

    return String(val);
  };

  return (
    <div className={`property-view level-${level}`}>
      {name && (
        <div className="property-header">
          <span className="property-name">{name}</span>
          <span className="property-type">{cellData.dataType}</span>
          <button
            className="copy-btn"
            onClick={handleCopy}
            title="Copy value"
            aria-label={`Copy ${name} value`}
          >
            {showCopied ? '✓' : '📋'}
          </button>
        </div>
      )}
      <div className="property-content">{renderValue()}</div>
    </div>
  );
}
