/**
 * Data Explorer Webview Entry Point
 * Renders the DataExplorer React component into the webview
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DataExplorer } from './DataExplorer';
import '../../webview/theme.css';
import './styles.css';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');

  if (!container) {
    console.error('Root container not found');
    return;
  }

  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <DataExplorer />
    </React.StrictMode>
  );
});
