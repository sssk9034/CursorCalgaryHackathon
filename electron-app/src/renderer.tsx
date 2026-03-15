import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HarbourApp } from './components/HarbourApp';

const page = new URLSearchParams(window.location.search).get('page');

if (page === 'break' || page === 'settings') {
  void import('./renderer');
} else {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element was not found.');
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <HarbourApp />
    </React.StrictMode>,
  );
}
