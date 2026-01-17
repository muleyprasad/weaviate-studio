/**
 * EmptyState - Friendly empty state component with actionable suggestions
 *
 * Shows when no results are found, with context-aware suggestions
 */

import React from 'react';

interface EmptyStateProps {
  type: 'no-results' | 'no-collection' | 'no-vectorizer' | 'error';
  title?: string;
  message?: string;
  suggestions?: string[];
  actions?: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
  }>;
  icon?: string;
}

export function EmptyState({
  type,
  title,
  message,
  suggestions,
  actions,
  icon,
}: EmptyStateProps) {
  // Default content based on type
  const defaults = {
    'no-results': {
      icon: '🔍',
      title: 'No objects match your filters',
      message: 'Try adjusting your search criteria to see results.',
      suggestions: [
        'Remove some filters to widen your search',
        'Check that your filter values are correct',
        'Try different filter operators',
      ],
    },
    'no-collection': {
      icon: '📦',
      title: 'No collection selected',
      message: 'Select a collection from the sidebar to get started.',
      suggestions: ['Choose a collection from the tree view'],
    },
    'no-vectorizer': {
      icon: '🔮',
      title: 'Vector search unavailable',
      message: 'This collection has no vectorizer configured.',
      suggestions: [
        'Configure a vectorizer in your collection schema',
        'Use keyword search or filters instead',
        'Learn more about vectorizers in the documentation',
      ],
    },
    'error': {
      icon: '⚠️',
      title: 'Something went wrong',
      message: 'An error occurred while loading data.',
      suggestions: ['Check your connection to Weaviate', 'Try refreshing the page'],
    },
  };

  const defaultContent = defaults[type];
  const displayIcon = icon || defaultContent.icon;
  const displayTitle = title || defaultContent.title;
  const displayMessage = message || defaultContent.message;
  const displaySuggestions = suggestions || defaultContent.suggestions;

  return (
    <div className="empty-state" role="status">
      <div className="empty-state-content">
        <div className="empty-state-icon" aria-hidden="true">
          {displayIcon}
        </div>
        <h3 className="empty-state-title">{displayTitle}</h3>
        {displayMessage && <p className="empty-state-message">{displayMessage}</p>}

        {displaySuggestions && displaySuggestions.length > 0 && (
          <div className="empty-state-suggestions">
            <p className="suggestions-label">Try this:</p>
            <ul className="suggestions-list">
              {displaySuggestions.map((suggestion, index) => (
                <li key={index} className="suggestion-item">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions && actions.length > 0 && (
          <div className="empty-state-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`empty-state-button ${action.primary ? 'primary' : 'secondary'}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
