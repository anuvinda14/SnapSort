import type { ImageHash } from '@/lib/duplicates/core';
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('snapsort-duplicates',1);r.onupgradeneeded=()=>{r.result.createObjectStore('hashes',{keyPath:'id'});r.result.createObjectStore('dismissals',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction<T>(name:string,mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(name,mode);const r=fn(t.objectStore(name));t.oncomplete=()=>{db.close();resolve(r.result);};t.onabort=()=>{db.close();reject(t.error??new Error('Duplicate storage failed.'));};});
}
export const readHashes=()=>transaction<ImageHash[]>('hashes','readonly',s=>s.getAll());
export const saveHash=(h:ImageHash)=>transaction('hashes','readwrite',s=>s.put(h));
export const removeHash=(id:string)=>transaction('hashes','readwrite',s=>s.delete(id));
export const readDismissals=()=>transaction<{key:string;ids:string[]}[]>('dismissals','readonly',s=>s.getAll());
export const dismissGroup=(ids:string[])=>transaction('dismissals','readwrite',s=>s.put({key:JSON.stringify([...ids].sort()),ids}));
export const resetDismissals=()=>transaction('dismissals','readwrite',s=>s.clear());
