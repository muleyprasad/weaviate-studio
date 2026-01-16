/**
 * FilterRule component - individual filter row
 */

import React, { useEffect } from 'react';
import type { Filter, FilterOperator, FilterValue, PropertySchema } from '../../../types';
import { PropertySelector } from './PropertySelector';
import { OperatorSelector } from './OperatorSelector';
import { ValueInput } from './ValueInput';
import { getOperatorsForType, getDefaultValue } from '../../../utils/filterUtils';

interface FilterRuleProps {
  filter: Filter;
  properties: PropertySchema[];
  onChange: (filter: Partial<Filter>) => void;
  onRemove: () => void;
}

export function FilterRule({
  filter,
  properties,
  onChange,
  onRemove,
}: FilterRuleProps) {
  // Get the property schema for the selected property
  const selectedProperty = properties.find((p) => p.name === filter.property);
  const dataType = selectedProperty?.dataType || 'text';

  // Update data type when property changes
  useEffect(() => {
    if (selectedProperty && filter.dataType !== selectedProperty.dataType) {
      const availableOperators = getOperatorsForType(selectedProperty.dataType);
      const defaultOperator = availableOperators[0];
      const defaultValue = getDefaultValue(selectedProperty.dataType);

      onChange({
        dataType: selectedProperty.dataType,
        operator: defaultOperator,
        value: defaultValue,
      });
    }
  }, [filter.property, selectedProperty, filter.dataType, onChange]);

  const handlePropertyChange = (propertyName: string) => {
    const newProperty = properties.find((p) => p.name === propertyName);
    if (newProperty) {
      const availableOperators = getOperatorsForType(newProperty.dataType);
      const defaultOperator = availableOperators[0];
      const defaultValue = getDefaultValue(newProperty.dataType);

      onChange({
        property: propertyName,
        dataType: newProperty.dataType,
        operator: defaultOperator,
        value: defaultValue,
      });
    }
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    onChange({ operator });
  };

  const handleValueChange = (value: FilterValue) => {
    onChange({ value });
  };

  return (
    <div className="filter-rule" role="group" aria-label="Filter rule">
      <PropertySelector
        properties={properties}
        selectedProperty={filter.property}
        onChange={handlePropertyChange}
      />

      {filter.property && (
        <>
          <OperatorSelector
            dataType={dataType}
            selectedOperator={filter.operator}
            onChange={handleOperatorChange}
          />

          <ValueInput
            dataType={dataType}
            operator={filter.operator}
            value={filter.value}
            onChange={handleValueChange}
          />
        </>
      )}

      <button
        className="filter-rule-remove"
        onClick={onRemove}
        aria-label="Remove filter"
        title="Remove filter"
      >
        ✕
      </button>
    </div>
  );
}
