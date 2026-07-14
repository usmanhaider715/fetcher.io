import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './App';

const root = document.getElementById('popup-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>,
  );
}
