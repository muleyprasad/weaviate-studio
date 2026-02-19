/**
 * Tooltip - Reusable tooltip component
 * Shows helpful hints on hover
 */

import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  maxWidth = 250,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className="tooltip-wrapper"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className={`tooltip tooltip-${position}`} role="tooltip" style={{ maxWidth }}>
          <div className="tooltip-content">{content}</div>
          <div className="tooltip-arrow" />
        </div>
      )}
    </div>
  );
}

/**
 * InfoTooltip - Tooltip with info icon trigger
 */
export function InfoTooltip({
  content,
  position = 'top',
}: {
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip content={content} position={position}>
      <span className="info-tooltip-trigger" tabIndex={0} aria-label="More information">
        <span className="codicon codicon-info" aria-hidden="true"></span>
      </span>
    </Tooltip>
  );
}

export default Tooltip;
