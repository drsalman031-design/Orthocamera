import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Route benign Emscripten/TensorFlow Lite WASM informational messages away from console.error
if (typeof window !== 'undefined') {
  const rawConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.startsWith('INFO:') ||
      msg.includes('Created TensorFlow Lite') ||
      msg.includes('XNNPACK delegate')
    ) {
      console.info(...args);
      return;
    }
    rawConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
