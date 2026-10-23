import '@fontsource-variable/inter';
import { LucideProvider } from 'lucide-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* SF Symbols-like weight for every icon */}
    <LucideProvider strokeWidth={1.75}>
      <App />
    </LucideProvider>
  </StrictMode>,
);
