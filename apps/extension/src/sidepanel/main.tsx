import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidePanelApp } from './App';

const root = document.getElementById('sidepanel-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  );
}
