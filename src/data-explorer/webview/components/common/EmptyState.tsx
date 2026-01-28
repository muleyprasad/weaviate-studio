/**
 * EmptyState - Reusable empty state component
 * Shows informative messages when there's no data
 */

import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact' | 'large';
}

export function EmptyState({
  icon = 'codicon-inbox',
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state-${variant}`} role="status">
      <div className="empty-state-icon">
        <span className={`codicon ${icon}`} aria-hidden="true"></span>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {(action || secondaryAction) && (
        <div className="empty-state-actions">
          {action && (
            <button type="button" className="empty-state-btn primary" onClick={action.onClick}>
              {action.icon && <span className={`codicon ${action.icon}`} aria-hidden="true"></span>}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="empty-state-btn secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */
export function NoObjectsEmptyState({
  onRefresh,
  hasFilters,
  onClearFilters,
}: {
  onRefresh?: () => void;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}) {
  if (hasFilters) {
    return (
      <EmptyState
        icon="codicon-filter"
        title="No Matching Objects"
        description="No objects match your current filters. Try adjusting or clearing the filters."
        action={
          onClearFilters
            ? {
                label: 'Clear Filters',
                onClick: onClearFilters,
                icon: 'codicon-clear-all',
              }
            : undefined
        }
        secondaryAction={
          onRefresh
            ? {
                label: 'Refresh Data',
                onClick: onRefresh,
              }
            : undefined
        }
      />
    );
  }

  return (
    <EmptyState
      icon="codicon-database"
      title="No Objects Found"
      description="This collection is empty. Import data to get started."
      action={
        onRefresh
          ? {
              label: 'Refresh Data',
              onClick: onRefresh,
              icon: 'codicon-refresh',
            }
          : undefined
      }
    />
  );
}

export function NoSearchResultsEmptyState({
  onClearSearch,
  searchMode,
}: {
  onClearSearch?: () => void;
  searchMode?: string;
}) {
  return (
    <EmptyState
      icon="codicon-search"
      title="No Results Found"
      description={`No objects match your ${searchMode || 'vector'} search query. Try adjusting your search parameters.`}
      action={
        onClearSearch
          ? {
              label: 'Clear Search',
              onClick: onClearSearch,
              icon: 'codicon-clear-all',
            }
          : undefined
      }
      variant="compact"
    />
  );
}

export default EmptyState;
