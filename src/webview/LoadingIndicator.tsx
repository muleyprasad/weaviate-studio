import React from 'react';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  message?: string;
  isVisible: boolean;
}

/**
 * Loading indicator component with spinner and optional message
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  isVisible
}) => {
  if (!isVisible) return null;
  
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <div className="loading-text">{message}</div>
    </div>
  );
};

export default LoadingIndicator;
