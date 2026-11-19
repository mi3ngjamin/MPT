import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import { bootstrapAuthFromUrl } from './lib/authUrl';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element.');

void bootstrapAuthFromUrl().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
