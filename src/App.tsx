import { useDuplicates } from '@/hooks/useDuplicates';
import { DuplicateReview } from '@/components/DuplicateReview';
import { ImproveRecognition } from '@/components/ImproveRecognition';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Search,
  Trash2,
  X,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileImage,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import type { Screenshot, ScreenshotStatus, OcrProgress } from '@/types';
import { dbGetAll, dbPut, dbDelete, dbClear, dbAcceptOcr, dbPatch, dbDeleteDuplicates } from '@/lib/db';
import { recognize, preloadWorker, resetWorker } from '@/lib/ocr';
import { makeThumbnail, formatBytes, formatTime } from '@/lib/image';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import { useScreenshotInsights } from '@/hooks/useScreenshotInsights';
import { InsightsPanel } from '@/components/InsightsPanel';
import { CalendarReview } from '@/components/CalendarReview';
import type { CalendarSuggestion } from '@/insights-types';

const ACCEPTED = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
const INIT_TIMEOUT_MS = 60_000;

type OcrInitState = 'loading' | 'ready' | 'error';

export default function App() {
  const [items, setItems] = useState<Screenshot[]>([]);
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'semantic' | 'text'>('semantic');
  const [selected, setSelected] = useState<Screenshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [ocrInit, setOcrInit] = useState<OcrInitState>('loading');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const semantic = useSemanticSearch(items, query, searchMode === 'semantic', !loading);

  const duplicates = useDuplicates(items, !loading);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const panel = useScreenshotInsights(items, !loading);
  const [review, setReview] = useState<CalendarSuggestion | null>(null);
  const [notice, setNotice] = useState('');

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const all = await dbGetAll();
        setItems(all);
      } catch (e) {
        console.error('Failed to load from IndexedDB', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const initOcr = useCallback(() => {
    setOcrInit('loading');
    setOcrError(null);
    setOcrProgress(null);

    const timeoutId = setTimeout(() => {
      setOcrInit('error');
      setOcrError('Timed out while downloading OCR language data. Check your connection and retry.');
      resetWorker();
    }, INIT_TIMEOUT_MS);

    preloadWorker((p) => setOcrProgress(p))
      .then(() => {
        clearTimeout(timeoutId);
        setOcrInit('ready');
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        setOcrInit('error');
        setOcrError(
          e instanceof Error
            ? e.message
            : 'Failed to initialize the OCR engine.'
        );
        resetWorker();
      });
  }, []);

  // Preload OCR worker on mount
  useEffect(() => {
    initOcr();
  }, [initOcr]);

  const updateItem = useCallback(async (id: string, patch: Partial<Screenshot>) => {
    const updated = await dbPatch(id, patch);
    if (updated) setItems(all => all.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (ocrInit !== 'ready') return;
    processingRef.current = true;
    try {
      let snapshot = await dbGetAll();
      while (true) {
        const next = snapshot.find((s) => s.status === 'queued');
        if (!next) break;
        await updateItem(next.id, { status: 'processing', progress: 0, error: undefined });
        try {
          const text = await recognize(next.blob, (p) => {
            setItems(all => all.map(item => item.id === next.id ? { ...item, progress: p.progress } : item));
          });
          await updateItem(next.id, { status: 'ready', text, progress: 1 });
        } catch (e) {
          await updateItem(next.id, {
            status: 'failed',
            error: e instanceof Error ? e.message : 'OCR failed',
          });
        }
        snapshot = await dbGetAll();
      }
    } finally {
      processingRef.current = false;
    }
  }, [updateItem, ocrInit]);

  // When OCR becomes ready, kick off any queued items
  useEffect(() => {
    if (ocrInit === 'ready') {
      processQueue();
    }
  }, [ocrInit, processQueue]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const valid: Screenshot[] = [];
      for (const file of Array.from(files)) {
        const okType =
          file.type === 'image/png' ||
          file.type === 'image/jpeg' ||
          file.type === 'image/webp';
        if (!okType) continue;
        const thumb = await makeThumbnail(file).catch(() => '');
        const item: Screenshot = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file,
          thumbnailUrl: thumb,
          createdAt: Date.now(),
          status: 'queued',
          text: '',
          progress: 0,
        };
        valid.push(item);
      }
      if (valid.length === 0) return;
      for (const item of valid) {
        await dbPut(item);
      }
      setItems((prev) => [...valid, ...prev]);
      processQueue();
    },
    [processQueue]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await dbDelete(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
    },
    [selected]
  );

  const handleClear = useCallback(async () => {
    await dbClear();
    setItems([]);
    setSelected(null);
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }, []);

  const handleRetry = useCallback(
    async (id: string) => {
      await updateItem(id, { status: 'queued', error: undefined, progress: 0 });
      processQueue();
    },
    [updateItem, processQueue]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const exact = items.filter((s) => s.text.toLowerCase().includes(q));
    if (searchMode === 'text' || semantic.error) return exact;
    const ranked = semantic.matches.map(m => items.find(s => s.id === m.id)).filter((s): s is Screenshot => !!s);
    return [...exact, ...ranked.filter(s => !exact.some(e => e.id === s.id))];
  }, [items, query, searchMode, semantic.matches, semantic.error]);

  const categoryIds = new Set(panel.filteredItems.map(s => s.id));
  const displayed = filtered.filter(s => categoryIds.has(s.id));
  const reviewSource = review ? items.find(s => s.id === review.screenshotId) : null;

  const counts = useMemo(() => {
    const c: Record<ScreenshotStatus, number> = {
      queued: 0,
      processing: 0,
      ready: 0,
      failed: 0,
    };
    for (const s of items) c[s.status]++;
    return c;
  }, [items]);

  return (
    <div className="app-shell bg-blush-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-blush-50/90 backdrop-blur-md border-b border-brand-100">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src="/snapsort-logo.png" alt="SnapSort logo" className="w-16 h-16 rounded-2xl object-contain" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-800">
                  SnapSort
                </h1>
                <p className="text-sm text-stone-500 -mt-0.5">
                  Find what you remember.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDuplicates(true)} className="text-sm font-medium text-brand-700 px-3 py-2 rounded-lg hover:bg-brand-50">Duplicates{duplicates.groups.length ? ` (${duplicates.groups.length})` : ''}</button>
              <a href="?ocr-lab" className="text-sm font-medium text-brand-700 px-3 py-2 rounded-lg hover:bg-brand-50">OCR lab</a>
              {items.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-sm font-medium text-stone-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear library
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="snapsort-workspace">
      <main className="library-pane">
        <div className="mb-7 sm:mb-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 mb-2">Your private screenshot library</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-brand-950">A little less scrolling.<br className="sm:hidden" /> A lot more remembering.</h2>
          <p className="text-stone-600 mt-3 max-w-2xl text-sm sm:text-base">Keep the things you save close. Find them with a few words, with search that runs on your device.</p>
        </div>
        {/* OCR status banner */}
        {ocrInit === 'loading' && (
          <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-brand-900">
                Setting up OCR engine — downloading language data on first use.
              </p>
              {ocrProgress && (
                <p className="text-brand-700 text-xs mt-0.5">
                  {ocrProgress.status}{' '}
                  {ocrProgress.progress > 0
                    ? `${Math.round(ocrProgress.progress * 100)}%`
                    : ''}
                </p>
              )}
            </div>
          </div>
        )}
        {ocrInit === 'error' && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-medium text-red-900">
                OCR setup failed.
              </p>
              {ocrError && (
                <p className="text-red-700 text-xs mt-0.5">{ocrError}</p>
              )}
            </div>
            <button
              onClick={initOcr}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <RotateCw className="w-4 h-4" />
              Retry setup
            </button>
          </div>
        )}

        {/* Import + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            <Upload className="w-5 h-5 opacity-90" />
            <span className="text-[17px]">Import screenshots</span>
          </button>
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'semantic' ? 'Try “bike repair bill” or “beginner coding notes”…' : 'Search exact words or numbers…'}
              aria-label="Search screenshots"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-brand-100 bg-white text-brand-950 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
            />
          </div>
        </div>

        {/* Version label + stats */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <button onClick={() => setSearchMode('semantic')} aria-pressed={searchMode === 'semantic'} className={searchMode === 'semantic' ? 'text-brand-700 font-bold' : ''}>Semantic search</button>
            <span className="text-stone-300">·</span>
            <button onClick={() => setSearchMode('text')} aria-pressed={searchMode === 'text'} className={searchMode === 'text' ? 'text-brand-700 font-bold' : ''}>Text search</button>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-stone-500">
              <StatusPill icon={<Clock className="w-3 h-3" />} label="Queued" count={counts.queued} color="stone" />
              <StatusPill icon={<Loader2 className="w-3 h-3" />} label="Processing" count={counts.processing} color="purple" />
              <StatusPill icon={<CheckCircle2 className="w-3 h-3" />} label="Ready" count={counts.ready} color="green" />
              <StatusPill icon={<AlertCircle className="w-3 h-3" />} label="Failed" count={counts.failed} color="red" />
            </div>
          )}
        </div>

        {searchMode === 'semantic' && (
          <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900" role="status">
            {semantic.error ? (
              <><p>Semantic search unavailable. Showing exact-text matches.</p><p className="text-xs mt-1 break-words">{semantic.error}</p><button className="mt-2 font-semibold underline" onClick={semantic.retry}>Retry semantic setup</button></>
            ) : (
              <><p>{semantic.searching ? 'Searching by meaning…' : semantic.status}</p>
              {!semantic.indexed && <p className="text-xs mt-1">First setup downloads a small model. Images and searches stay on this device.</p>}
              {semantic.indexed && query.trim() && !semantic.searching && <p className="text-xs mt-1">Closest matches · {semantic.elapsed} ms model search. Results are suggestions, not guaranteed matches.</p>}</>
            )}
          </div>
        )}
        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
          </div>
        ) : searchMode === 'semantic' && !semantic.error && query.trim() && (!semantic.indexed || semantic.searching) ? (
          <div className="flex items-center justify-center gap-3 py-20 text-brand-700"><Loader2 className="w-6 h-6 animate-spin" />{semantic.indexed ? 'Finding related screenshots…' : 'Preparing search…'}</div>
        ) : displayed.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onImport={() => fileInputRef.current?.click()} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayed.map((s) => (
              <ScreenshotCard
                key={s.id}
                screenshot={s}
                onClick={() => setSelected(s)}
                onDelete={() => handleDelete(s.id)}
                onRetry={() => handleRetry(s.id)}
              />
            ))}
          </div>
        )}
      </main>
      <InsightsPanel panel={panel} total={items.length} onReview={setReview} />
      </div>
      {notice && <div role="status" className="fixed bottom-5 left-5 right-5 sm:right-auto sm:max-w-lg z-40 bg-brand-950 text-white rounded-xl p-4 shadow-lg flex items-center gap-3 text-sm">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={18} /></button></div>}
      {review && reviewSource && <CalendarReview key={review.id} suggestion={review} screenshot={reviewSource} onClose={() => setReview(null)} onApprove={async event => {
        await panel.approveCalendar(review.id, event, { approved: true });
        setNotice('Calendar file prepared. Open the downloaded file in your calendar to add the event.');
      }} />}

      {showDuplicates && <DuplicateReview items={items} data={duplicates} onClose={() => setShowDuplicates(false)} onDelete={async (ids, group) => {
        await dbDeleteDuplicates(ids, group);
        setItems(all => all.filter(item => !ids.includes(item.id)));
        if (selected && ids.includes(selected.id)) setSelected(null);
      }} />}
      {/* Detail modal */}
      {selected && (
        <DetailModal
          screenshot={items.find(s => s.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onCopy={handleCopy}
          onRetry={() => handleRetry(selected.id)}
          onAcceptImproved={async (expected, text) => {
            const updated = await dbAcceptOcr(selected.id, expected, text);
            setItems(all => all.map(item => item.id === updated.id ? updated : item));
          }}
          copied={copied}
        />
      )}
    </div>
  );
}

