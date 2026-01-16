import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';

/**
 * Object detail panel - slide-out view of a single object
 */
export function ObjectDetailPanel() {
  const { state, selectObject } = useDataExplorer();
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'properties' | 'metadata' | 'json'>('properties');

  // Get the full object data
  useEffect(() => {
    if (state.selectedObjectId && state.objects.length > 0) {
      const obj = state.objects.find((o) => {
        const id = o.uuid || o.id || o._additional?.id;
        return id === state.selectedObjectId;
      });
      setSelectedObject(obj || null);
    }
  }, [state.selectedObjectId, state.objects]);

  const handleClose = () => {
    selectObject(null);
  };

  if (!selectedObject) {
    return null;
  }

  const objectId = selectedObject.uuid || selectedObject.id || selectedObject._additional?.id || '';
  const properties = selectedObject.properties || selectedObject;
  const metadata = selectedObject._additional || {};

  return (
    <div className="object-detail-panel">
      <div className="detail-header">
        <h3 className="detail-title">Object Details</h3>
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <div className="detail-uuid">
        <span className="uuid-label">UUID:</span>
        <span className="uuid-value">{objectId}</span>
        <button
          className="copy-button"
          onClick={() => navigator.clipboard.writeText(objectId)}
          aria-label="Copy UUID"
        >
          📋
        </button>
      </div>

      <div className="detail-tabs">
        <button
          className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
        <button
          className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          Metadata
        </button>
        <button
          className={`tab-button ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          JSON
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'properties' && (
          <PropertiesView properties={properties} schema={state.schema} />
        )}
        {activeTab === 'metadata' && (
          <MetadataView metadata={metadata} />
        )}
        {activeTab === 'json' && (
          <JsonView object={selectedObject} />
        )}
      </div>
    </div>
  );
}

/**
 * Properties view tab
 */
function PropertiesView({ properties, schema }: { properties: any; schema: any }) {
  if (!properties || typeof properties !== 'object') {
    return <div className="no-data">No properties available</div>;
  }

  const entries = Object.entries(properties).filter(
    ([key]) => !key.startsWith('_') && key !== 'uuid' && key !== 'id'
  );

  return (
    <div className="properties-view">
      {entries.length === 0 ? (
        <div className="no-data">No properties found</div>
      ) : (
        entries.map(([key, value]) => {
          const property = schema?.properties?.find((p: any) => p.name === key);
          return (
            <div key={key} className="property-item">
              <div className="property-header">
                <span className="property-name">{key}</span>
                {property && (
                  <span className="property-type">{property.dataType}</span>
                )}
              </div>
              <div className="property-value">
                {renderPropertyValue(value)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Metadata view tab
 */
function MetadataView({ metadata }: { metadata: any }) {
  if (!metadata || typeof metadata !== 'object' || Object.keys(metadata).length === 0) {
    return <div className="no-data">No metadata available</div>;
  }

  // Format timestamps
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="metadata-view">
      {metadata.creationTimeUnix && (
        <div className="metadata-item">
          <span className="metadata-label">Creation Time:</span>
          <span className="metadata-value">
            {formatTimestamp(metadata.creationTimeUnix)}
          </span>
        </div>
      )}

      {metadata.lastUpdateTimeUnix && (
        <div className="metadata-item">
          <span className="metadata-label">Last Update:</span>
          <span className="metadata-value">
            {formatTimestamp(metadata.lastUpdateTimeUnix)}
          </span>
        </div>
      )}

      {metadata.distance !== undefined && (
        <div className="metadata-item">
          <span className="metadata-label">Distance:</span>
          <span className="metadata-value">{metadata.distance.toFixed(4)}</span>
        </div>
      )}

      {metadata.certainty !== undefined && (
        <div className="metadata-item">
          <span className="metadata-label">Certainty:</span>
          <span className="metadata-value">{metadata.certainty.toFixed(4)}</span>
        </div>
      )}

      {metadata.score !== undefined && (
        <div className="metadata-item">
          <span className="metadata-label">Score:</span>
          <span className="metadata-value">{metadata.score.toFixed(4)}</span>
        </div>
      )}

      {metadata.vector && (
        <div className="metadata-item">
          <span className="metadata-label">Vector:</span>
          <span className="metadata-value">
            {Array.isArray(metadata.vector)
              ? `[${metadata.vector.length} dimensions]`
              : 'Available'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * JSON view tab
 */
function JsonView({ object }: { object: any }) {
  const [copyText, setCopyText] = useState('Copy');

  const handleCopy = () => {
    const jsonString = JSON.stringify(object, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  };

  return (
    <div className="json-view">
      <div className="json-toolbar">
        <button className="copy-json-button" onClick={handleCopy}>
          {copyText}
        </button>
      </div>
      <pre className="json-content">
        <code>{JSON.stringify(object, null, 2)}</code>
      </pre>
    </div>
  );
}

/**
 * Render property value with appropriate formatting
 */
function renderPropertyValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="value-null">null</span>;
  }

  if (typeof value === 'boolean') {
    return <span className={`value-boolean ${value ? 'true' : 'false'}`}>{String(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className="value-number">{value.toLocaleString()}</span>;
  }

  if (typeof value === 'string') {
    return <span className="value-string">{value}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="value-array">
        <div className="array-header">[{value.length} items]</div>
        <div className="array-items">
          {value.map((item, index) => (
            <div key={index} className="array-item">
              <span className="array-index">{index}:</span>
              {renderPropertyValue(item)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="value-object">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="object-property">
            <span className="object-key">{key}:</span>
            <span className="object-value">{renderPropertyValue(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="value-default">{String(value)}</span>;
}
