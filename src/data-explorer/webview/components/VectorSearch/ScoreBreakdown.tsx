/**
 * ScoreBreakdown - Visual breakdown of hybrid search scores
 * Shows keyword (BM25), semantic (vector), and combined scores
 */

import React from 'react';
import type { HybridExplainScore } from '../../context';

interface ScoreBreakdownProps {
  explainScore: HybridExplainScore;
}

export function ScoreBreakdown({ explainScore }: ScoreBreakdownProps) {
  const { keyword, vector, combined, matchedTerms } = explainScore;

  // Find max score to normalize against (BM25 scores can exceed 1.0)
  const maxScore = Math.max(keyword, vector, combined, 1);

  /**
   * Normalize scores to 0-100% for visual bar display
   * Uses the max score as reference to ensure all bars fit
   * Handles BM25 scores that can be > 1.0
   */
  const normalizeScore = (score: number): number => {
    if (!Number.isFinite(score) || score < 0) return 0;
    // Normalize against max score, then convert to percentage
    return Math.min(100, Math.max(0, (score / maxScore) * 100));
  };

  return (
    <div className="score-breakdown">
      <h4 className="score-breakdown-title">
        <span className="codicon codicon-pulse" aria-hidden="true"></span>
        Match Breakdown
      </h4>

      <div className="score-row">
        <span className="score-label">Keyword (BM25):</span>
        <span className="score-value">{keyword.toFixed(2)}</span>
        <div className="score-bar">
          <div className="score-fill keyword" style={{ width: `${normalizeScore(keyword)}%` }} />
        </div>
      </div>

      <div className="score-row">
        <span className="score-label">Semantic:</span>
        <span className="score-value">{vector.toFixed(2)}</span>
        <div className="score-bar">
          <div className="score-fill semantic" style={{ width: `${normalizeScore(vector)}%` }} />
        </div>
      </div>

      <div className="score-row combined">
        <span className="score-label">Combined:</span>
        <span className="score-value">{combined.toFixed(2)}</span>
        <div className="score-bar">
          <div className="score-fill combined" style={{ width: `${normalizeScore(combined)}%` }} />
        </div>
      </div>

      {matchedTerms && matchedTerms.length > 0 && (
        <div className="matched-terms">
          <span className="codicon codicon-symbol-keyword" aria-hidden="true"></span>
          Matched terms:{' '}
          {matchedTerms.map((term: string, i: number) => (
            <span key={i} className="matched-term">
              "{term}"{i < matchedTerms.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
