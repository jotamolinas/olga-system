
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';

console.log('[Initialization] Starting web application entry point index.tsx');

// Global Error Handler for Uncaught Runtime Errors
window.addEventListener('error', (event) => {
  console.error('[Global Runtime Error]:', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

// Global Error Handler for Unhandled Promise Rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]:', event.reason);
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[Initialization Error] Could not find #root element in document DOM');
    throw new Error("Could not find root element to mount to");
  }

  console.log('[Initialization] Target #root element found. Initializing React Root...');
  const root = ReactDOM.createRoot(rootElement);

  console.log('[Initialization] Rendering React Application Tree...');
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('[Initialization] React render pipeline triggered successfully');
} catch (initError) {
  console.error('[Initialization Fatal Error] Exception thrown during React mounting:', initError);
}

