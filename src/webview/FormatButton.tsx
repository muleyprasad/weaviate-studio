import React from 'react';
import './FormatButton.css';

interface FormatButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * A button component for formatting GraphQL queries
 */
const FormatButton: React.FC<FormatButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button 
      className="format-button"
      onClick={onClick}
      disabled={disabled}
      title="Format Query (Prettier)"
    >
      <span className="format-icon">⟲</span>
      <span className="format-text">Format</span>
    </button>
  );
};

export default FormatButton;
