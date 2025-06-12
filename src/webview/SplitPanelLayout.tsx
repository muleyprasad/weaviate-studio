import React, { useState, useRef, useEffect } from 'react';
import './SplitPanelLayout.css';

/**
 * Props for the SplitPanelLayout component
 */
interface SplitPanelLayoutProps {
  /** Top panel content */
  topContent: React.ReactNode;
  /** Bottom panel content */
  bottomContent: React.ReactNode;
  /** Initial height ratio for top panel (0-1) */
  initialTopHeightRatio?: number;
  /** Minimum height for top panel in pixels */
  minTopHeight?: number;
  /** Minimum height for bottom panel in pixels */
  minBottomHeight?: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * A component that renders a vertical split panel layout with resizable and collapsible panels
 */
const SplitPanelLayout: React.FC<SplitPanelLayoutProps> = ({
  topContent,
  bottomContent,
  initialTopHeightRatio = 0.5,
  minTopHeight = 100,
  minBottomHeight = 100,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topPanelHeight, setTopPanelHeight] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isTopPanelCollapsed, setIsTopPanelCollapsed] = useState<boolean>(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState<boolean>(false);
  const dragStartY = useRef<number>(0);
  const dragStartTopHeight = useRef<number>(0);

  // Initialize panel heights
  useEffect(() => {
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      setTopPanelHeight(containerHeight * initialTopHeightRatio);
    }
  }, [initialTopHeightRatio]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        if (isTopPanelCollapsed) {
          setTopPanelHeight(0);
        } else if (isBottomPanelCollapsed) {
          setTopPanelHeight(containerHeight);
        } else {
          // Maintain ratio on resize
          const ratio = topPanelHeight / containerHeight;
          setTopPanelHeight(containerHeight * ratio);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isTopPanelCollapsed, isBottomPanelCollapsed, topPanelHeight]);

  // Handle mouse events for dragging the divider
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartTopHeight.current = topPanelHeight;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!isDragging) return;

    const containerHeight = containerRef.current?.clientHeight || 0;
    const delta = e.clientY - dragStartY.current;
    let newTopHeight = dragStartTopHeight.current + delta;

    // Apply constraints
    newTopHeight = Math.max(newTopHeight, isTopPanelCollapsed ? 0 : minTopHeight);
    newTopHeight = Math.min(
      newTopHeight,
      isBottomPanelCollapsed ? containerHeight : containerHeight - minBottomHeight
    );

    setTopPanelHeight(newTopHeight);
  };

  // Add global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle panel collapse toggles
  const toggleTopPanel = () => {
    if (!isTopPanelCollapsed && !isBottomPanelCollapsed) {
      // Store current height before collapsing
      dragStartTopHeight.current = topPanelHeight;
      setIsTopPanelCollapsed(true);
      setTopPanelHeight(0);
    } else if (isTopPanelCollapsed) {
      setIsTopPanelCollapsed(false);
      setIsBottomPanelCollapsed(false);
      // Restore height or use default
      setTopPanelHeight(dragStartTopHeight.current || minTopHeight);
    }
  };

  const toggleBottomPanel = () => {
    if (!isBottomPanelCollapsed && !isTopPanelCollapsed) {
      setIsBottomPanelCollapsed(true);
      if (containerRef.current) {
        setTopPanelHeight(containerRef.current.clientHeight);
      }
    } else if (isBottomPanelCollapsed) {
      setIsBottomPanelCollapsed(false);
      setIsTopPanelCollapsed(false);
      // Restore reasonable height distribution
      if (containerRef.current) {
        setTopPanelHeight(containerRef.current.clientHeight * initialTopHeightRatio);
      }
    }
  };

  return (
    <div className={`split-panel-container ${className}`} ref={containerRef}>
      {/* Top panel */}
      <div
        className={`split-panel-top ${isTopPanelCollapsed ? 'collapsed' : ''}`}
        style={{ height: topPanelHeight }}
      >
        {!isTopPanelCollapsed && topContent}
      </div>

      {/* Resizable divider */}
      <div
        className="split-panel-divider"
        onMouseDown={handleMouseDown}
      >
        <div className="split-panel-controls">
          <button 
            className={`split-panel-toggle ${isTopPanelCollapsed ? 'is-collapsed' : ''}`}
            onClick={toggleTopPanel}
            title={isTopPanelCollapsed ? 'Expand Editor' : 'Collapse Editor'}
          >
            {isTopPanelCollapsed ? '▼' : '▲'}
          </button>
          <div className="split-panel-divider-grip">≡</div>
          <button 
            className={`split-panel-toggle ${isBottomPanelCollapsed ? 'is-collapsed' : ''}`}
            onClick={toggleBottomPanel}
            title={isBottomPanelCollapsed ? 'Expand Results' : 'Collapse Results'}
          >
            {isBottomPanelCollapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Bottom panel */}
      <div
        className={`split-panel-bottom ${isBottomPanelCollapsed ? 'collapsed' : ''}`}
        style={{ 
          height: containerRef.current ? 
            `calc(${containerRef.current.clientHeight}px - ${topPanelHeight}px - 8px)` : 
            '50%' 
        }}
      >
        {!isBottomPanelCollapsed && bottomContent}
      </div>
    </div>
  );
};

export default SplitPanelLayout;
