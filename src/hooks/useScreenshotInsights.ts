import { useEffect, useMemo, useRef, useState } from 'react';
import type { Screenshot } from '@/types';
import type { CategoryId, ReviewedCalendarEvent, SuggestionDecision } from '@/insights-types';
import { analyzeScreenshot, groupCategories } from '@/lib/insights/analyze';
import { createCalendarFile, downloadCalendarFile } from '@/lib/insights/calendar';
import { readDecisions, saveDecision, deleteDecision, pruneDecisions } from '@/lib/insights/decisions';

/** Pass loaded=false until the parent has finished loading its screenshot database. */
export function useScreenshotInsights(items: Screenshot[], loaded: boolean) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [decisions, setDecisions] = useState<SuggestionDecision[]>([]);
  const [decisionsLoaded, setDecisionsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const lock = useRef(false);
  // Ignore progress ticks and image blobs; analyze only when relevant OCR data changes.
  const signature = JSON.stringify(items.map(({ id, name, status, text }) => ({ id, name, status, text })));
  const insights = useMemo(() => (JSON.parse(signature) as Screenshot[]).map(analyzeScreenshot), [signature]);
  const categories = useMemo(() => groupCategories(insights), [insights]);
  const allSuggestions = useMemo(() => insights.flatMap(s => s.suggestions), [insights]);
  const current = useRef(allSuggestions);
  current.current = allSuggestions;
  const suggestions = allSuggestions.map(s => ({ ...s, status: decisions.find(d => d.id === s.id && d.sourceText === s.sourceText)?.status ?? 'pending' as const }));

  useEffect(() => {
    let active = true;
    readDecisions().then(values => { if (active) setDecisions(values); }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setDecisionsLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded || !decisionsLoaded) return;
    let active = true;
    pruneDecisions(allSuggestions).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [loaded, decisionsLoaded, allSuggestions]);

  useEffect(() => {
    if (loaded && selectedCategory !== 'all' && !categories.some(c => c.id === selectedCategory)) setSelectedCategory('all');
  }, [loaded, selectedCategory, categories]);

  async function decide(id: string, status: 'dismissed' | 'exported', event?: ReviewedCalendarEvent, approval?: { approved: true }) {
    if (lock.current) throw new Error('Wait for the current action to finish.');
    if (!loaded || !decisionsLoaded) throw new Error('Wait for the library to finish loading.');
    const suggestion = current.current.find(s => s.id === id);
    if (!suggestion) throw new Error('This suggestion is no longer available.');
    if (decisions.some(d => d.id === id && d.sourceText === suggestion.sourceText)) throw new Error('Reset this suggestion before acting on it again.');
    lock.current = true; setBusyId(id); setError('');
    try {
      const file = status === 'exported' ? createCalendarFile(suggestion, event!, approval!) : null;
      const decision: SuggestionDecision = { id, screenshotId: suggestion.screenshotId, sourceText: suggestion.sourceText, status, updatedAt: Date.now() };
      await saveDecision(decision);
      if (!current.current.some(s => s.id === id && s.sourceText === suggestion.sourceText)) {
        await deleteDecision(id);
        throw new Error('The screenshot changed. Review its current details before approving.');
      }
      if (file) downloadCalendarFile(file);
      setDecisions(prev => [...prev.filter(d => d.id !== id), decision]);
      return file;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); throw e; }
    finally { lock.current = false; setBusyId(null); }
  }

  async function resetSuggestion(id: string) {
    if (lock.current) throw new Error('Wait for the current action to finish.');
    lock.current = true; setBusyId(id);
    try { await deleteDecision(id); setDecisions(prev => prev.filter(d => d.id !== id)); setError(''); }
    catch (e) { setError(String(e)); throw e; }
    finally { lock.current = false; setBusyId(null); }
  }

  const categoryIds = selectedCategory === 'all' ? null : new Set(categories.find(c => c.id === selectedCategory)?.screenshotIds ?? []);
  return {
    insights, categories, selectedCategory, setSelectedCategory,
    filteredItems: categoryIds ? items.filter(s => categoryIds.has(s.id)) : items,
    suggestions, pendingSuggestions: suggestions.filter(s => s.status === 'pending'),
    loading: !loaded || !decisionsLoaded, error, busyId,
    dismissSuggestion: (id: string) => decide(id, 'dismissed'),
    approveCalendar: (id: string, event: ReviewedCalendarEvent, approval: { approved: true }) => decide(id, 'exported', event, approval),
    resetSuggestion,
  };
}
