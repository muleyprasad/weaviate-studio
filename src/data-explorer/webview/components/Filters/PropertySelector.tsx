/**
 * PropertySelector component for choosing a property to filter on
 */

import React from 'react';
import type { PropertySchema } from '../../../types';

interface PropertySelectorProps {
  properties: PropertySchema[];
  selectedProperty: string;
  onChange: (propertyName: string) => void;
  disabled?: boolean;
}

export function PropertySelector({
  properties,
  selectedProperty,
  onChange,
  disabled = false,
}: PropertySelectorProps) {
  // Filter out only filterable properties
  const filterableProperties = properties.filter(
    (prop) => prop.indexFilterable !== false
  );

  return (
    <select
      className="property-selector"
      value={selectedProperty}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Select property to filter"
    >
      <option value="">Select property...</option>
      {filterableProperties.map((prop) => (
        <option key={prop.name} value={prop.name}>
          {prop.name} ({prop.dataType})
        </option>
      ))}
    </select>
  );
}
