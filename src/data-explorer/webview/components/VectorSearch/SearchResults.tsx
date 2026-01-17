import React from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { getObjectPreviewText } from '../../../utils/previewUtils';

/**
 * Search Results - Display vector search results with similarity scores
 *
 * Shows each result with:
 * - Similarity score (distance or certainty)
 * - Match percentage visualization
 * - Object properties preview
 * - Actions: View Object, Find Similar to This
 */
export function SearchResults() {
  const { state, dispatch, postMessage } = useDataExplorer();
  const { vectorSearch } = state;
  const { results, config } = vectorSearch;

  if (results.length === 0) {
    return null;
  }

  const handleViewObject = (objectId: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: objectId });
    dispatch({ type: 'TOGGLE_DETAIL_PANEL', payload: true });
  };

  const handleFindSimilar = (objectId: string) => {
    // Switch to object mode and set the reference object
    dispatch({
      type: 'SET_VECTOR_SEARCH_CONFIG',
      payload: {
        mode: 'object',
        referenceObjectId: objectId,
      },
    });

    // Trigger new search
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'object',
        referenceObjectId: objectId,
        limit: config.limit,
        distance: config.useDistance ? config.distance : undefined,
        certainty: !config.useDistance ? config.certainty : undefined,
      },
    });
  };

  const calculateMatchPercentage = (result: typeof results[0]): number => {
    if (config.useDistance) {
      // Distance: 0 = 100% match, 2 = 0% match
      const distance = result.distance || 0;
      return Math.max(0, Math.min(100, 100 - (distance / 2) * 100));
    } else {
      // Certainty: 0 = 0% match, 1 = 100% match
      const certainty = result.certainty || 0;
      return certainty * 100;
    }
  };

  return (
    <div className="vector-search-results">
      <div className="results-header">
        <h4 className="results-title">
          Found {results.length} similar object{results.length !== 1 ? 's' : ''}
        </h4>
      </div>

      <div className="results-list">
        {results.map((result, index) => {
          const matchPercentage = calculateMatchPercentage(result);
          const objectId = result.object.uuid || '';
          const previewText = getObjectPreviewText(result.object);

          return (
            <div key={objectId || index} className="result-item">
              {/* Match Score */}
              <div className="result-score">
                <div className="score-percentage">
                  {matchPercentage.toFixed(0)}% Match
                </div>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{ width: `${matchPercentage}%` }}
                  ></div>
                </div>
                <div className="score-details">
                  {config.useDistance ? (
                    <span>Distance: {result.distance?.toFixed(4) || 'N/A'}</span>
                  ) : (
                    <span>Certainty: {result.certainty?.toFixed(4) || 'N/A'}</span>
                  )}
                  {result.score !== undefined && (
                    <span> | Score: {result.score.toFixed(4)}</span>
                  )}
                </div>
              </div>

              {/* Object Preview */}
              <div className="result-preview">
                <div className="preview-text">{previewText}</div>
                <div className="preview-uuid">UUID: {objectId}</div>
              </div>

              {/* Actions */}
              <div className="result-actions">
                <button
                  className="result-action-button primary"
                  onClick={() => handleViewObject(objectId)}
                  title="View full object details"
                >
                  👁️ View Object
                </button>
                <button
                  className="result-action-button secondary"
                  onClick={() => handleFindSimilar(objectId)}
                  title="Find objects similar to this one"
                >
                  🔗 Find Similar to This
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
