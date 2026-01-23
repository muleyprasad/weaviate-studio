/**
 * DateRangeDisplay - Displays date range for date properties
 * Shows earliest and latest dates
 */

import React from 'react';
import type { PropertyDateRange } from '../../../types';

export interface DateRangeDisplayProps {
  data: PropertyDateRange;
}

/**
 * Formats an ISO date string to a user-friendly format
 */
function formatDate(isoString: string): string {
  if (!isoString || isoString === 'N/A') return 'N/A';

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Calculates the duration between two dates in a human-readable format
 */
function calculateDuration(earliest: string, latest: string): string {
  if (!earliest || !latest || earliest === 'N/A' || latest === 'N/A') return '';

  try {
    const startDate = new Date(earliest);
    const endDate = new Date(latest);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return '< 1 day';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    if (remainingMonths === 0) {
      return years === 1 ? '1 year' : `${years} years`;
    }
    return `${years}y ${remainingMonths}m`;
  } catch {
    return '';
  }
}

export function DateRangeDisplay({ data }: DateRangeDisplayProps) {
  const duration = calculateDuration(data.earliest, data.latest);

  return (
    <div className="date-range">
      <h4 className="property-name">
        <span className="codicon codicon-calendar" aria-hidden="true"></span>
        {data.property}
        {duration && <span className="property-badge">{duration}</span>}
      </h4>
      <div className="date-range-values">
        <div className="date-item">
          <span className="date-label">First</span>
          <span className="date-value">{formatDate(data.earliest)}</span>
        </div>
        <div className="date-separator">
          <span className="codicon codicon-arrow-right" aria-hidden="true"></span>
        </div>
        <div className="date-item">
          <span className="date-label">Latest</span>
          <span className="date-value">{formatDate(data.latest)}</span>
        </div>
      </div>
    </div>
  );
}

export default DateRangeDisplay;
