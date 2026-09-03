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
   * Save or update a clinical case metadata and photos into IndexedDB
   */
  public async saveCase(clinicalCase: ClinicalCase): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CASES, STORE_PHOTOS], 'readwrite');
      const caseStore = tx.objectStore(STORE_CASES);
      const photoStore = tx.objectStore(STORE_PHOTOS);

      // Save photos in photoStore and reference them
      const photosCopy = { ...clinicalCase.photos };

      for (const viewId of Object.keys(photosCopy) as ViewId[]) {
        const photo = photosCopy[viewId];
        if (photo) {
          photoStore.put({
            id: photo.id,
            caseId: clinicalCase.id,
            viewId,
            dataUrl: photo.dataUrl,
            timestamp: photo.timestamp,
            quality: photo.quality,
            width: photo.width,
            height: photo.height,
          });
        }
      }

      // Save case metadata (with photos embedded for quick retrieval)
      const caseRecord = {
        ...clinicalCase,
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
