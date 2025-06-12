import React from 'react';

interface QuickInsertButtonProps {
  label: string;
  template: string;
  description?: string;
  onClick: (template: string) => void;
}

/**
 * A button component for quickly inserting GraphQL snippets into the editor
 */
const QuickInsertButton: React.FC<QuickInsertButtonProps> = ({ 
  label, 
  template, 
  description, 
  onClick 
}) => {
  return (
    <button
      className="quick-insert-button"
      title={description || label}
      onClick={() => onClick(template)}
      style={{
        backgroundColor: '#2D2D2D',
        color: '#E0E0E0',
        border: '1px solid #444',
        borderRadius: '3px',
        padding: '3px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        height: '24px',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseOver={(e) => {
        const target = e.currentTarget;
        target.style.backgroundColor = '#3D3D3D';
        target.style.borderColor = '#555';
      }}
      onMouseOut={(e) => {
        const target = e.currentTarget;
        target.style.backgroundColor = '#2D2D2D';
        target.style.borderColor = '#444';
      }}
    >
      {label}
    </button>
  );
};

export default QuickInsertButton;
