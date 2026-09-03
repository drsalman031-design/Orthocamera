import { ClinicalCase, ViewId } from '../types';
import { indexedDbStorage } from './indexedDbStorage';

const ACTIVE_CASE_KEY = 'orthocam_active_case_id_v1';
const METADATA_KEY = 'orthocam_cases_meta_v1';

// In-memory cache for ultra-fast synchronous UI access
let cachedCases: ClinicalCase[] = [];
let isInitialized = false;

export class CaseStorage {
  /**
   * Initializes cache from IndexedDB
   */
  public static async init(): Promise<void> {
    if (isInitialized) return;
    try {
      cachedCases = await indexedDbStorage.getAllCases();
      isInitialized = true;
    } catch (err) {
      console.warn('Failed to load cases from IndexedDB, falling back to local storage:', err);
      try {
        const data = localStorage.getItem(METADATA_KEY);
        if (data) cachedCases = JSON.parse(data);
      } catch {
        cachedCases = [];
      }
    }
  }

  public static getAllCases(): ClinicalCase[] {
    return cachedCases;
  }

  public static getCaseById(id: string): ClinicalCase | null {
    return cachedCases.find((c) => c.id === id) || null;
  }

  public static saveCase(clinicalCase: ClinicalCase): void {
    const existingIdx = cachedCases.findIndex((c) => c.id === clinicalCase.id);
    const updatedCase = { ...clinicalCase, updatedAt: Date.now() };

    if (existingIdx >= 0) {
      cachedCases[existingIdx] = updatedCase;
    } else {
      cachedCases.unshift(updatedCase);
    }

    // Persist asynchronously in IndexedDB
    indexedDbStorage.saveCase(updatedCase).catch((err) => {
      console.error('IndexedDB save failure:', err);
    });

    try {
      localStorage.setItem(ACTIVE_CASE_KEY, clinicalCase.id);
      // Save lightweight metadata only (no heavy Base64 dataUrl) to localStorage
      const metadataOnly = cachedCases.map((c) => ({
        ...c,
        photos: Object.keys(c.photos).reduce((acc, key) => {
          const photo = c.photos[key as keyof typeof c.photos];
          if (photo) {
            acc[key as keyof typeof c.photos] = {
              ...photo,
              dataUrl: '', // Stripped to save localStorage quota
            };
          }
          return acc;
        }, {} as typeof c.photos),
      }));
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadataOnly));
    } catch {
      // ignore
    }
  }

  public static getActiveCaseId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_CASE_KEY);
    } catch {
      return null;
    }
  }

  public static async loadLatestCase(): Promise<ClinicalCase | null> {
    await this.init();
    const activeId = this.getActiveCaseId();
    if (activeId) {
      const found = this.getCaseById(activeId);
      if (found) return found;
    }
    return cachedCases.length > 0 ? cachedCases[0] : null;
  }

  public static deletePhotoFromCase(caseId: string, viewId: ViewId): ClinicalCase | null {
    const existing = this.getCaseById(caseId);
    if (!existing) return null;

    const updatedPhotos = { ...existing.photos };
    delete updatedPhotos[viewId];

    const updatedCase: ClinicalCase = {
      ...existing,
      photos: updatedPhotos,
      updatedAt: Date.now(),
    };

    this.saveCase(updatedCase);
    indexedDbStorage.deletePhotoFromCase(caseId, viewId).catch(() => {});
    return updatedCase;
  }

  public static createDefaultCase(): ClinicalCase {
    const caseId = `CASE_${new Date().getFullYear()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const patientId = `PT-${Math.floor(10000 + Math.random() * 90000)}`;

    return {
      id: `case_${Date.now()}`,
      patientId,
      patientName: 'Jane Doe',
      date: new Date().toISOString().split('T')[0],
      operator: 'Dr. Orthodontist',
      clinicName: 'Orthodontic Clinic',
      caseType: 'INITIAL',
      notes: 'Standardized pre-treatment orthodontic clinical photo records.',
      photos: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
