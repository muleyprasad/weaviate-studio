/**
 * AlphaSlider - Dual visualization slider for hybrid search weighting
 * Shows both keyword (BM25) and semantic (vector) weights
 * Alpha: 0 = pure keyword, 1 = pure vector
 */

import React from 'react';

interface AlphaSliderProps {
  value: number; // 0-1
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Quick preset buttons for common configurations
const ALPHA_PRESETS = [
  { label: 'Keyword Only', value: 0 },
  { label: 'Balanced', value: 0.5 },
  { label: 'Semantic Only', value: 1 },
];

export function AlphaSlider({ value, onChange, disabled = false }: AlphaSliderProps) {
  const keywordWeight = Math.round((1 - value) * 100);
  const semanticWeight = Math.round(value * 100);

  return (
    <div className="alpha-slider">
      <h4 className="alpha-slider-title">
        <span className="codicon codicon-settings-gear" aria-hidden="true"></span>
        Search Strategy
      </h4>

      {/* Preset buttons */}
      <div className="alpha-presets">
        {ALPHA_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`alpha-preset-btn ${value === preset.value ? 'active' : ''}`}
            onClick={() => onChange(preset.value)}
            disabled={disabled}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Keyword Weight Bar */}
      <div className="slider-row">
        <label>Keyword Weight (BM25)</label>
        <span className="weight-value">{keywordWeight}</span>
      </div>
      <div className="slider-visual keyword">
        <div className="slider-fill" style={{ width: `${keywordWeight}%` }} />
      </div>

      {/* Semantic Weight Bar */}
      <div className="slider-row">
        <label>Semantic Weight (Vector)</label>
        <span className="weight-value">{semanticWeight}</span>
      </div>
      <div className="slider-visual semantic">
        <div className="slider-fill" style={{ width: `${semanticWeight}%` }} />
      </div>

      {/* Actual slider input */}
      <input
        type="range"
        className="alpha-range-input"
        min="0"
        max="100"
        step="1"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        disabled={disabled}
        aria-label="Adjust keyword vs semantic weight balance"
      />

      {/* Alpha label display */}
      <div className="alpha-label">
        <span className="alpha-value">Alpha: {value.toFixed(2)}</span>
        <span className="alpha-description">
          ({semanticWeight}% semantic, {keywordWeight}% keyword)
        </span>
      </div>
    </div>
  );
}
