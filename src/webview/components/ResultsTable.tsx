import React, { useMemo } from 'react';

interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

interface ResultsTableProps {
  data: any;
  collectionName?: string;
  queryText?: string; // Keep for potential future use
}

/**
 * Utility to flatten nested objects for table display
 */
function flattenObject(obj: any, prefix = '', maxDepth = 3, currentDepth = 0): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  if (currentDepth >= maxDepth || obj === null || obj === undefined) {
    return { [prefix || 'value']: obj };
  }
  
  if (typeof obj !== 'object') {
    return { [prefix || 'value']: obj };
  }
  
  if (Array.isArray(obj)) {
    // For arrays, show count and first few items
    flattened[prefix || 'array'] = `[${obj.length} items]`;
    obj.slice(0, 3).forEach((item, index) => {
      const itemKey = prefix ? `${prefix}[${index}]` : `[${index}]`;
      if (typeof item === 'object' && item !== null) {
        Object.assign(flattened, flattenObject(item, itemKey, maxDepth, currentDepth + 1));
      } else {
        flattened[itemKey] = item;
      }
    });
    return flattened;
  }
  
  // Handle objects
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      flattened[newKey] = value;
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          flattened[newKey] = '[]';
        } else if (value.length <= 3 && value.every(item => typeof item !== 'object')) {
          // Simple array of primitives
          flattened[newKey] = value.join(', ');
        } else {
          flattened[newKey] = `[${value.length} items]`;
          // Flatten first item if it's an object
          if (value[0] && typeof value[0] === 'object') {
            Object.assign(flattened, flattenObject(value[0], `${newKey}[0]`, maxDepth, currentDepth + 1));
          }
        }
      } else {
        // Nested object
        Object.assign(flattened, flattenObject(value, newKey, maxDepth, currentDepth + 1));
      }
    } else {
      flattened[newKey] = value;
    }
  });
  
  return flattened;
}

/**
 * Extract data rows from Weaviate GraphQL response
 */
function extractDataRows(data: any): any[] {
  if (!data || typeof data !== 'object') {
    return [];
  }
  
  // Handle Weaviate GraphQL response structure
  if (data.Get) {
    // Find the first collection in the Get response
    const collections = Object.keys(data.Get);
    if (collections.length > 0) {
      const collectionData = data.Get[collections[0]];
      if (Array.isArray(collectionData)) {
        return collectionData;
      }
    }
  }
  
  // Handle Aggregate responses
  if (data.Aggregate) {
    const collections = Object.keys(data.Aggregate);
    if (collections.length > 0) {
      const aggregateData = data.Aggregate[collections[0]];
      return Array.isArray(aggregateData) ? aggregateData : [aggregateData];
    }
  }
  
  // Handle direct array
  if (Array.isArray(data)) {
    return data;
  }
  
  // Handle single object
  return [data];
}

/**
 * Generate table columns from data
 */
function generateColumns(rows: any[]): TableColumn[] {
  if (rows.length === 0) {
    return [];
  }
  
  // Flatten all rows to get all possible columns
  const allFlattened = rows.map(row => flattenObject(row));
  const allKeys = new Set<string>();
  
  allFlattened.forEach(flattened => {
    Object.keys(flattened).forEach(key => allKeys.add(key));
  });
  
  // Sort columns: _additional fields first, then alphabetically
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    const aIsAdditional = a.startsWith('_additional');
    const bIsAdditional = b.startsWith('_additional');
    
    if (aIsAdditional && !bIsAdditional) return -1;
    if (!aIsAdditional && bIsAdditional) return 1;
    
    return a.localeCompare(b);
  });
  
  return sortedKeys.map(key => {
    // Determine type based on sample values
    const sampleValues = allFlattened
      .map(row => row[key])
      .filter(val => val !== null && val !== undefined)
      .slice(0, 5);
    
    let type: TableColumn['type'] = 'string';
    if (sampleValues.length > 0) {
      if (sampleValues.every(val => typeof val === 'number')) {
        type = 'number';
      } else if (sampleValues.every(val => typeof val === 'boolean')) {
        type = 'boolean';
      } else if (sampleValues.some(val => typeof val === 'object')) {
        type = 'object';
      }
    }
    
    return {
      key,
      label: key.replace(/\./g, ' › ').replace(/_/g, ' '),
      type
    };
  });
}

/**
 * Format cell value for display
 */
function formatCellValue(value: any, type: TableColumn['type']): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (type === 'object' && typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (type === 'number') {
    return typeof value === 'number' ? value.toLocaleString() : String(value);
  }
  
  return String(value);
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data, collectionName, queryText }) => {
  const { rows, columns } = useMemo(() => {
    const extractedRows = extractDataRows(data);
    const generatedColumns = generateColumns(extractedRows);
    
    return {
      rows: extractedRows,
      columns: generatedColumns
    };
  }, [data, collectionName, queryText]);
  
  if (rows.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: 'var(--vscode-descriptionForeground, #666)',
        textAlign: 'center'
      }}>
        <p>No data to display</p>
        {collectionName && (
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Try running a query for collection: {collectionName}
          </p>
        )}
      </div>
    );
  }
  
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    backgroundColor: 'var(--vscode-editor-background, #252526)',
    color: 'var(--vscode-editor-foreground, #D4D4D4)'
  };
  
  // Improved header styling with better theme colors
  const headerStyle: React.CSSProperties = {
    backgroundColor: 'var(--vscode-list-activeSelectionBackground, var(--vscode-button-background, #0E639C))',
    color: 'var(--vscode-list-activeSelectionForeground, white)',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };
  
  const cellStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    verticalAlign: 'top',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  
  const rowNumberStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: 'var(--vscode-list-activeSelectionBackground, var(--vscode-button-background, #0E639C))',
    color: 'var(--vscode-list-activeSelectionForeground, white)',
    fontWeight: 600,
    textAlign: 'center',
    width: '60px',
    minWidth: '60px',
    maxWidth: '60px',
    position: 'sticky',
    left: 0,
    zIndex: 2,
    borderRight: '1px solid var(--vscode-panel-border, #333)'
  };
  
  const rowNumberHeaderStyle: React.CSSProperties = {
    ...headerStyle,
    textAlign: 'center',
    width: '60px',
    minWidth: '60px',
    maxWidth: '60px',
    position: 'sticky',
    left: 0,
    zIndex: 3,
    borderRight: '1px solid var(--vscode-panel-border, #333)',
    backgroundColor: 'var(--vscode-list-activeSelectionBackground, var(--vscode-button-background, #0E639C))',
    color: 'var(--vscode-list-activeSelectionForeground, white)'
  };
  
  const containerStyle: React.CSSProperties = {
    height: '100%',
    overflow: 'auto',
    border: '1px solid var(--vscode-panel-border, #333)',
    borderRadius: '4px'
  };
  
  return (
    <div style={containerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={rowNumberHeaderStyle} title="Row Number">
              #
            </th>
            {columns.map(column => (
              <th key={column.key} style={headerStyle} title={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const flattenedRow = flattenObject(row);
            return (
              <tr key={rowIndex}>
                <td style={rowNumberStyle}>
                  {rowIndex + 1}
                </td>
                {columns.map(column => (
                  <td 
                    key={column.key} 
                    style={cellStyle}
                    title={formatCellValue(flattenedRow[column.key], column.type)}
                  >
                    {formatCellValue(flattenedRow[column.key], column.type)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
