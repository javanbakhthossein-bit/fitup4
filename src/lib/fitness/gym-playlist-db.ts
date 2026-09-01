/**
 * IndexedDB persistence for Gym Mode playlist.
 *
 * Object URLs created via `URL.createObjectURL(file)` are NOT persistent —
 * they die when the page reloads. To make the playlist survive across
 * sessions, we store the raw audio `Blob` in IndexedDB and re-create the
 * object URL each time Gym Mode is opened.
 *
 * API:
 *  - saveTrackToDB({ id, name, blob })
 *  - loadTracksFromDB() -> [{ id, name, blob }]
 *  - deleteTrackFromDB(id)
 *  - clearAllTracksFromDB()
 *
 * All functions are SSR-safe (they no-op when `indexedDB` is undefined, e.g.
 * during Next.js server rendering) so they can be called from effects without
 * extra guards.
 */

const DB_NAME = "fitap_gym_playlist";
const DB_VERSION = 1;
const STORE = "tracks";

export interface StoredTrack {
  id: string;
  name: string;
  blob: Blob;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTrackToDB(track: StoredTrack): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(track);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[gym-playlist-db] saveTrackToDB failed", e);
  }
}

export async function loadTracksFromDB(): Promise<StoredTrack[]> {
  if (!isBrowser()) return [];
  try {
    const db = await openDB();
    const result = await new Promise<StoredTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as StoredTrack[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn("[gym-playlist-db] loadTracksFromDB failed", e);
    return [];
  }
}

export async function deleteTrackFromDB(id: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[gym-playlist-db] deleteTrackFromDB failed", e);
  }
}

export async function clearAllTracksFromDB(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[gym-playlist-db] clearAllTracksFromDB failed", e);
  }
}
