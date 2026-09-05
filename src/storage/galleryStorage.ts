import { Capacitor } from '@capacitor/core';
import { CapturedPhoto, ClinicalCase, OrthodonticViewDefinition } from '../types';
import { ORTHODONTIC_VIEWS } from '../photo_workflow/workflowData';
import { GallerySave } from './galleryPlugin';

export interface SaveGalleryResult {
  success: boolean;
  filename: string;
  fileUrl?: string;
  uri?: string;
  method: 'gallery' | 'downloads' | 'fallback';
  error?: string;
}

export class GalleryStorage {
  /**
   * Sanitizes a string for use in file systems across Android and desktop.
   */
  public static sanitizeFilenamePart(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '_').trim().replace(/\s+/g, '_');
  }

  /**
   * Generates a clean, standardized clinical filename for the phone's gallery
   * e.g., Jane_Doe_01_FRONTAL_REST.jpg
   */
  public static getPhotoFilename(
    photo: CapturedPhoto,
    clinicalCase: ClinicalCase,
    viewDef?: OrthodonticViewDefinition,
    suffix?: string
  ): string {
    const view = viewDef || ORTHODONTIC_VIEWS.find((v) => v.id === photo.viewId);
    const viewIdx = view ? String(view.index).padStart(2, '0') : '00';
    const patientRaw = clinicalCase.patientName || clinicalCase.patientId || 'Patient';
    const patientName = this.sanitizeFilenamePart(patientRaw);
    const viewRaw = view?.name || photo.viewId;
    const viewName = this.sanitizeFilenamePart(viewRaw);

    const suffixPart = suffix ? `_${this.sanitizeFilenamePart(suffix)}` : '';
    return `${patientName}_${viewIdx}_${viewName}${suffixPart}.jpg`;
  }

  /**
   * Synchronously converts a Base64 data URL string into a native JPEG binary Blob
   */
  public static dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Checks if running natively inside Capacitor (Android/iOS)
   */
  public static isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Saves captured photo directly to the phone's gallery (Android MediaStore)
   * or falls back safely to browser downloads in PWA/Web.
   */
  public static async savePhotoToGallery(
    photo: CapturedPhoto,
    clinicalCase: ClinicalCase,
    viewDef?: OrthodonticViewDefinition,
    options?: { album?: string; suffix?: string }
  ): Promise<SaveGalleryResult> {
    const album = options?.album || 'Orthocamera';
    const filename = this.getPhotoFilename(photo, clinicalCase, viewDef, options?.suffix);

    // 1. Native Android MediaStore Path (Capacitor)
    if (this.isNativeAndroid()) {
      try {
        const nativeRes = await GallerySave.savePhotoToGallery({
          filename,
          jpegBase64: photo.dataUrl,
          album,
        });

        if (nativeRes && nativeRes.success) {
          if (nativeRes.uri) {
            this.lastSavedUri = nativeRes.uri;
          }
          return {
            success: true,
            filename: nativeRes.filename || filename,
            uri: nativeRes.uri,
            method: 'gallery',
          };
        } else {
          return {
            success: false,
            filename,
            method: 'gallery',
            error: 'Native MediaStore write returned unsuccessful',
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[GalleryStorage] Native Android MediaStore save failed:', err);
        return {
          success: false,
          filename,
          method: 'gallery',
          error: errorMsg,
        };
      }
    }

    // 2. Web / PWA Browser Download Fallback
    try {
      const blob = this.dataUrlToBlob(photo.dataUrl);
      const fileUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = fileUrl;
      anchor.download = filename;
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(anchor);
      anchor.click();

      setTimeout(() => {
        try {
          if (anchor.parentNode) {
            document.body.removeChild(anchor);
          }
          URL.revokeObjectURL(fileUrl);
        } catch {
          // cleanup
        }
      }, 2000);

      return {
        success: true,
        filename,
        fileUrl,
        method: 'downloads',
      };
    } catch (err: unknown) {
      console.warn('[GalleryStorage] Blob save failed, attempting direct dataUrl download:', err);
      try {
        const anchor = document.createElement('a');
        anchor.style.display = 'none';
        anchor.href = photo.dataUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
          if (anchor.parentNode) document.body.removeChild(anchor);
        }, 1500);
        return { success: true, filename, method: 'downloads' };
      } catch (fallbackErr) {
        return {
          success: false,
          filename,
          method: 'fallback',
          error: String(err),
        };
      }
    }
  }

  /**
   * Batch save all captured photos directly to device gallery or downloads
   */
  public static async saveAllPhotosToGallery(
    clinicalCase: ClinicalCase,
    onProgress?: (saved: number, total: number, currentName: string) => void
  ): Promise<{ savedCount: number; results: SaveGalleryResult[] }> {
    const photos = Object.values(clinicalCase.photos).filter(
      (p): p is CapturedPhoto => Boolean(p && p.dataUrl)
    );

    let savedCount = 0;
    const results: SaveGalleryResult[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const viewDef = ORTHODONTIC_VIEWS.find((v) => v.id === photo.viewId);
      const filename = this.getPhotoFilename(photo, clinicalCase, viewDef);

      if (onProgress) {
        onProgress(i + 1, photos.length, filename);
      }

      const res = await this.savePhotoToGallery(photo, clinicalCase, viewDef);
      results.push(res);
      if (res.success) {
        savedCount++;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return { savedCount, results };
  }

  private static lastSavedUri: string | null = null;

  /**
   * Retrieves the last saved native media content URI
   */
  public static getLastSavedUri(): string | null {
    return this.lastSavedUri;
  }

  /**
   * Opens the device's native Gallery or Photos app.
   * If a specific photo URI is provided or was recently saved, opens that photo directly in the gallery viewer.
   */
  public static async openGallery(uri?: string): Promise<{ success: boolean; error?: string }> {
    const targetUri = uri || this.lastSavedUri || undefined;
    if (this.isNativeAndroid()) {
      try {
        const res = await GallerySave.openGallery({ uri: targetUri });
        return { success: res?.success ?? true };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[GalleryStorage] Failed to launch native gallery:', err);
        return { success: false, error: errorMsg };
      }
    }
    return { success: false, error: 'Not running on native Android device' };
  }
}
