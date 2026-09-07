import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Screenshot } from '@/types';
import { runEngine } from '@/lib/benchmark/run';

export function ImproveRecognition({ screenshot, onAccept }: { screenshot: Screenshot; onAccept: (expected: string, text: string) => Promise<void> }) {
  const [candidate, setCandidate] = useState<{before:string;after:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController|null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function improve() {
    if (controller.current || saving) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true);setError('');setMessage('');setCandidate(null);
    const before=screenshot.text;
    try {
      const result=await runEngine('adaptive',screenshot.blob,abort.signal);
      if(!abort.signal.aborted) setCandidate({before,after:result.text});
    } catch(e) {if(!abort.signal.aborted)setError(e instanceof Error?e.message:String(e));}
    finally {if(controller.current===abort){controller.current=null;setBusy(false);}}
  }
  async function accept() {
    if (!candidate || saving) return;
    setSaving(true);setError('');
    try {await onAccept(candidate.before,candidate.after);setCandidate(null);setMessage('Text saved. Search, categories and suggestions will refresh.');}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally {setSaving(false);}
  }
  const stale=!!candidate&&candidate.before!==screenshot.text;
  return <section className="mt-4 border-t border-brand-100 pt-4" aria-label="Improve text recognition">
    {!candidate&&!busy&&<button onClick={()=>void improve()} disabled={saving} className="small-primary"><Sparkles size={15}/>Improve text recognition</button>}
    <p className="text-xs text-stone-500 mt-2">Tries adaptive processing on a copy. Review the result before replacing your text; it may be better or worse.</p>
    {busy&&<div role="status" className="flex gap-2 items-center text-sm text-brand-700 mt-3"><Loader2 size={16} className="animate-spin"/>Trying adaptive recognition…<button className="underline" onClick={()=>controller.current?.abort()}>Cancel</button></div>}
    {error&&<p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
    {message&&<p role="status" className="text-sm text-brand-700 mt-3">{message}</p>}
    {candidate&&<div className="mt-4">
      <div className="grid sm:grid-cols-2 gap-3">{[['Current text',candidate.before],['Adaptive result',candidate.after]].map(([title,text])=><div key={title} className="min-w-0"><h4 className="text-sm font-semibold mb-2">{title}</h4><pre className="font-sans text-sm whitespace-pre-wrap break-words bg-white rounded-lg p-3 border border-brand-100 max-h-72 overflow-auto">{text||'(No text recognised)'}</pre></div>)}</div>
      {stale&&<p role="alert" className="text-sm text-red-700 mt-2">The current text changed. Keep it and try again.</p>}
      {candidate.before.trim()===candidate.after.trim()&&<p className="text-sm text-stone-500 mt-2">Both results are identical.</p>}
      <div className="flex flex-wrap gap-3 mt-3"><button className="small-primary" disabled={saving||stale||!candidate.after.trim()||candidate.before.trim()===candidate.after.trim()} onClick={()=>void accept()}>{saving?'Saving…':'Use improved text'}</button><button disabled={saving} className="text-sm text-brand-700" onClick={()=>{setCandidate(null);setError('');}}>Keep current text</button></div>
    </div>}
  </section>;
}
