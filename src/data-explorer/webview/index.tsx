import React from 'react';
import { createRoot } from 'react-dom/client';
import { DataExplorer } from './DataExplorer';

// Mount the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DataExplorer />);
} else {
  console.error('Root element not found');
}
