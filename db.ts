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
