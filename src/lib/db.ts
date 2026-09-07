import type { Screenshot } from '@/types';

const DB_NAME = 'snapsort';
const DB_VERSION = 1;
const STORE = 'screenshots';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function dbGetAll(): Promise<Screenshot[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<Screenshot[]>);
}

export async function dbPut(item: Screenshot): Promise<void> {
  await tx('readwrite', (s) => s.put(item));
}

export async function dbDelete(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function dbClear(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}

// Compare and replace within one transaction, so a stale review cannot overwrite newer OCR.
export async function dbAcceptOcr(id: string, expectedText: string, text: string): Promise<Screenshot> {
  if (!text.trim()) throw new Error('No recognised text to save. Keep the current text instead.');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    let updated: Screenshot;
    let failure: Error | null = null;
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as Screenshot | undefined;
      if (!current || current.status !== 'ready' || current.text !== expectedText) {
        failure = new Error('This screenshot changed or was deleted. Close and reopen it before trying again.');
        transaction.abort(); return;
      }
      updated = { ...current, previousOcrText: current.text, text: text.trim(), ocrMethod: 'adaptive', progress: 1, error: undefined };
      store.put(updated);
    };
    transaction.oncomplete = () => { db.close(); resolve(updated); };
    transaction.onabort = () => { db.close(); reject(failure ?? transaction.error ?? new Error('Could not save the recognised text.')); };
    transaction.onerror = () => { failure ??= new Error('Could not save the recognised text.'); };
  });
}

export async function dbPatch(id: string, patch: Partial<Screenshot>): Promise<Screenshot | undefined> {
  const db=await openDb();return new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,'readwrite'),store=t.objectStore(STORE);let updated:Screenshot|undefined;
    const r=store.get(id);r.onsuccess=()=>{if(r.result){updated={...r.result,...patch,id};store.put(updated);}};
    t.oncomplete=()=>{db.close();resolve(updated);};t.onabort=()=>{db.close();reject(t.error??new Error('Could not update screenshot.'));};
  });
}
export async function dbDeleteDuplicates(ids:string[], group:string[]):Promise<void>{
  if(!ids.length||ids.some(id=>!group.includes(id))||new Set(ids).size>=new Set(group).size)throw new Error('Keep at least one screenshot in the group.');
  const db=await openDb();return new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,'readwrite'),store=t.objectStore(STORE);let found=0,checked=0;let failure:Error|null=null;
    for(const id of group){const r=store.get(id);r.onsuccess=()=>{if(r.result)found++;checked++;if(checked===group.length){if(found!==group.length){failure=new Error('This group changed. Close and reopen duplicate review.');t.abort();}else ids.forEach(id=>store.delete(id));}};}
    t.oncomplete=()=>{db.close();resolve();};t.onabort=()=>{db.close();reject(failure??t.error??new Error('Could not delete screenshots.'));};
  });
}
