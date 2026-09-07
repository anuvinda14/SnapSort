import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FlaskConical, Download } from 'lucide-react';
import { errorRates } from '@/lib/benchmark/metrics';
import { runEngine } from '@/lib/benchmark/run';
import type { Engine, EngineResult } from '@/lib/benchmark/run';
interface Sample { id: string; file: File; url: string; kind: string; reference: string; results: Partial<Record<Engine, EngineResult | {error:string}>> }
const engines: Engine[] = ['tesseract', 'adaptive'];
export default function OcrLab() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const control = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => { control.current?.abort(); urls.current.forEach(URL.revokeObjectURL); }, []);
  function edit(id:string, patch:Partial<Sample>) { setSamples(all=>all.map(s=>s.id===id?{...s,...patch}:s)); }
  async function run() {
    if (control.current) return;
    const controller = new AbortController(); control.current = controller;
    const snapshot = samples; setError('');
    try {
      for (const sample of snapshot) {
        edit(sample.id,{results:{}});
        for (const engine of engines) {
          if (controller.signal.aborted) return;
          setBusy(`${engine === 'adaptive' ? 'Adaptive thresholding' : 'Tesseract'} · ${sample.file.name}`);
          let result: EngineResult | {error:string};
          try { result = await runEngine(engine,sample.file,controller.signal); }
          catch (e) { if (controller.signal.aborted) return; result={error:e instanceof Error?e.message:String(e)}; }
          setSamples(all=>all.map(s=>s.id===sample.id?{...s,results:{...s.results,[engine]:result}}:s));
        }
      }
    } finally { control.current=null; setBusy(''); }
  }
  function exportReport() {
    const report = { version:1, createdAt:new Date().toISOString(), preprocessing:'Tesseract Otsu (0) versus Sauvola (2); originals preserved; no colour masking', tesseractLanguage:'eng', normalization:'NFC; whitespace collapsed; case and punctuation preserved', memory:'not measured', samples:samples.map(s=>({name:s.file.name,kind:s.kind,bytes:s.file.size,reference:s.reference,results:Object.fromEntries(engines.map(e=>{const r=s.results[e];return [e,r && !('error' in r)?{...r,errors:errorRates(s.reference,r.text)}:r??null];}))})) };
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url; a.download='snapsort-ocr-comparison.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <main className="max-w-6xl mx-auto p-5 sm:p-8">
    <a href={window.location.pathname} className="inline-flex items-center gap-2 text-brand-700 text-sm"><ArrowLeft size={16}/>Back to library</a>
    <div className="flex items-center gap-3 mt-6"><FlaskConical className="text-brand-600"/><h1 className="text-3xl font-semibold">OCR comparison lab</h1></div>
    <p className="mt-3 text-stone-600 max-w-3xl">Compare original screenshots with standard Tesseract and Tesseract with adaptive thresholding. Add the correct transcription to measure recognition errors. This experiment does not change your library or its default OCR engine.</p>
    <div className="rounded-xl border border-brand-100 bg-white p-4 my-5 text-sm space-y-2"><p>Models download on first use; recognition runs in browser workers. Each engine runs separately. Setup, recognition and total elapsed time are reported separately; memory is not measured.</p><p>Include printed text, highlighted notes, handwriting and calligraphy. These labels describe your samples; annotation understanding is not implemented here. Both options use the same English OCR model; only thresholding changes. Adaptive processing may help some backgrounds but is not guaranteed to improve handwriting or calligraphy.</p><p>No additional OCR engine is required. Your original screenshots stay unchanged.</p></div>
    <div className="flex flex-wrap items-center gap-3 mb-5"><label className="small-primary text-sm cursor-pointer">Add test screenshots<input aria-label="Add test screenshots" disabled={!!busy} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={e=>{
      const files=Array.from(e.target.files??[]);e.target.value='';setError('');
      if(samples.length+files.length>20){setError('Use up to 20 screenshots per comparison.');return;}
      if(files.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>15*1024*1024)){setError('Choose PNG, JPEG or WebP images smaller than 15 MB each.');return;}
      setSamples(all=>[...all,...files.map(file=>{const url=URL.createObjectURL(file);urls.current.push(url);return {id:crypto.randomUUID(),file,url,kind:'printed',reference:'',results:{}};})]);
    }}/></label><button className="small-primary text-sm" disabled={!samples.length||!!busy} onClick={()=>void run()}>Compare both modes</button>{busy&&<button className="text-sm underline" onClick={()=>control.current?.abort()}>Cancel</button>}<button className="inline-flex gap-2 text-sm text-brand-700" disabled={!!busy||!samples.some(s=>Object.keys(s.results).length)} onClick={exportReport}><Download size={16}/>Export report</button></div>
    {busy&&<p role="status" className="mb-4 text-brand-700">Running {busy}… First downloads can take several minutes.</p>}{error&&<p role="alert" className="text-red-700 mb-4">{error}</p>}
    <p className="text-xs text-stone-500 mb-5">Reports include filenames, correct transcriptions and recognised text. They are downloaded locally. Samples and results stay only in this tab until export; reloading clears the comparison. Lower character/word error rates are better and can exceed 100% when extra text is produced.</p>
    <div className="space-y-6">{samples.map(sample=><article key={sample.id} className="rounded-2xl bg-white border border-brand-100 p-4 sm:p-6">
      <div className="flex justify-between gap-3 mb-3"><h2 className="font-semibold break-all">{sample.file.name}</h2><button disabled={!!busy} className="text-sm text-stone-500" onClick={()=>{URL.revokeObjectURL(sample.url);setSamples(all=>all.filter(s=>s.id!==sample.id));}}>Remove</button></div>
      <div className="grid md:grid-cols-3 gap-5"><div><img src={sample.url} alt={sample.file.name} className="w-full h-52 object-contain border rounded-lg"/><label className="review-label mt-3">Sample type<select disabled={!!busy} value={sample.kind} onChange={e=>edit(sample.id,{kind:e.target.value})} className="review-input">{['printed','highlighted','handwriting','calligraphy','mixed'].map(k=><option key={k}>{k}</option>)}</select></label><label className="review-label">Correct transcription<textarea maxLength={5000} disabled={!!busy} rows={5} className="review-input" value={sample.reference} placeholder="Type the exact visible words in reading order." onChange={e=>edit(sample.id,{reference:e.target.value})}/></label></div>
      {engines.map(engine=>{const r=sample.results[engine];const rates=r&&!('error' in r)?errorRates(sample.reference,r.text):null;return <section key={engine} className="min-w-0"><h3 className="font-semibold text-brand-800 mb-3">{engine==='adaptive'?'Tesseract · Adaptive':'Tesseract · English'}</h3>{!r?<p className="text-sm text-stone-500">Not run yet.</p>:'error' in r?<p role="alert" className="text-sm text-red-700 break-words">{r.error}</p>:<><p className="text-xs text-stone-500">Setup: {Math.round(r.setupMs)} ms · OCR: {Math.round(r.inferenceMs)} ms · Total: {Math.round(r.elapsedMs)} ms</p><p className="text-sm my-3 font-medium">{rates?`Character errors: ${(rates.cer*100).toFixed(1)}% · Word errors: ${(rates.wer*100).toFixed(1)}%`:'Add a transcription to calculate errors (very long results are not scored).'}</p><pre className="font-sans whitespace-pre-wrap break-words text-sm max-h-96 overflow-auto bg-blush-50 p-3 rounded-lg">{r.text||'(No text recognised)'}</pre></>}</section>;})}</div>
    </article>)}</div>
  </main>;
}
