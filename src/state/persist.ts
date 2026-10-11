// Autosave the working session (project, source image, texture assets) to IndexedDB.

import type { Project } from '../engine/types';

const DB_NAME = 'effects-library';
const STORE = 'session';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  const v = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return v;
}

export interface SavedSession {
  project: Project;
  selectedLayerId: string | null;
  source: { name: string; blob: Blob } | null;
  assets: { id: string; name: string; blob: Blob }[];
  savedAt: number;
}

export async function saveSession(s: SavedSession): Promise<void> {
  try {
    await put('current', s);
  } catch (e) {
    console.warn('Autosave failed', e);
  }
}

export async function loadSession(): Promise<SavedSession | undefined> {
  try {
    return await get<SavedSession>('current');
  } catch {
    return undefined;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await put('current', undefined);
  } catch {
    // ignore
  }
}

/** Download the project (layers + crop) as JSON. Images are not embedded. */
export function projectToJson(p: Project, sourceName?: string): string {
  return JSON.stringify({ app: 'effects-library', version: 1, source: sourceName ?? null, project: p }, null, 2);
}
