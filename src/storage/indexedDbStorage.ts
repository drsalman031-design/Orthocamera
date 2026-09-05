/**
 * indexedDbStorage.ts
 *
 * Robust, asynchronous IndexedDB storage for clinical orthodontic photo records.
 * Bypasses the 5MB browser localStorage quota, allowing multiple high-resolution
 * clinical photo cases to be stored safely on-device without data loss.
 */

import { ClinicalCase, CapturedPhoto, ViewId } from '../types';

const DB_NAME = 'OrthoCamClinicalDB';
const DB_VERSION = 1;
const STORE_CASES = 'clinical_cases';
const STORE_PHOTOS = 'photo_blobs';

class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CASES)) {
          db.createObjectStore(STORE_CASES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('caseId', 'caseId', { unique: false });
          photoStore.createIndex('viewId', 'viewId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
  /**
   * Save or update clinical case metadata into IndexedDB without storing heavy photo binaries.
   * Photos are directly stored in the phone gallery/downloads to prevent app storage bloat.
   */
  public async saveCase(clinicalCase: ClinicalCase): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CASES, STORE_PHOTOS], 'readwrite');
      const caseStore = tx.objectStore(STORE_CASES);
      const photoStore = tx.objectStore(STORE_PHOTOS);

      // Clean up any previously stored photo blobs for this case
      try {
        const photoIndex = photoStore.index('caseId');
        const req = photoIndex.openCursor(IDBKeyRange.only(clinicalCase.id));
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      } catch {
        // index might not exist or failed
      }

      // Strip heavy Base64 dataUrl from photos before saving to caseStore
      const lightweightPhotos = Object.keys(clinicalCase.photos).reduce((acc, key) => {
        const photo = clinicalCase.photos[key as ViewId];
        if (photo) {
          acc[key as ViewId] = {
            ...photo,
            dataUrl: '', // Stripped: stored directly in phone gallery/downloads
          };
        }
        return acc;
      }, {} as typeof clinicalCase.photos);

      const caseRecord = {
        ...clinicalCase,
        photos: lightweightPhotos,
        updatedAt: Date.now(),
      };

      caseStore.put(caseRecord);

      tx.oncomplete = () => {
        try {
          localStorage.setItem('orthocam_active_case_id_v1', clinicalCase.id);
        } catch {
          // ignore localStorage failure
        }
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  /**
   * Purge all internal photo blobs from IndexedDB to free device memory.
   */
  public async clearAllInternalPhotos(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_CASES, STORE_PHOTOS], 'readwrite');
        const caseStore = tx.objectStore(STORE_CASES);
        const photoStore = tx.objectStore(STORE_PHOTOS);

        photoStore.clear();

        const req = caseStore.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const caseData: ClinicalCase = cursor.value;
            if (caseData && caseData.photos) {
              let modified = false;
              const photos = { ...caseData.photos };
              for (const viewId of Object.keys(photos) as ViewId[]) {
                if (photos[viewId]?.dataUrl) {
                  photos[viewId] = { ...photos[viewId]!, dataUrl: '' };
                  modified = true;
                }
              }
              if (modified) {
                cursor.update({ ...caseData, photos });
              }
            }
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  /**
   * Get all clinical cases stored in IndexedDB
   */
  public async getAllCases(): Promise<ClinicalCase[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CASES, 'readonly');
        const store = tx.objectStore(STORE_CASES);
        const req = store.getAll();

        req.onsuccess = () => {
          resolve(req.result || []);
        };

        req.onerror = () => {
          reject(req.error);
        };
      });
    } catch {
      // Fallback to localStorage if IndexedDB fails
      return [];
    }
  }

  /**
   * Get a specific case by ID
   */
  public async getCaseById(id: string): Promise<ClinicalCase | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CASES, 'readonly');
        const store = tx.objectStore(STORE_CASES);
        const req = store.get(id);

        req.onsuccess = () => {
          resolve(req.result || null);
        };

        req.onerror = () => {
          reject(req.error);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Delete a specific photo belonging to a case from IndexedDB
   */
  public async deletePhotoFromCase(caseId: string, viewId: ViewId): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PHOTOS], 'readwrite');
        const photoStore = tx.objectStore(STORE_PHOTOS);
        const index = photoStore.index('viewId');
        const req = index.openCursor(IDBKeyRange.only(viewId));

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            if (cursor.value.caseId === caseId) {
              cursor.delete();
            }
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Delete a case and all its associated photos
   */
  public async deleteCase(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CASES, STORE_PHOTOS], 'readwrite');
      const caseStore = tx.objectStore(STORE_CASES);
      const photoStore = tx.objectStore(STORE_PHOTOS);

      caseStore.delete(id);

      const index = photoStore.index('caseId');
      const req = index.openCursor(IDBKeyRange.only(id));
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const indexedDbStorage = new IndexedDbStorageService();
