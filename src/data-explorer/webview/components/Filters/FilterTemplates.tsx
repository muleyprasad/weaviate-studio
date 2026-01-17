/**
 * FilterTemplates - Manage saved filter templates
 */

import React, { useState } from 'react';
import type { FilterTemplate, FilterGroup } from '../../../types';

interface FilterTemplatesProps {
  templates: FilterTemplate[];
  collectionName: string;
  currentGroup: FilterGroup | null;
  onSave: (name: string, description: string) => void;
  onLoad: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}

export function FilterTemplates({
  templates,
  collectionName,
  currentGroup,
  onSave,
  onLoad,
  onDelete,
}: FilterTemplatesProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showTemplateList, setShowTemplateList] = useState(false);

  // Filter templates for current collection
  const collectionTemplates = templates.filter(
    (t) => t.collectionName === collectionName
  );

  const handleSave = () => {
    if (!templateName.trim()) {
      return;
    }

    onSave(templateName, templateDescription);
    setTemplateName('');
    setTemplateDescription('');
    setShowSaveDialog(false);
  };

  const handleDelete = (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      onDelete(templateId);
    }
  };

  const hasCurrentFilters = currentGroup && (
    currentGroup.filters.length > 0 || currentGroup.groups.length > 0
  );

  return (
    <div className="filter-templates">
      {/* Template Actions */}
      <div className="template-actions">
        <button
          className="template-action-button"
          onClick={() => setShowTemplateList(!showTemplateList)}
          disabled={collectionTemplates.length === 0}
        >
          📋 Templates ({collectionTemplates.length})
        </button>
        <button
          className="template-action-button primary"
          onClick={() => setShowSaveDialog(true)}
          disabled={!hasCurrentFilters}
          title={!hasCurrentFilters ? 'Add filters to save a template' : 'Save current filters as template'}
        >
          💾 Save as Template
        </button>
      </div>

      {/* Save Template Dialog */}
      {showSaveDialog && (
        <div className="template-dialog">
          <div className="template-dialog-header">
            <h4>Save Filter Template</h4>
            <button
              className="template-dialog-close"
              onClick={() => setShowSaveDialog(false)}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
          <div className="template-dialog-content">
            <div className="template-form-field">
              <label htmlFor="template-name">Template Name*</label>
              <input
                id="template-name"
                type="text"
                className="template-input"
                placeholder="e.g., Active Users Filter"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="template-form-field">
              <label htmlFor="template-description">Description</label>
              <textarea
                id="template-description"
                className="template-textarea"
                placeholder="Optional description of what this filter does..."
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="template-dialog-actions">
            <button
              className="template-button secondary"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </button>
            <button
              className="template-button primary"
              onClick={handleSave}
              disabled={!templateName.trim()}
            >
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      {showTemplateList && collectionTemplates.length > 0 && (
        <div className="template-list">
          <div className="template-list-header">
            <h4>Saved Templates for {collectionName}</h4>
          </div>
          <div className="template-list-content">
            {collectionTemplates.map((template) => (
              <div key={template.id} className="template-item">
                <div className="template-item-info">
                  <div className="template-item-name">{template.name}</div>
                  {template.description && (
                    <div className="template-item-description">
                      {template.description}
                    </div>
                  )}
                  <div className="template-item-meta">
                    Created: {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="template-item-actions">
                  <button
                    className="template-item-button"
                    onClick={() => {
                      onLoad(template.id);
                      setShowTemplateList(false);
                    }}
                    title="Load this template"
                  >
                    Load
                  </button>
                  <button
                    className="template-item-button danger"
                    onClick={() => handleDelete(template.id)}
                    title="Delete this template"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