function StatusPill({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'stone' | 'purple' | 'green' | 'red';
}) {
  if (count === 0) return null;
  const colors = {
    stone: 'bg-stone-100 text-stone-600',
    purple: 'bg-brand-100 text-brand-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${colors[color]}`}>
      {icon}
      {label} {count}
    </span>
  );
}

function ScreenshotCard({
  screenshot: s,
  onClick,
  onDelete,
  onRetry,
}: {
  screenshot: Screenshot;
  onClick: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-white border border-brand-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div onClick={onClick} className="aspect-[4/3] bg-stone-100 overflow-hidden">
        {s.thumbnailUrl ? (
          <img
            src={s.thumbnailUrl}
            alt={s.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileImage className="w-8 h-8 text-stone-300" />
          </div>
        )}
      </div>

      {/* Status overlay */}
      {(s.status === 'queued' || s.status === 'processing') && (
        <div className="absolute inset-0 bg-stone-900/40 flex flex-col items-center justify-center gap-2">
          {s.status === 'processing' ? (
            <>
              <Loader2 className="w-6 h-6 text-white animate-spin" />
              <span className="text-xs text-white font-medium">
                {Math.round(s.progress * 100)}%
              </span>
            </>
          ) : (
            <>
              <Clock className="w-6 h-6 text-white" />
              <span className="text-xs text-white font-medium">Queued</span>
            </>
          )}
        </div>
      )}
      {s.status === 'failed' && (
        <div className="absolute inset-0 bg-red-900/50 flex flex-col items-center justify-center gap-1.5 px-2 text-center">
          <AlertCircle className="w-6 h-6 text-white" />
          <span className="text-xs text-white font-medium">Failed</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-white bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md transition-colors"
          >
            <RotateCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-stone-700 truncate" title={s.name}>
          {s.name}
        </p>
        <p className="text-[11px] text-stone-400">{formatTime(s.createdAt)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
        aria-label="Delete screenshot"
      >
        <Trash2 className="w-3.5 h-3.5 text-stone-600 hover:text-red-600" />
      </button>
    </div>
  );
}

function EmptyState({
  hasItems,
  onImport,
}: {
  hasItems: boolean;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
        <Camera className="w-8 h-8 text-brand-600" />
      </div>
      <h2 className="text-lg font-semibold text-stone-800 mb-1">
        {hasItems ? 'No matches found' : 'No screenshots yet'}
      </h2>
      <p className="text-sm text-stone-500 max-w-sm mb-5">
        {hasItems
          ? 'Try a different search term. Search matches extracted text from your screenshots.'
          : 'Import PNG, JPG, or WebP screenshots and SnapSort will extract their text locally — nothing leaves your device.'}
      </p>
      {!hasItems && (
        <button
          onClick={onImport}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white font-semibold shadow-sm hover:bg-brand-700 active:scale-[0.98] transition-all"
        >
          <Upload className="w-5 h-5" />
          Import screenshots
        </button>
      )}
    </div>
  );
}

function DetailModal({
  screenshot: s,
  onClose,
  onDelete,
  onCopy,
  onRetry,
  copied,
  onAcceptImproved,
}: {
  screenshot: Screenshot;
  onClose: () => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
  onRetry: () => void;
  copied: boolean;
  onAcceptImproved: (expected: string, text: string) => Promise<void>;
}) {
  const [imgUrl, setImgUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(s.blob);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [s.blob]);

  return (
    <div
      className="fixed inset-0 z-30 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-blush-50 w-full sm:max-w-4xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-100 bg-white">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate" title={s.name}>
              {s.name}
            </p>
            <p className="text-xs text-stone-400">
              {formatBytes(s.size)} · {formatTime(s.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDelete}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row overflow-y-auto scrollbar-thin">
          {/* Image */}
          <div className="md:w-1/2 bg-stone-900 flex items-center justify-center p-3 min-h-[200px]">
            {imgUrl && (
              <img
                src={imgUrl}
                alt={s.name}
                className="max-w-full max-h-[50vh] md:max-h-[78vh] object-contain rounded-lg"
              />
            )}
          </div>

          {/* Text panel */}
          <div className="md:w-1/2 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                Extracted text
              </h3>
              {s.status === 'ready' && s.text && (
                <button
                  onClick={() => onCopy(s.text)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy text
                    </>
                  )}
                </button>
              )}
            </div>

            {s.status === 'ready' && <ImproveRecognition key={s.id} screenshot={s} onAccept={onAcceptImproved} />}

            {s.status === 'processing' && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                <p className="text-sm text-stone-500">
                  Extracting text… {Math.round(s.progress * 100)}%
                </p>
              </div>
            )}
            {s.status === 'queued' && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Clock className="w-6 h-6 text-stone-400" />
                <p className="text-sm text-stone-500">Queued for processing…</p>
              </div>
            )}
            {s.status === 'failed' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-stone-700">OCR failed</p>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs">
                    {s.error || 'Unknown error'}
                  </p>
                </div>
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-4 py-2 rounded-lg transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                  Retry OCR
                </button>
              </div>
            )}
            {s.status === 'ready' && (
              <>
                {s.text ? (
                  <pre className="text-sm text-stone-700 whitespace-pre-wrap break-words font-sans leading-relaxed flex-1 overflow-y-auto scrollbar-thin bg-white rounded-lg border border-brand-100 p-4">
                    {s.text}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                    <FileImage className="w-6 h-6 text-stone-300" />
                    <p className="text-sm text-stone-500">
                      No text detected in this screenshot.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
