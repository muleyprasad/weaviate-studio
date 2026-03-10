/**
 * RAG Chat Webview Entry Point
 * Renders the RagChat React component into the webview
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RagChat } from './RagChat';
import '../../webview/theme.css';
import './RagChat.css';

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
      <RagChat />
    </React.StrictMode>
  );
});
