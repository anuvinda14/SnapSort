import type { SuggestionDecision } from '@/insights-types';

async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('snapsort-suggestions', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('decisions', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readDecisions(): Promise<SuggestionDecision[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('decisions', 'readonly');
    const req = tx.objectStore('decisions').getAll();
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cannot read suggestion decisions.')); };
  });
}

export async function saveDecision(decision: SuggestionDecision): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('decisions', 'readwrite');
    tx.objectStore('decisions').put(decision);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cannot save suggestion decision.')); };
  });
}

export async function deleteDecision(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('decisions', 'readwrite');
    tx.objectStore('decisions').delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cannot reset suggestion.')); };
  });
}

export async function pruneDecisions(valid: { id: string; sourceText: string }[]): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('decisions', 'readwrite');
    const req = tx.objectStore('decisions').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const value = cursor.value as SuggestionDecision;
      if (!valid.some(s => s.id === value.id && s.sourceText === value.sourceText)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Cannot clean up suggestion decisions.')); };
  });
}
