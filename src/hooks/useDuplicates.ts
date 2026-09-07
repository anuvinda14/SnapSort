import { useEffect, useMemo, useRef, useState } from 'react';
import type { Screenshot } from '@/types';
import { clusterHashes, HASH_VERSION, isDismissed } from '@/lib/duplicates/core';
import type { ImageHash } from '@/lib/duplicates/core';
import { readHashes,readDismissals,saveHash,removeHash,dismissGroup,resetDismissals } from '@/lib/duplicates/storage';
export function useDuplicates(items:Screenshot[],loaded:boolean){
 const [hashes,setHashes]=useState<ImageHash[]>([]),[dismissals,setDismissals]=useState<string[][]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState(0),[retry,setRetry]=useState(0);
 const current=useRef(items);current.current=items;
 const ids=JSON.stringify(items.map(i=>i.id).sort());
 useEffect(()=>{let active=true;Promise.all([readHashes(),readDismissals()]).then(([h,d])=>{if(active){setHashes(h.filter(r=>r.version===HASH_VERSION));setDismissals(d.map(r=>r.ids));setReady(true);}}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[retry]);
 useEffect(()=>{
  if(!loaded||!ready)return;let active=true;let worker:Worker|null=null;let timer:ReturnType<typeof setTimeout>|undefined;
  const snapshot=current.current, valid=new Set(snapshot.map(i=>i.id));
  const cached=hashes.filter(h=>valid.has(h.id));setHashes(cached);
  const pending=snapshot.filter(i=>!cached.some(h=>h.id===i.id));setRemaining(pending.length);
  (async()=>{try{
   for(const old of hashes.filter(h=>!valid.has(h.id)))await removeHash(old.id);
   for(const item of pending){if(!active)return;
    try{
     const record=await new Promise<ImageHash>((resolve,reject)=>{
      worker=new Worker(new URL('../workers/duplicate.worker.ts',import.meta.url),{type:'module'});
      timer=setTimeout(()=>{worker?.terminate();reject(new Error('Image hashing timed out.'));},30000);
      worker.onmessage=({data})=>{clearTimeout(timer);worker?.terminate();data.error?reject(new Error(data.error)):resolve(data.record);};
      worker.onerror=e=>{clearTimeout(timer);worker?.terminate();reject(new Error(e.message));};worker.postMessage({id:item.id,blob:item.blob});
     });
     if(!active)return;await saveHash(record);if(!active)return;
     setHashes(all=>[...all.filter(h=>h.id!==record.id),record]);
    }catch(e){if(active)setError(`Some images could not be checked: ${String(e)}`);}
    if(active)setRemaining(n=>Math.max(0,n-1));
   }
  }catch(e){if(active)setError(String(e));}})();
  return()=>{active=false;clearTimeout(timer);worker?.terminate();};
 // Changes to OCR text/progress do not trigger hashing. Existing hashes are loaded once.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ids,loaded,ready,retry]);
 const groups=useMemo(()=>{const valid=new Set(JSON.parse(ids) as string[]);return clusterHashes(hashes.filter(h=>valid.has(h.id)));},[hashes,ids]);
 return {groups:groups.filter(g=>!isDismissed(g,dismissals)),dismissed:groups.filter(g=>isDismissed(g,dismissals)).length,remaining,error,ready,
  retry:()=>{setError('');setRetry(n=>n+1);},
  dismiss:async(g:string[])=>{await dismissGroup(g);setDismissals(all=>[...all,g]);},
  restore:async()=>{await resetDismissals();setDismissals([]);}};
}
