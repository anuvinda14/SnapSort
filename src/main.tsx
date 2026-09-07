import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
const App = lazy(() => import('@/App'));
const OcrLab = lazy(() => import('@/components/OcrLab'));
const comparison = new URLSearchParams(window.location.search).has('ocr-lab');
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p className="p-6">Loading SnapSort…</p>}>{comparison ? <OcrLab /> : <App />}</Suspense>
  </StrictMode>
);
