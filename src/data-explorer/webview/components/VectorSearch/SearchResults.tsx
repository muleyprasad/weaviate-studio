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
  const isHybridSearch = config.mode === 'hybrid';

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
        distance: config.useDistanceMetric ? config.distance : undefined,
        certainty: !config.useDistanceMetric ? config.certainty : undefined,
      },
    });
  };

  /**
   * Calculates match percentage from vector search similarity scores
   *
   * Converts raw similarity metrics (distance or certainty) to a percentage
   * for easier user comprehension.
   *
   * @param result - Vector search result with distance/certainty scores
   * @returns Match percentage from 0-100
   *
   * @remarks
   * - Distance metric: 0 = 100% match, 2 = 0% match (inverse relationship)
   * - Certainty metric: 0 = 0% match, 1 = 100% match (direct relationship)
   */
  const calculateMatchPercentage = (result: typeof results[0]): number => {
    if (config.useDistanceMetric) {
      // Distance: 0 = 100% match, 2 = 0% match
      const distance = result.distance ?? 0;
      return Math.max(0, Math.min(100, 100 - (distance / 2) * 100));
    } else {
      // Certainty: 0 = 0% match, 1 = 100% match
      const certainty = result.certainty ?? 0;
      return certainty * 100;
    }
  };

  /**
   * Parses explainScore from hybrid search to extract component scores
   *
   * @param explainScore - Raw explainScore string from Weaviate
   * @returns Object containing keyword and semantic scores, or null if parsing fails
   *
   * @remarks
   * explainScore format varies by Weaviate version, but typically contains
   * information about BM25 (keyword) and vector (semantic) components
   */
  const parseHybridScores = (
    explainScore?: string
  ): { keywordScore: number; semanticScore: number } | null => {
    if (!explainScore) {
      return null;
    }

    try {
      // Try to extract numeric scores from explainScore
      // Format may vary, but typically contains patterns like:
      // "bm25: 0.82" or "vector: 0.91"
      const bm25Match = explainScore.match(/bm25[:\s]+([0-9.]+)/i);
      const vectorMatch = explainScore.match(/vector[:\s]+([0-9.]+)/i);

      if (bm25Match && vectorMatch) {
        return {
          keywordScore: parseFloat(bm25Match[1]),
          semanticScore: parseFloat(vectorMatch[1]),
        };
      }
    } catch (error) {
      console.warn('Failed to parse explainScore:', error);
    }

    return null;
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
          const hybridScores = isHybridSearch
            ? parseHybridScores(result.explainScore)
            : null;
          const combinedScore = result.score ?? 0;

          return (
            <div
              key={objectId || index}
              className="result-item"
              role="article"
              aria-label={`Search result ${index + 1}: ${matchPercentage.toFixed(0)}% match`}
            >
              {/* Match Score */}
              <div className="result-score">
                <div className="score-percentage">
                  {isHybridSearch && result.score !== undefined
                    ? `${(result.score * 100).toFixed(0)}% Match`
                    : `${matchPercentage.toFixed(0)}% Match`}
                </div>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{
                      width: `${
                        isHybridSearch && result.score !== undefined
                          ? result.score * 100
                          : matchPercentage
                      }%`,
                    }}
                  ></div>
                </div>

                {/* Hybrid Search Score Breakdown */}
                {isHybridSearch && hybridScores && (
                  <div className="hybrid-score-breakdown">
                    <div className="breakdown-title">Match Breakdown:</div>
                    <div className="breakdown-item">
                      <div className="breakdown-label">
                        <span className="breakdown-icon keyword">🔤</span>
                        Keyword (BM25):
                      </div>
                      <div className="breakdown-bar-container">
                        <div className="breakdown-bar">
                          <div
                            className="breakdown-fill keyword"
                            style={{ width: `${hybridScores.keywordScore * 100}%` }}
                          ></div>
                        </div>
                        <span className="breakdown-value">
                          {(hybridScores.keywordScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="breakdown-item">
                      <div className="breakdown-label">
                        <span className="breakdown-icon semantic">🧠</span>
                        Semantic:
                      </div>
                      <div className="breakdown-bar-container">
                        <div className="breakdown-bar">
                          <div
                            className="breakdown-fill semantic"
                            style={{ width: `${hybridScores.semanticScore * 100}%` }}
                          ></div>
                        </div>
                        <span className="breakdown-value">
                          {(hybridScores.semanticScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="breakdown-item combined">
                      <div className="breakdown-label">
                        <span className="breakdown-icon">⚡</span>
                        Combined:
                      </div>
                      <div className="breakdown-bar-container">
                        <div className="breakdown-bar">
                          <div
                            className="breakdown-fill combined"
                            style={{ width: `${combinedScore * 100}%` }}
                          ></div>
                        </div>
                        <span className="breakdown-value">
                          {(combinedScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standard Score Details (non-hybrid) */}
                {!isHybridSearch && (
                  <div className="score-details">
                    {config.useDistanceMetric ? (
                      <span>Distance: {result.distance?.toFixed(4) || 'N/A'}</span>
                    ) : (
                      <span>Certainty: {result.certainty?.toFixed(4) || 'N/A'}</span>
                    )}
                    {result.score !== undefined && (
                      <span> | Score: {result.score.toFixed(4)}</span>
                    )}
                  </div>
                )}

                {/* Hybrid Score (if no breakdown available) */}
                {isHybridSearch && !hybridScores && result.score !== undefined && (
                  <div className="score-details">
                    <span>Combined Score: {result.score.toFixed(4)}</span>
                  </div>
                )}
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
                  aria-label="View full object details"
                  title="View full object details"
                >
                  <span aria-hidden="true">👁️</span> View Object
                </button>
                <button
                  className="result-action-button secondary"
                  onClick={() => handleFindSimilar(objectId)}
                  aria-label="Find objects similar to this one"
                  title="Find objects similar to this one"
                >
                  <span aria-hidden="true">🔗</span> Find Similar to This
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
