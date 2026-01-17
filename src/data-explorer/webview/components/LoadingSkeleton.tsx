/**
 * LoadingSkeleton - Reusable skeleton components for loading states
 *
 * Provides realistic loading placeholders for different component types
 */

import React from 'react';

/**
 * Generic skeleton line
 */
interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export function SkeletonLine({ width = '100%', height = '16px', className = '' }: SkeletonLineProps) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * Table skeleton for DataTable
 */
export function TableSkeleton({ rows = 10, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table" role="status" aria-label="Loading data">
      {/* Header row */}
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="skeleton-table-header-cell">
            <SkeletonLine width="80%" height="14px" />
          </div>
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="skeleton-table-cell">
              <SkeletonLine
                width={colIndex === 0 ? '60%' : `${60 + Math.random() * 30}%`}
                height="12px"
              />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data, please wait...</span>
    </div>
  );
}

/**
 * Filter builder skeleton
 */
export function FilterBuilderSkeleton() {
  return (
    <div className="skeleton-filter-builder" role="status" aria-label="Loading filters">
      <div className="skeleton-filter-header">
        <SkeletonLine width="120px" height="16px" />
        <SkeletonLine width="80px" height="32px" />
      </div>

      {/* Filter rules */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={`filter-${i}`} className="skeleton-filter-rule">
          <SkeletonLine width="150px" height="32px" />
          <SkeletonLine width="120px" height="32px" />
          <SkeletonLine width="180px" height="32px" />
          <SkeletonLine width="32px" height="32px" />
        </div>
      ))}

      <div className="skeleton-filter-actions">
        <SkeletonLine width="100px" height="32px" />
        <SkeletonLine width="100px" height="32px" />
      </div>
      <span className="sr-only">Loading filter builder...</span>
    </div>
  );
}

/**
 * Insights panel skeleton
 */
export function InsightsSkeleton() {
  return (
    <div className="skeleton-insights" role="status" aria-label="Loading insights">
      <div className="skeleton-insights-header">
        <SkeletonLine width="200px" height="20px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonLine width="80px" height="32px" />
          <SkeletonLine width="80px" height="32px" />
        </div>
      </div>

      <div className="skeleton-insights-total">
        <SkeletonLine width="150px" height="14px" />
      </div>

      {/* Categorical cards */}
      <div className="skeleton-insights-grid">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`cat-${i}`} className="skeleton-insights-card">
            <SkeletonLine width="100px" height="14px" />
            <div style={{ marginTop: '12px' }}>
              {Array.from({ length: 5 }).map((_, j) => (
                <div
                  key={`item-${j}`}
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <SkeletonLine width="60%" height="12px" />
                  <SkeletonLine width="30%" height="12px" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Numeric stats */}
      <div className="skeleton-insights-card">
        <SkeletonLine width="150px" height="14px" />
        <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={`stat-${i}`} width="80px" height="32px" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading collection insights...</span>
    </div>
  );
}

/**
 * Schema visualizer skeleton
 */
export function SchemaSkeleton() {
  return (
    <div className="skeleton-schema" role="status" aria-label="Loading schema">
      <div className="skeleton-schema-header">
        <SkeletonLine width="180px" height="18px" />
        <SkeletonLine width="250px" height="14px" />
      </div>

      {/* Property list */}
      <div className="skeleton-schema-properties">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`prop-${i}`} className="skeleton-schema-property">
            <SkeletonLine width="40%" height="14px" />
            <SkeletonLine width="80px" height="20px" />
            <div style={{ display: 'flex', gap: '4px' }}>
              <SkeletonLine width="18px" height="18px" />
              <SkeletonLine width="18px" height="18px" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading schema...</span>
    </div>
  );
}

/**
 * Object detail panel skeleton
 */
export function ObjectDetailSkeleton() {
  return (
    <div className="skeleton-object-detail" role="status" aria-label="Loading object details">
      <div className="skeleton-object-detail-header">
        <SkeletonLine width="250px" height="16px" />
        <SkeletonLine width="32px" height="32px" />
      </div>

      <div className="skeleton-object-detail-uuid">
        <SkeletonLine width="100%" height="14px" />
      </div>

      <div className="skeleton-object-detail-tabs">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={`tab-${i}`} width="80px" height="32px" />
        ))}
      </div>

      <div className="skeleton-object-detail-content">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`prop-${i}`} className="skeleton-object-detail-property">
            <SkeletonLine width="120px" height="14px" />
            <SkeletonLine width="80%" height="16px" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading object details...</span>
    </div>
  );
}

/**
 * Vector search panel skeleton
 */
export function VectorSearchSkeleton() {
  return (
    <div className="skeleton-vector-search" role="status" aria-label="Loading vector search">
      <div className="skeleton-vector-search-header">
        <SkeletonLine width="150px" height="18px" />
      </div>

      <div className="skeleton-vector-search-mode">
        <SkeletonLine width="100px" height="14px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonLine width="80px" height="32px" />
          <SkeletonLine width="80px" height="32px" />
          <SkeletonLine width="80px" height="32px" />
        </div>
      </div>

      <div className="skeleton-vector-search-input">
        <SkeletonLine width="100%" height="40px" />
      </div>

      <div className="skeleton-vector-search-config">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`config-${i}`} style={{ marginBottom: '12px' }}>
            <SkeletonLine width="100px" height="14px" />
            <SkeletonLine width="200px" height="32px" />
          </div>
        ))}
      </div>

      <div className="skeleton-vector-search-actions">
        <SkeletonLine width="120px" height="36px" />
        <SkeletonLine width="80px" height="36px" />
      </div>
      <span className="sr-only">Loading vector search...</span>
    </div>
  );
}
