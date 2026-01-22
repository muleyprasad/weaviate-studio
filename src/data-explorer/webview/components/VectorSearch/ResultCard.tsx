/**
 * ResultCard - Individual search result display
 * Shows match percentage, object preview, distance, and actions
 */

import React, { useMemo } from 'react';
import type { WeaviateObject } from '../../../types';

interface ResultCardProps {
  object: WeaviateObject;
  distance: number;
  certainty: number;
  onView: () => void;
  onFindSimilar: () => void;
  rank: number;
}

export function ResultCard({
  object,
  distance,
  certainty,
  onView,
  onFindSimilar,
  rank,
}: ResultCardProps) {
  // Get display title from object
  const title = useMemo(() => {
    const props = object.properties;
    // Try common title fields
    const titleFields = ['title', 'name', 'headline', 'subject', 'label'];
    for (const field of titleFields) {
      if (props[field] && typeof props[field] === 'string') {
        return props[field] as string;
      }
    }
    // Fallback to first text property
    for (const [key, val] of Object.entries(props)) {
      if (typeof val === 'string' && val.length > 0 && val.length < 100) {
        return val;
      }
    }
    return object.uuid;
  }, [object]);

  // Get a subtitle/description if available
  const subtitle = useMemo(() => {
    const props = object.properties;
    const subtitleFields = ['description', 'summary', 'content', 'text', 'body'];
    for (const field of subtitleFields) {
      if (props[field] && typeof props[field] === 'string' && props[field] !== title) {
        const text = props[field] as string;
        return text.length > 120 ? text.substring(0, 120) + '...' : text;
      }
    }
    return null;
  }, [object, title]);

  // Calculate match percentage from certainty (0-1 scale)
  const matchPercentage = Math.round((certainty ?? 1 - distance / 2) * 100);

  // Get color class based on match percentage
  const getMatchClass = () => {
    if (matchPercentage >= 90) return 'excellent';
    if (matchPercentage >= 75) return 'good';
    if (matchPercentage >= 50) return 'moderate';
    return 'low';
  };

  return (
    <article
      className={`result-card ${getMatchClass()}`}
      aria-label={`Search result ${rank}: ${title}`}
    >
      <div className="result-rank">
        <span className="rank-number">{rank}</span>
      </div>

      <div className="result-match">
        <span className={`match-percentage ${getMatchClass()}`}>{matchPercentage}%</span>
        <span className="match-label">Match</span>
      </div>

      <div className="result-content">
        <h4 className="result-title">{title}</h4>
        {subtitle && <p className="result-subtitle">{subtitle}</p>}
        <div className="result-meta">
          <span className="result-distance">
            Distance: <code>{distance.toFixed(4)}</code>
          </span>
          <span className="result-uuid">
            <code>{object.uuid.substring(0, 8)}...</code>
          </span>
        </div>
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="result-action-btn view-btn"
          onClick={onView}
          title="View full object details"
        >
          <span className="codicon codicon-eye" aria-hidden="true"></span>
          View
        </button>
        <button
          type="button"
          className="result-action-btn similar-btn"
          onClick={onFindSimilar}
          title="Find objects similar to this one"
        >
          <span className="codicon codicon-search" aria-hidden="true"></span>
          Find Similar
        </button>
      </div>
    </article>
  );
}
