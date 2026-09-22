// design-template code, don't change this file.
import './app';
import * as React from 'react';
import { createRoot } from 'react-dom/client';

export function initPage(PageComponent: any) {
  const renderPage = () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      console.error('Root element not found');
      return;
    }
    const root = createRoot(rootElement);
    root.render(React.createElement(PageComponent));
  };

  if (typeof window !== 'undefined' && window.App) {
    window.App.renderCurrentPage = renderPage;
    window.App.initPage();
  } else {
    console.error('window.App is not available');
  }
}
