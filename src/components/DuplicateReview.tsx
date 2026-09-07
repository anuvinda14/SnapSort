import { useEffect,useRef,useState } from 'react';
import { X } from 'lucide-react';
import type { Screenshot } from '@/types';
import type { useDuplicates } from '@/hooks/useDuplicates';
import { formatBytes,formatTime } from '@/lib/image';
type Data=ReturnType<typeof useDuplicates>;
export function DuplicateReview({items,data,onClose,onDelete}:{items:Screenshot[];data:Data;onClose:()=>void;onDelete:(ids:string[],group:string[])=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState<Screenshot|null>(null),[url,setUrl]=useState('');
 useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close();},[]);
 useEffect(()=>{if(!preview){setUrl('');return;}const u=URL.createObjectURL(preview.blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[preview]);
 async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <dialog ref={dialog} className="calendar-dialog" aria-labelledby="duplicate-heading" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="review-heading"><h2 id="duplicate-heading" className="text-xl font-semibold">Review possible duplicates</h2><button aria-label="Close duplicate review" disabled={busy} onClick={onClose}><X/></button></div>
  <div className="p-5 space-y-5"><p className="text-sm text-stone-600">Similar pixels, not guaranteed identical content. Compare dates, amounts and annotations carefully. Groups can include chains of similar images. Nothing is selected or deleted automatically.</p>
  <p role="status" className="text-sm text-brand-700">{!data.ready?'Loading duplicate index…':data.remaining?`Checking ${data.remaining} screenshots…`:`${data.groups.length} possible duplicate groups`}</p>
  {(error||data.error)&&<p role="alert" className="text-red-700 text-sm">{error||data.error} <button className="underline" onClick={data.retry} disabled={busy}>Retry check</button></p>}
  {!!data.dismissed&&<button disabled={busy} className="text-sm underline text-brand-700" onClick={()=>void action(data.restore)}>Show dismissed groups ({data.dismissed})</button>}
  {data.ready&&!data.remaining&&!data.groups.length&&<p>No undismissed duplicate groups found.</p>}
  {data.groups.map(group=><Group key={JSON.stringify(group)} group={group} items={items.filter(i=>group.includes(i.id))} busy={busy} onPreview={setPreview} onDismiss={()=>action(()=>data.dismiss(group))} onDelete={ids=>action(()=>onDelete(ids,group))}/>)}
  {preview&&url&&<section className="border rounded-xl p-3"><div className="flex justify-between"><h3 className="font-medium break-all">{preview.name}</h3><button onClick={()=>setPreview(null)} className="text-sm underline">Close image</button></div><img src={url} alt={preview.name} className="w-full max-h-[65vh] object-contain mt-3"/></section>}
  </div>
 </dialog>;
}
function Group({group,items,busy,onPreview,onDismiss,onDelete}:{group:string[];items:Screenshot[];busy:boolean;onPreview:(s:Screenshot)=>void;onDismiss:()=>Promise<void>;onDelete:(ids:string[])=>Promise<void>}){
 const [selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false);
 return <section className="border border-brand-100 rounded-xl p-4"><h3 className="font-semibold mb-3">{items.length} similar screenshots</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{items.map(s=><div key={s.id} className="border rounded-xl p-2 min-w-0"><button className="w-full" onClick={()=>onPreview(s)} aria-label={`Enlarge ${s.name}`}><img src={s.thumbnailUrl} alt={s.name} className="h-40 w-full object-contain bg-blush-50"/></button><p className="text-sm break-all mt-2">{s.name}</p><p className="text-xs text-stone-500">{formatTime(s.createdAt)} · {formatBytes(s.size)}</p><label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" disabled={busy} checked={selected.includes(s.id)} onChange={e=>{setConfirm(false);setSelected(all=>e.target.checked?[...all,s.id]:all.filter(id=>id!==s.id));}}/>{selected.includes(s.id)?'Selected for deletion':'Keep'}</label></div>)}</div>
 <div className="mt-4 flex flex-wrap gap-4 items-center"><button disabled={busy||!selected.length||selected.length>=group.length} className="small-primary" onClick={()=>setConfirm(true)}>Review deletion ({selected.length})</button><button disabled={busy} className="text-sm underline text-brand-700" onClick={()=>void onDismiss()}>Not actually duplicates</button></div>
 {selected.length>=group.length&&<p className="text-sm text-red-700 mt-2">Leave at least one screenshot unchecked to keep.</p>}
 {confirm&&<div className="bg-red-50 border border-red-100 rounded-lg p-3 mt-3"><p className="text-sm">Delete these {selected.length} selected screenshots from SnapSort? This cannot be undone here. Files outside SnapSort are unaffected.</p><ul className="text-xs list-disc pl-5 my-2">{items.filter(s=>selected.includes(s.id)).map(s=><li key={s.id}>{s.name}</li>)}</ul><button disabled={busy} className="text-sm font-semibold text-red-700 mr-4" onClick={()=>void onDelete(selected)}>Confirm deletion</button><button disabled={busy} className="text-sm" onClick={()=>setConfirm(false)}>Cancel</button></div>}
 </section>;
}
