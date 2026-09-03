import { CapturedPhoto, ClinicalCase, OrthodonticViewDefinition } from '../types';
import { ORTHODONTIC_VIEWS } from '../photo_workflow/workflowData';

export interface SaveGalleryResult {
  success: boolean;
  filename: string;
  fileUrl?: string;
  method: 'download' | 'share' | 'fallback';
  error?: string;
}

export class GalleryStorage {
  /**
   * Generates a clean, standardized clinical filename for the phone's gallery
   * e.g., Jane_Doe_01_FRONTAL_REST.jpg
   */
  public static getPhotoFilename(
    photo: CapturedPhoto,
    clinicalCase: ClinicalCase,
    viewDef?: OrthodonticViewDefinition
  ): string {
    const view = viewDef || ORTHODONTIC_VIEWS.find((v) => v.id === photo.viewId);
    const viewIdx = view ? String(view.index).padStart(2, '0') : '00';
    const patientName = (clinicalCase.patientName || clinicalCase.patientId || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
    const viewName = (view?.name || photo.viewId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${patientName}_${viewIdx}_${viewName}.jpg`;
  }

  /**
   * Synchronously converts a Base64 data URL string into a native JPEG binary Blob
   */
  public static dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Saves captured photo directly to the phone's storage and gallery (Downloads/Pictures)
   */
  public static savePhotoToGallery(
    photo: CapturedPhoto,
    clinicalCase: ClinicalCase,
    viewDef?: OrthodonticViewDefinition
  ): SaveGalleryResult {
    const filename = this.getPhotoFilename(photo, clinicalCase, viewDef);

    try {
      const blob = this.dataUrlToBlob(photo.dataUrl);
      const fileUrl = URL.createObjectURL(blob);

      // Direct download trigger into phone's photo storage
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
        method: 'download',
      };
    } catch (err: unknown) {
      console.warn('Blob save failed, attempting direct dataUrl download:', err);
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
        return { success: true, filename, method: 'download' };
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
   * Batch save all captured photos directly to device gallery
   */
  public static async saveAllPhotosToGallery(
    clinicalCase: ClinicalCase,
    onProgress?: (saved: number, total: number, currentName: string) => void
  ): Promise<number> {
    const photos = Object.values(clinicalCase.photos).filter(
      (p): p is CapturedPhoto => Boolean(p && p.dataUrl)
    );

    let savedCount = 0;
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const viewDef = ORTHODONTIC_VIEWS.find((v) => v.id === photo.viewId);
      const filename = this.getPhotoFilename(photo, clinicalCase, viewDef);

      if (onProgress) {
        onProgress(i + 1, photos.length, filename);
      }

      this.savePhotoToGallery(photo, clinicalCase, viewDef);
      savedCount++;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return savedCount;
  }
}
