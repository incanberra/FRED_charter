import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ChartProvider } from './state/ChartContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChartProvider>
      <App />
    </ChartProvider>
  </StrictMode>,
);
