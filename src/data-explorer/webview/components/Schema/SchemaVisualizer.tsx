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
    <div
      className="schema-visualizer schema-visualizer-compact"
      role="region"
      aria-label="Schema visualizer"
    >
      {/* Quick stats bar */}
      <div className="schema-stats-bar">
        <span className="stat-badge">{schema.properties.length} properties</span>
        <span className="stat-badge">
          {schema.properties.filter((p) => p.indexFilterable !== false).length} filterable
        </span>
        <span className="stat-badge">
          {schema.properties.filter((p) => p.indexSearchable !== false).length} searchable
        </span>
        {schema.vectorizers && schema.vectorizers.length > 0 && (
          <span className="stat-badge vectorizer">{schema.vectorizers.length} vectorizer(s)</span>
        )}
      </div>

      {/* Vectorizers Section - Collapsible */}
      {schema.vectorizers && schema.vectorizers.length > 0 && (
        <div className="schema-section-compact">
          <button
            className="schema-section-toggle-compact"
            onClick={() => setShowVectorizers(!showVectorizers)}
            type="button"
          >
            <span className={`toggle-chevron ${showVectorizers ? 'expanded' : ''}`}>▶</span>
            <span>Vectorizers</span>
          </button>

          {showVectorizers && (
            <div className="vectorizers-list-compact">
              {schema.vectorizers.map((vectorizer, index) => (
                <div key={index} className="vectorizer-item-compact">
                  <span className="vectorizer-name">{vectorizer.name}</span>
                  <span className="vectorizer-meta">
                    {vectorizer.vectorizer}
                    {vectorizer.dimensions && ` • ${vectorizer.dimensions}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Properties List - Compact */}
      <div className="properties-list-compact">
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
  const hasNestedProperties = property.nestedProperties && property.nestedProperties.length > 0;

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

      {property.description && <div className="property-description">{property.description}</div>}

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
