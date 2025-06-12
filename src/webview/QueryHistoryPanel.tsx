import React, { useState, useEffect } from 'react';
import './QueryHistoryPanel.css';

export interface HistoryItem {
  id: string;
  query: string;
  name: string;
  timestamp: number;
  collection: string;
  isSaved: boolean;
}

interface QueryHistoryPanelProps {
  onSelectQuery: (query: string) => void;
  currentQuery: string;
  currentCollection: string | null;
}

/**
 * Component that displays a history of queries with save/load functionality
 */
const QueryHistoryPanel: React.FC<QueryHistoryPanelProps> = ({
  onSelectQuery,
  currentQuery,
  currentCollection
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const [showPanel, setShowPanel] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Load history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('weaviate-query-history');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
      } catch (error) {
        console.error('Error parsing query history:', error);
      }
    }
  }, []);

  // Save query to history
  const saveCurrentQuery = () => {
    if (!currentQuery.trim()) return;
    
    const newItem: HistoryItem = {
      id: `query-${Date.now()}`,
      query: currentQuery,
      name: `Query ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      collection: currentCollection || 'unknown',
      isSaved: false
    };
    
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    
    // Save to localStorage
    localStorage.setItem('weaviate-query-history', JSON.stringify(updatedHistory));
  };

  // Toggle saved status of a history item
  const toggleSaveItem = (id: string) => {
    const updatedHistory = history.map(item => 
      item.id === id ? { ...item, isSaved: !item.isSaved } : item
    );
    setHistory(updatedHistory);
    localStorage.setItem('weaviate-query-history', JSON.stringify(updatedHistory));
  };

  // Delete history item
  const deleteItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('weaviate-query-history', JSON.stringify(updatedHistory));
  };

  // Start editing an item's name
  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  // Save edited name
  const saveEditedName = () => {
    if (!editingId) return;
    
    const updatedHistory = history.map(item =>
      item.id === editingId ? { ...item, name: editingName } : item
    );
    setHistory(updatedHistory);
    localStorage.setItem('weaviate-query-history', JSON.stringify(updatedHistory));
    setEditingId(null);
  };

  // Filter history items based on the current filter
  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(item => item.isSaved);

  return (
    <div className={`query-history-panel ${showPanel ? '' : 'collapsed'}`}>
      <div className="query-history-header">
        <h3>Query History</h3>
        <div className="query-history-controls">
          <button 
            className="query-history-save-button"
            onClick={saveCurrentQuery}
            title="Save current query to history"
          >
            Save Query
          </button>
          <button 
            className="query-history-toggle"
            onClick={() => setShowPanel(!showPanel)}
            title={showPanel ? "Collapse panel" : "Expand panel"}
          >
            {showPanel ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {showPanel && (
        <div className="query-history-content">
          <div className="query-history-filter">
            <button 
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={filter === 'saved' ? 'active' : ''}
              onClick={() => setFilter('saved')}
            >
              Saved
            </button>
          </div>

          <div className="query-history-list">
            {filteredHistory.length === 0 ? (
              <div className="query-history-empty">
                No queries in history. Run queries to see them here.
              </div>
            ) : (
              filteredHistory.map(item => (
                <div key={item.id} className="query-history-item">
                  <div className="query-history-item-header">
                    {editingId === item.id ? (
                      <div className="query-history-edit">
                        <input 
                          type="text" 
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditedName();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button onClick={saveEditedName}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div className="query-history-item-title" onClick={() => onSelectQuery(item.query)}>
                          {item.name}
                        </div>
                        <div className="query-history-item-actions">
                          <button 
                            className="history-action"
                            onClick={() => startEditing(item.id, item.name)}
                            title="Edit name"
                          >
                            ✎
                          </button>
                          <button 
                            className={`history-action ${item.isSaved ? 'saved' : ''}`}
                            onClick={() => toggleSaveItem(item.id)}
                            title={item.isSaved ? "Unsave query" : "Save query"}
                          >
                            {item.isSaved ? '★' : '☆'}
                          </button>
                          <button 
                            className="history-action delete"
                            onClick={() => deleteItem(item.id)}
                            title="Delete query"
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="query-history-item-collection">
                    Collection: {item.collection}
                  </div>
                  <div className="query-history-item-time">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <div className="query-history-item-preview">
                    {item.query.length > 100 
                      ? `${item.query.substring(0, 100)}...` 
                      : item.query}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryHistoryPanel;
