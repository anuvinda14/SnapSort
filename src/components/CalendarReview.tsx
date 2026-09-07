import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, Loader2, X } from 'lucide-react';
import type { CalendarSuggestion, ReviewedCalendarEvent } from '@/insights-types';
import type { Screenshot } from '@/types';
import { offsetFor, reviewedEventFromForm } from '@/lib/insights/review';
import type { ReviewForm } from '@/lib/insights/review';

export function CalendarReview({ suggestion, screenshot, onClose, onApprove }: { suggestion: CalendarSuggestion; screenshot: Screenshot; onClose: () => void; onApprove: (event: ReviewedCalendarEvent) => Promise<unknown> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ReviewForm>({
    title: suggestion.draft.title, mode: '', startDate: suggestion.draft.date ?? '', endDate: suggestion.draft.date ?? '',
    startTime: suggestion.draft.time ?? '', endTime: '', startOffset: offsetFor(suggestion.draft.date ?? ''), endOffset: offsetFor(suggestion.draft.date ?? ''),
    location: suggestion.draft.location, description: '', confirmed: false,
  });
  const sourceText = screenshot.text.trim();
  const stale = sourceText !== suggestion.sourceText || screenshot.status !== 'ready';
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  useEffect(() => { const url = URL.createObjectURL(screenshot.blob); setImageUrl(url); return () => URL.revokeObjectURL(url); }, [screenshot.blob]);
  function update<K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) { setForm(f => ({ ...f, [key]: value, ...(key !== 'confirmed' ? { confirmed: false } : {}) })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || stale) return;
    setError(''); setBusy(true);
    try { await onApprove(reviewedEventFromForm(form)); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const dates = suggestion.dateCandidates.filter(d => d.date);
  return <dialog ref={dialog} aria-labelledby="review-heading" className="calendar-dialog" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="review-heading"><div><p className="panel-eyebrow mb-1">SUGGESTED ACTION</p><h2 id="review-heading" className="text-xl font-semibold text-brand-950 flex items-center gap-2"><CalendarDays size={21} />Review calendar event</h2></div><button disabled={busy} className="icon-button" aria-label="Close calendar review" onClick={onClose}><X size={19} /></button></div>
    <div className="review-body">
      <section className="review-source" aria-label="Source screenshot">
        <p className="text-xs font-semibold text-brand-800 mb-3 break-words">{screenshot.name}</p>
        {imageUrl && <img src={imageUrl} alt={`Source: ${screenshot.name}`} className="w-full max-h-[45vh] object-contain rounded-lg bg-white border border-brand-100" />}
        <p className="panel-eyebrow mt-5 mb-2">WHY THIS WAS SUGGESTED</p>
        <p className="text-xs text-stone-600 leading-relaxed mb-2">Detected locally from these lines:</p>
        <blockquote className="text-sm text-brand-950 border-l-2 border-brand-300 pl-3 space-y-2 break-words">{suggestion.evidence.map((line, i) => <p key={i}>{line}</p>)}</blockquote>
        <details className="mt-4 text-xs text-stone-600"><summary className="cursor-pointer font-medium">View extracted text</summary><pre className="whitespace-pre-wrap break-words font-sans mt-2 max-h-52 overflow-auto">{sourceText}</pre></details>
      </section>
      <form className="review-form" onSubmit={submit}>
        <div className="rounded-xl bg-blush-100/60 border border-blush-200 p-3 mb-4"><p className="text-sm font-medium text-brand-950">Check the details before adding them.</p><ul className="mt-2 space-y-1 list-disc pl-4 text-xs leading-relaxed text-stone-600">{suggestion.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>
        {(error || stale) && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm mb-4">{stale ? 'This screenshot has changed. Close this form and review the latest suggestion.' : error}</p>}
        <label className="review-label">Event title<input required maxLength={300} value={form.title} onChange={e => update('title', e.target.value)} className="review-input" /></label>
        <fieldset className="mb-4"><legend className="text-xs font-semibold text-brand-900 mb-2">Event type</legend><div className="flex gap-4 text-sm text-stone-700"><label className="flex items-center gap-2"><input type="radio" name="event-mode" required checked={form.mode === 'timed'} onChange={() => update('mode', 'timed')} />Timed event</label><label className="flex items-center gap-2"><input type="radio" name="event-mode" checked={form.mode === 'all-day'} onChange={() => update('mode', 'all-day')} />All-day event</label></div></fieldset>
        {dates.length > 0 && <label className="review-label">Dates detected in the screenshot<select className="review-input" defaultValue="" onChange={e => { const date = e.target.value; if (date) setForm(f => ({ ...f, startDate: date, endDate: date, confirmed: false })); }}><option value="">Choose a detected date, or enter one below</option>{dates.map((d, i) => <option key={i} value={d.date!}>{d.raw} — {d.date}</option>)}</select></label>}
        <div className="grid grid-cols-2 gap-3"><label className="review-label">Start date<input required type="date" min="1900-01-01" max="2199-12-31" className="review-input" value={form.startDate} onChange={e => update('startDate', e.target.value)} /></label><label className="review-label">{form.mode === 'all-day' ? 'Last day (included)' : 'End date'}<input required type="date" min={form.startDate || '1900-01-01'} max="2199-12-31" className="review-input" value={form.endDate} onChange={e => update('endDate', e.target.value)} /></label></div>
        {form.mode === 'timed' && <><div className="grid grid-cols-2 gap-3"><label className="review-label">Start time<input required type="time" className="review-input" value={form.startTime} onChange={e => update('startTime', e.target.value)} /></label><label className="review-label">End time<input required type="time" className="review-input" value={form.endTime} onChange={e => update('endTime', e.target.value)} /></label></div><div className="grid grid-cols-2 gap-3"><label className="review-label">Start UTC offset<input required placeholder="+05:30" className="review-input" value={form.startOffset} onChange={e => update('startOffset', e.target.value)} /></label><label className="review-label">End UTC offset<input required placeholder="+05:30" className="review-input" value={form.endOffset} onChange={e => update('endOffset', e.target.value)} /></label></div><p className="text-xs text-stone-500 -mt-1 mb-4 leading-relaxed">Initially based on your device ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Confirm the event’s offsets; travel and daylight-saving changes may use different ones.</p></>}
        <label className="review-label">Location <span className="font-normal text-stone-400">(optional)</span><input maxLength={500} className="review-input" value={form.location} onChange={e => update('location', e.target.value)} /></label>
        <label className="review-label">Notes to include <span className="font-normal text-stone-400">(optional)</span><textarea rows={2} maxLength={4000} className="review-input" placeholder="Only add details you want in your calendar." value={form.description} onChange={e => update('description', e.target.value)} /></label>
        <label className="flex gap-3 items-start text-sm text-stone-700 leading-relaxed mt-2"><input required type="checkbox" className="mt-1" checked={form.confirmed} onChange={e => update('confirmed', e.target.checked)} />I reviewed the title, dates and {form.mode === 'all-day' ? 'event details' : 'times, including UTC offsets'} against the screenshot.</label>
        <p className="text-xs text-stone-500 mt-3 leading-relaxed">Approval downloads a calendar file. Open it in your calendar to finish adding the event. Your screenshot is not included.</p>
        <div className="flex flex-wrap justify-end gap-3 mt-6"><button type="button" disabled={busy} onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100">Cancel</button><button type="submit" disabled={busy || !form.confirmed || stale} className="small-primary px-4 py-2.5 text-sm">{busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Approve & download</button></div>
      </form>
    </div>
  </dialog>;
}
