import { BookOpen, CalendarDays, Check, ChevronRight, FileText, FolderOpen, HeartPulse, History, KeyRound, LayoutGrid, Plane, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { CategoryId, CalendarSuggestion } from '@/insights-types';
import type { useScreenshotInsights } from '@/hooks/useScreenshotInsights';

type PanelData = ReturnType<typeof useScreenshotInsights>;
const icons = { events: CalendarDays, travel: Plane, receipts: FileText, study: BookOpen, health: HeartPulse, credentials: KeyRound, other: FolderOpen };

export function InsightsPanel({ panel, total, onReview }: { panel: PanelData; total: number; onReview: (suggestion: CalendarSuggestion) => void }) {
  const [history, setHistory] = useState(false);
  const resolved = panel.suggestions.filter(s => s.status !== 'pending');
  const visible = history ? resolved : panel.pendingSuggestions;
  async function dismiss(id: string) { try { await panel.dismissSuggestion(id); } catch { /* Error is shown through panel.error. */ } }
  async function reset(id: string) { try { await panel.resetSuggestion(id); } catch { /* Error is shown through panel.error. */ } }
  return (
    <aside className="insights-panel" aria-label="Screenshot insights">
      <section className="insight-section categories-section" aria-labelledby="categories-title">
        <div className="panel-heading">
          <div className="flex items-center justify-between gap-2"><span className="panel-eyebrow">A PLACE FOR EVERYTHING</span><FolderOpen size={17} className="text-brand-500" /></div>
          <h2 id="categories-title" className="text-xl font-semibold text-brand-950 mt-2">Categories</h2>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">Organized from the text in your screenshots.</p>
        </div>
        <nav className="panel-scroll px-3 pb-4" aria-label="Filter by category">
          <CategoryButton id="all" label="All screenshots" count={total} selected={panel.selectedCategory === 'all'} onSelect={panel.setSelectedCategory} />
          {panel.categories.map(c => <CategoryButton key={c.id} {...c} selected={panel.selectedCategory === c.id} onSelect={panel.setSelectedCategory} />)}
          {!panel.categories.length && <div className="p-4 mt-3 rounded-xl border border-dashed border-brand-100 text-sm text-stone-500 leading-relaxed">{total ? 'Categories will appear when text recognition finishes.' : 'Import your first screenshots. Their categories will appear here automatically.'}</div>}
        </nav>
        <p className="px-5 py-3 border-t border-brand-100/70 text-[11px] text-stone-500">A screenshot can belong to more than one category.</p>
      </section>

      <section className="insight-section suggestions-section" aria-labelledby="suggestions-title">
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2 border-b border-brand-100/70">
          <div><h2 id="suggestions-title" className="font-semibold text-brand-950 flex items-center gap-2"><Sparkles size={16} className="text-brand-600" />{history ? 'Action history' : 'Suggested actions'}</h2><p className="text-[11px] text-stone-500 mt-1">You choose what happens next.</p></div>
          <button className="icon-button shrink-0" title={history ? 'Show suggestions' : 'Show action history'} aria-label={history ? 'Show suggestions' : 'Show action history'} onClick={() => setHistory(v => !v)}><History size={16} /></button>
        </div>
        <div className="panel-scroll p-3 space-y-3">
          {panel.error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 break-words">{panel.error}</p>}
          {panel.loading ? <p className="p-2 text-sm text-stone-500">Loading suggestions…</p> : visible.length === 0 ? (
            <div className="px-2 py-3 flex gap-3 text-sm text-stone-500"><Check size={18} className="text-brand-500 shrink-0 mt-0.5" /><p>{history ? 'No reviewed or dismissed actions yet.' : 'All caught up. Event and deadline suggestions appear here when detected.'}</p></div>
          ) : visible.map(s => <article key={s.id} className="rounded-xl border border-brand-100 bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold mb-1">{s.status === 'pending' ? 'Calendar suggestion' : s.status === 'exported' ? 'Calendar file prepared' : 'Dismissed'}</p>
            <h3 className="text-sm font-semibold text-brand-950 line-clamp-2">{s.draft.title}</h3>
            <p className="text-xs text-stone-500 mt-1 truncate" title={s.screenshotName}>From {s.screenshotName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {s.status === 'pending' ? <><button disabled={panel.loading || !!panel.busyId} className="small-primary" onClick={() => onReview(s)}>Review event<ChevronRight size={13} /></button><button disabled={!!panel.busyId} className="text-xs font-medium text-stone-500 hover:text-brand-800 px-1 py-1" onClick={() => void dismiss(s.id)}>Dismiss</button></> : <button disabled={!!panel.busyId} className="text-xs text-brand-700 flex items-center gap-1 py-1" onClick={() => void reset(s.id)}><RotateCcw size={12} />Review again</button>}
            </div>
          </article>)}
        </div>
      </section>
    </aside>
  );
}

function CategoryButton({ id, label, count, selected, onSelect }: { id: CategoryId | 'all'; label: string; count: number; selected: boolean; onSelect: (id: CategoryId | 'all') => void }) {
  const Icon = id === 'all' ? LayoutGrid : icons[id];
  return <button className={`category-button ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => onSelect(id)}>
    <span className="category-icon"><Icon size={17} /></span><span className="flex-1 text-left text-sm font-medium leading-snug">{label}</span><span className="category-count">{count}</span>
  </button>;
}
