import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

if (window.location.pathname !== '/') {
  window.location.replace('/');
} else {
  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
