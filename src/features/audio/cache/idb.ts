// ============================================================================
// IndexedDB infra — pure. Phase TS-18.
//
// One database (`degzzy_media_v1`), one object store (`audio`). The keys
// follow a `<kind>_<trackId>` convention so audio + cover blobs coexist:
//   - audio:        `track_<id>`
//   - cover:        `cover_<id>`
//   - inspiration:  `inspi_<id>` (used by inline, exposed here for parity)
// ============================================================================

export const IDB_NAME = 'degzzy_media_v1';
export const IDB_STORE = 'audio';

/** Audio record shape stored under `track_<id>`. */
export interface IdbAudioRecord {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  savedAt: number;
}

/** Cover record shape stored under `cover_<id>`. */
export interface IdbCoverRecord {
  blob: Blob;
  type: string;
  size: number;
  savedAt: number;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

/** Open the (single) IndexedDB. Re-used across calls — only one upgrade ever fires. */
export function openIDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non supporté'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

/** Test hook: reset the cached db promise so a fresh open() fires next call. */
export function _resetIdbPromise(): void {
  _dbPromise = null;
}

/** Test hook: read the current db promise (null before first open()). */
export function _getIdbPromise(): Promise<IDBDatabase> | null {
  return _dbPromise;
}

// ---------------------------------------------------------------------------
// Internal helpers — wrap the IDBRequest event API as promises.
// ---------------------------------------------------------------------------
function _put(store: string, key: string, value: unknown): Promise<void> {
  return openIDB().then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function _get<T>(store: string, key: string): Promise<T | null> {
  return openIDB().then((db) => new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) || null);
    req.onerror = () => reject(req.error);
  }));
}

function _delete(store: string, key: string): Promise<void> {
  return openIDB().then((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// ---------------------------------------------------------------------------
// Audio operations (`track_<id>` keys)
// ---------------------------------------------------------------------------
export function idbSaveAudio(key: string, file: File): Promise<void> {
  const record: IdbAudioRecord = {
    blob: file,
    name: file.name,
    type: file.type,
    size: file.size,
    savedAt: Date.now(),
  };
  return _put(IDB_STORE, key, record);
}

export function idbGetAudio(key: string): Promise<IdbAudioRecord | null> {
  return _get<IdbAudioRecord>(IDB_STORE, key);
}

export function idbDeleteAudio(key: string): Promise<void> {
  return _delete(IDB_STORE, key);
}

// ---------------------------------------------------------------------------
// Cover operations (`cover_<id>` keys)
// ---------------------------------------------------------------------------
export function idbSaveCover(key: string, blob: Blob): Promise<void> {
  const record: IdbCoverRecord = {
    blob,
    type: blob.type,
    size: blob.size,
    savedAt: Date.now(),
  };
  return _put(IDB_STORE, 'cover_' + key, record);
}

export function idbGetCover(key: string): Promise<IdbCoverRecord | null> {
  return _get<IdbCoverRecord>(IDB_STORE, 'cover_' + key);
}

export function idbDeleteCover(key: string): Promise<void> {
  return _delete(IDB_STORE, 'cover_' + key);
}
