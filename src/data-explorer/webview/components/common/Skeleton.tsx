/**
 * Skeleton - Loading skeleton components for smooth loading states
 * Provides visual feedback during data loading
 */

import React from 'react';

interface SkeletonRowProps {
  columns: number;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ columns }) => (
  <div className="skeleton-row">
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="skeleton-cell">
        <div className="skeleton-shimmer" />
      </div>
    ))}
  </div>
);

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 10, columns = 5 }) => (
  <div className="skeleton-table" role="status" aria-label="Loading data">
    <div className="skeleton-header">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="skeleton-header-cell">
          <div className="skeleton-shimmer" />
        </div>
      ))}
    </div>
    <div className="skeleton-body">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
    <span className="sr-only">Loading table data...</span>
  </div>
);

interface SkeletonTextProps {
  width?: string;
  height?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ width = '100%', height = '16px' }) => (
  <div
    className="skeleton-text skeleton-shimmer"
    style={{ width, height }}
    role="status"
    aria-hidden="true"
  />
);

interface SkeletonCardProps {
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ lines = 3 }) => (
  <div className="skeleton-card" role="status" aria-label="Loading content">
    <div className="skeleton-card-header">
      <div className="skeleton-avatar skeleton-shimmer" />
      <div className="skeleton-title skeleton-shimmer" />
    </div>
    <div className="skeleton-card-body">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line skeleton-shimmer"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  </div>
);

export const SkeletonResultCard: React.FC = () => (
  <div className="skeleton-result-card" role="status" aria-label="Loading result">
    <div className="skeleton-result-rank skeleton-shimmer" />
    <div className="skeleton-result-content">
      <div className="skeleton-result-title skeleton-shimmer" />
      <div className="skeleton-result-meta skeleton-shimmer" />
      <div className="skeleton-result-preview skeleton-shimmer" />
    </div>
  </div>
);
