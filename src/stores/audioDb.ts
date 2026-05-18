// IndexedDB helper for storing audio files
const DB_NAME = 'wordshot-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio-files';

export async function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function saveAudioToDb(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  console.log('[audioDb] saveAudioToDb called, byteLength:', arrayBuffer.byteLength, 'mimeType:', mimeType);
  const db = await openAudioDb();
  const key = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const blob = new Blob([arrayBuffer], { type: mimeType });

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, blob });

    request.onerror = () => {
      console.error('[audioDb] saveAudioToDb error:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('[audioDb] saveAudioToDb success, key:', key);
      db.close();
      resolve(key);
    };
  });
}

export async function getAudioBlobUrl(key: string): Promise<string | null> {
  console.log('[audioDb] getAudioBlobUrl called, key:', key);
  const db = await openAudioDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => {
      console.error('[audioDb] getAudioBlobUrl error:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('[audioDb] getAudioBlobUrl success, result:', request.result ? 'exists' : 'null');
      db.close();
      if (request.result?.blob) {
        const blobUrl = URL.createObjectURL(request.result.blob);
        console.log('[audioDb] Blob URL created:', blobUrl);
        resolve(blobUrl);
      } else {
        resolve(null);
      }
    };
  });
}

export async function deleteAudioFromDb(key: string): Promise<void> {
  const db = await openAudioDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}
