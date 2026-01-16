import React from 'react';
import type { CellRendererProps } from '../../../types';

/**
 * Render a cell based on its data type
 */
export function CellRenderer({ value, dataType, propertyName, objectId }: CellRendererProps) {
  if (value === null || value === undefined) {
    return <span className="cell-null">null</span>;
  }

  // Handle array types
  if (dataType.endsWith('[]')) {
    return renderArrayCell(value, dataType);
  }

  // Handle specific types
  switch (dataType) {
    case 'text':
      return renderTextCell(value);

    case 'int':
    case 'number':
      return renderNumberCell(value);

    case 'boolean':
      return renderBooleanCell(value);

    case 'date':
      return renderDateCell(value);

    case 'uuid':
      return renderUuidCell(value);

    case 'geoCoordinates':
      return renderGeoCell(value);

    case 'phoneNumber':
      return renderPhoneCell(value);

    case 'blob':
      return renderBlobCell(value);

    case 'object':
      return renderObjectCell(value);

    default:
      return renderDefaultCell(value);
  }
}

/**
 * Render text cell with truncation
 */
function renderTextCell(value: string) {
  const maxLength = 100;
  const displayValue = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;

  return (
    <span className="cell-text" title={value}>
      {displayValue}
    </span>
  );
}

/**
 * Render number cell with formatting
 */
function renderNumberCell(value: number) {
  const formatted = typeof value === 'number' ? value.toLocaleString() : value;

  return <span className="cell-number">{formatted}</span>;
}

/**
 * Render boolean cell with icon
 */
function renderBooleanCell(value: boolean) {
  return (
    <span className={`cell-boolean ${value ? 'true' : 'false'}`}>
      {value ? '✓' : '✗'}
    </span>
  );
}

/**
 * Render date cell with relative time
 */
function renderDateCell(value: string | number) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relativeTime: string;
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      relativeTime = diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`;
    } else {
      relativeTime = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
  } else if (diffDays === 1) {
    relativeTime = 'yesterday';
  } else if (diffDays < 7) {
    relativeTime = `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relativeTime = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relativeTime = months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    relativeTime = years === 1 ? '1 year ago' : `${years} years ago`;
  }

  const absoluteTime = date.toLocaleString();

  return (
    <span className="cell-date" title={absoluteTime}>
      {relativeTime}
    </span>
  );
}

/**
 * Render UUID cell with shortened display
 */
function renderUuidCell(value: string) {
  const shortened = value.length > 13 ? value.substring(0, 8) + '...' + value.substring(value.length - 4) : value;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <span className="cell-uuid" title={value}>
      {shortened}
      <button
        className="copy-button"
        onClick={copyToClipboard}
        aria-label="Copy UUID"
        title="Copy UUID"
      >
        📋
      </button>
    </span>
  );
}

/**
 * Render geo coordinates cell
 */
function renderGeoCell(value: any) {
  if (value && typeof value === 'object' && 'latitude' in value && 'longitude' in value) {
    return (
      <span className="cell-geo" title={`${value.latitude}, ${value.longitude}`}>
        📍 {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
      </span>
    );
  }
  return renderDefaultCell(value);
}

/**
 * Render phone number cell
 */
function renderPhoneCell(value: any) {
  if (value && typeof value === 'object' && 'input' in value) {
    return <span className="cell-phone">📞 {value.input}</span>;
  }
  return <span className="cell-phone">📞 {String(value)}</span>;
}

/**
 * Render blob cell
 */
function renderBlobCell(value: any) {
  const size = value?.length || 0;
  const sizeFormatted = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} bytes`;

  return (
    <span className="cell-blob" title={`Size: ${sizeFormatted}`}>
      📄 Blob ({sizeFormatted})
    </span>
  );
}

/**
 * Render object cell with field count
 */
function renderObjectCell(value: any) {
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    const count = keys.length;
    const preview = keys.slice(0, 2).join(', ');

    return (
      <span className="cell-object" title={JSON.stringify(value, null, 2)}>
        {`{ ${count} field${count !== 1 ? 's' : ''} }`}
        {preview && <span className="object-preview"> ({preview}...)</span>}
      </span>
    );
  }
  return renderDefaultCell(value);
}

/**
 * Render array cell with item count
 */
function renderArrayCell(value: any, dataType: string) {
  if (Array.isArray(value)) {
    const count = value.length;
    const preview = value.slice(0, 3).map(String).join(', ');

    return (
      <span className="cell-array" title={JSON.stringify(value)}>
        [{count} item{count !== 1 ? 's' : ''}]
        {preview && <span className="array-preview"> ({preview}...)</span>}
      </span>
    );
  }
  return renderDefaultCell(value);
}

/**
 * Render default cell (fallback)
 */
function renderDefaultCell(value: any) {
  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const truncated = displayValue.length > 100 ? displayValue.substring(0, 100) + '...' : displayValue;

  return (
    <span className="cell-default" title={displayValue}>
      {truncated}
    </span>
  );
}
