import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsApp } from './App';

const root = document.getElementById('options-root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>,
  );
}
