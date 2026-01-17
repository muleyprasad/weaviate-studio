/**
 * SchemaVisualizer - Visual representation of collection schema
 */

import React, { useState } from 'react';
import type { CollectionSchema, PropertySchema, PropertyDataType } from '../../../types';

interface SchemaVisualizerProps {
  schema: CollectionSchema;
}

export function SchemaVisualizer({ schema }: SchemaVisualizerProps) {
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  const [showVectorizers, setShowVectorizers] = useState(false);

  const toggleProperty = (propertyName: string) => {
    const newExpanded = new Set(expandedProperties);
    if (newExpanded.has(propertyName)) {
      newExpanded.delete(propertyName);
    } else {
      newExpanded.add(propertyName);
    }
    setExpandedProperties(newExpanded);
  };

  return (
    <div className="schema-visualizer" role="region" aria-label="Schema visualizer">
      <div className="schema-header">
        <h3 className="schema-title">📋 Collection Schema</h3>
        <div className="schema-meta">
          <span className="schema-name">{schema.name}</span>
          {schema.description && (
            <span className="schema-description">{schema.description}</span>
          )}
        </div>
      </div>

      {/* Vectorizers Section */}
      {schema.vectorizers && schema.vectorizers.length > 0 && (
        <div className="schema-section">
          <button
            className="schema-section-toggle"
            onClick={() => setShowVectorizers(!showVectorizers)}
          >
            <span className={`toggle-icon ${showVectorizers ? 'expanded' : ''}`}>▶</span>
            <span className="section-title">
              Vectorizers ({schema.vectorizers.length})
            </span>
          </button>

          {showVectorizers && (
            <div className="vectorizers-list">
              {schema.vectorizers.map((vectorizer, index) => (
                <div key={index} className="vectorizer-item">
                  <div className="vectorizer-name">{vectorizer.name}</div>
                  <div className="vectorizer-details">
                    <span className="vectorizer-type">{vectorizer.vectorizer}</span>
                    {vectorizer.dimensions && (
                      <span className="vectorizer-dimensions">
                        {vectorizer.dimensions} dimensions
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Properties Section */}
      <div className="schema-section">
        <div className="section-header">
          <span className="section-title">
            Properties ({schema.properties.length})
          </span>
        </div>

        <div className="properties-list">
          {schema.properties.map((property) => (
            <PropertyItem
              key={property.name}
              property={property}
              expanded={expandedProperties.has(property.name)}
              onToggle={() => toggleProperty(property.name)}
            />
          ))}
        </div>
      </div>

      {/* Schema Summary */}
      <div className="schema-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total Properties:</span>
            <span className="stat-value">{schema.properties.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Filterable:</span>
            <span className="stat-value">
              {schema.properties.filter((p) => p.indexFilterable !== false).length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Searchable:</span>
            <span className="stat-value">
              {schema.properties.filter((p) => p.indexSearchable !== false).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual property item component
 */
interface PropertyItemProps {
  property: PropertySchema;
  expanded: boolean;
  onToggle: () => void;
  depth?: number;
}

function PropertyItem({ property, expanded, onToggle, depth = 0 }: PropertyItemProps) {
  const hasNestedProperties =
    property.nestedProperties && property.nestedProperties.length > 0;

  return (
    <div className="property-item" style={{ marginLeft: `${depth * 20}px` }}>
      <div className="property-header" onClick={onToggle}>
        {hasNestedProperties && (
          <span className={`property-toggle ${expanded ? 'expanded' : ''}`}>▶</span>
        )}
        <span className="property-name">{property.name}</span>
        <span className={`property-type type-${getTypeCategory(property.dataType)}`}>
          {property.dataType}
        </span>
        <div className="property-badges">
          {property.indexFilterable !== false && (
            <span className="property-badge filterable" title="Filterable">
              F
            </span>
          )}
          {property.indexSearchable !== false && (
            <span className="property-badge searchable" title="Searchable">
              S
            </span>
          )}
          {property.tokenization && (
            <span
              className="property-badge tokenization"
              title={`Tokenization: ${property.tokenization}`}
            >
              T
            </span>
          )}
        </div>
      </div>

      {property.description && (
        <div className="property-description">{property.description}</div>
      )}

      {/* Nested properties */}
      {hasNestedProperties && expanded && (
        <div className="property-nested">
          {property.nestedProperties!.map((nestedProp) => (
            <PropertyItem
              key={nestedProp.name}
              property={nestedProp}
              expanded={false}
              onToggle={() => {}}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Get type category for styling
 */
function getTypeCategory(dataType: PropertyDataType): string {
  if (dataType.includes('text')) return 'text';
  if (dataType.includes('int') || dataType.includes('number')) return 'number';
  if (dataType.includes('boolean')) return 'boolean';
  if (dataType.includes('date')) return 'date';
  if (dataType.includes('uuid')) return 'uuid';
  if (dataType.includes('geo')) return 'geo';
  if (dataType.includes('object')) return 'object';
  return 'other';
}
