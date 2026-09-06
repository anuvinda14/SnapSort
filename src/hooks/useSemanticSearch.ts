import { useEffect, useMemo, useRef, useState } from 'react';
import type { Screenshot } from '@/types';

type Match = { id: string; score: number };
export function useSemanticSearch(items: Screenshot[], query: string, enabled: boolean, loaded: boolean) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('Preparing local search…');
  const [error, setError] = useState('');
  const [indexed, setIndexed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const serial = useRef(0);
  const indexId = useRef(0);
  const searchId = useRef(0);
  const documents = JSON.stringify(items.filter(s => s.status === 'ready' && s.text.trim()).map(s => ({ id: s.id, text: s.text })));
  const docs = useMemo(() => JSON.parse(documents) as { id: string; text: string }[], [documents]);

  useEffect(() => {
    const instance = new Worker(new URL('../workers/semantic.worker.ts', import.meta.url), { type: 'module' });
    setWorker(instance);
    setError('');
    instance.onmessage = ({ data }) => {
      if (data.type === 'status') setStatus(data.message);
      if (data.id === indexId.current && data.type === 'indexed') {
        setIndexed(true); setStatus(`Semantic search ready · ${data.count} indexed`);
      }
      if (data.id === searchId.current && data.type === 'results') {
        setMatches(data.matches); setElapsed(data.elapsed); setSearching(false); setStatus('Semantic search ready');
      }
      if (data.type === 'error' && (data.id === indexId.current || data.id === searchId.current)) {
        setError(data.error); setSearching(false);
      }
    };
    instance.onerror = (event) => { setError(event.message || 'Search worker failed to load.'); setSearching(false); };
    return () => instance.terminate();
  }, [retry]);

  useEffect(() => {
    if (!worker || !loaded) return;
    setIndexed(false); setMatches([]); setError('');
    const id = ++serial.current;
    indexId.current = id;
    worker.postMessage({ id, type: 'index', docs });
    const timer = setTimeout(() => setError('Search setup took too long. Check your connection and retry.'), 180_000);
    const done = ({ data }: MessageEvent) => { if (data.id === id) clearTimeout(timer); };
    worker.addEventListener('message', done);
    return () => { clearTimeout(timer); worker.removeEventListener('message', done); };
  }, [worker, docs, loaded]);

  useEffect(() => {
    searchId.current = ++serial.current;
    setMatches([]);
    if (!worker || !indexed || !enabled || !query.trim()) { setSearching(false); return; }
    setSearching(true);
    const id = searchId.current;
    const timer = setTimeout(() => worker.postMessage({ id, type: 'search', query: query.trim() }), 300);
    return () => clearTimeout(timer);
  }, [worker, indexed, enabled, query]);

  return { status, error, indexed, searching, matches, elapsed, retry: () => setRetry(n => n + 1) };
}
