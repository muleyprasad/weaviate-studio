/**
 * MuveraBadge - Display badge for MUVERA-encoded vectors
 * Shows a small badge indicating MUVERA encoding with a tooltip
 */

import React from 'react';
import './MuveraBadge.css';

interface MuveraBadgeProp {
  className?: string;
}

export function MuveraBadge({ className = '' }: MuveraBadgeProp) {
  return (
    <span
      className={`muvera-badge ${className}`}
      title="Uses MUVERA encoding for efficient multi-vector search"
      role="img"
      aria-label="MUVERA"
    >
      MUVERA
    </span>
  );
}
