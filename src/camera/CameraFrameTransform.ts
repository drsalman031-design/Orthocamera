/**
 * CameraFrameTransform.ts
 *
 * Mathematical synchronization layer for camera preview, viewport cropping,
 * zoom scaling, and high-resolution image capture.
 *
 * Solves the critical preview-to-capture geometry mismatch:
 * Ensures that what the clinician sees inside the viewfinder/overlay
 * is mathematically identical to what is saved in the clinical photo.
 */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformMetrics {
  sensorWidth: number;
  sensorHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoomLevel: number;
  isHardwareZoom: boolean;
  cropRect: CropRect;
  scaleFactor: number;
}

export class CameraFrameTransform {
  /**
   * Calculates the exact crop rectangle on the camera frame that corresponds
   * to what the user sees in an `object-cover` viewport.
   *
   * @param sensorW Native width of the camera frame/sensor
   * @param sensorH Native height of the camera frame/sensor
   * @param viewportW Width of the on-screen camera viewport
   * @param viewportH Height of the on-screen camera viewport
   * @param zoomLevel Current digital zoom factor (1.0, 1.5, 2.0, 3.0)
   * @param isHardwareZoom If true, camera sensor already zoomed; do not re-crop for zoom
   */
  public static calculateVisibleCrop(
    sensorW: number,
    sensorH: number,
    viewportW: number,
    viewportH: number,
    zoomLevel: number = 1.0,
    isHardwareZoom: boolean = false
  ): CropRect {
    if (sensorW <= 0 || sensorH <= 0 || viewportW <= 0 || viewportH <= 0) {
      return { x: 0, y: 0, width: sensorW || 1920, height: sensorH || 1080 };
    }

    const sensorAspect = sensorW / sensorH;
    const viewportAspect = viewportW / viewportH;

    let baseCropW = sensorW;
    let baseCropH = sensorH;

    // object-cover logic:
    // If viewport is taller (aspect is smaller) than sensor:
    // the height fits, and the sides are cropped
    if (viewportAspect < sensorAspect) {
      baseCropW = sensorH * viewportAspect;
      baseCropH = sensorH;
    } else {
      // Viewport is wider than sensor:
      // width fits, and the top/bottom are cropped
      baseCropW = sensorW;
      baseCropH = sensorW / viewportAspect;
    }

    // Apply digital zoom crop if not handled by hardware
    const effectiveZoom = isHardwareZoom ? 1.0 : Math.max(1.0, zoomLevel);
    const finalCropW = baseCropW / effectiveZoom;
    const finalCropH = baseCropH / effectiveZoom;

    const cropX = (sensorW - finalCropW) / 2;
    const cropY = (sensorH - finalCropH) / 2;

    return {
      x: Math.max(0, Math.round(cropX)),
      y: Math.max(0, Math.round(cropY)),
      width: Math.min(sensorW, Math.round(finalCropW)),
      height: Math.min(sensorH, Math.round(finalCropH)),
    };
  }

  /**
   * Transforms normalized coordinates (0..1) from full sensor space
   * into viewport coordinates (0..1) taking object-cover crop and digital zoom into account.
   */
  public static sensorToViewportNorm(
    pt: { x: number; y: number },
    crop: CropRect,
    sensorW: number,
    sensorH: number
  ): { x: number; y: number } {
    const normX = (pt.x * sensorW - crop.x) / crop.width;
    const normY = (pt.y * sensorH - crop.y) / crop.height;
    return {
      x: Math.max(0, Math.min(1, normX)),
      y: Math.max(0, Math.min(1, normY)),
    };
  }

  /**
   * Transforms normalized coordinates (0..1) from viewport space
   * back to full sensor space.
   */
  public static viewportToSensorNorm(
    pt: { x: number; y: number },
    crop: CropRect,
    sensorW: number,
    sensorH: number
  ): { x: number; y: number } {
    const sensorPxX = crop.x + pt.x * crop.width;
    const sensorPxY = crop.y + pt.y * crop.height;
    return {
      x: Math.max(0, Math.min(1, sensorPxX / sensorW)),
      y: Math.max(0, Math.min(1, sensorPxY / sensorH)),
    };
  }

  /**
   * Crops a canvas or image element to the exact visible viewport framing and zoom factor.
   */
  public static cropToVisibleViewport(
    source: CanvasImageSource,
    sensorW: number,
    sensorH: number,
    viewportW: number,
    viewportH: number,
    zoomLevel: number = 1.0,
    isHardwareZoom: boolean = false,
    mirror: boolean = false
  ): HTMLCanvasElement {
    const crop = this.calculateVisibleCrop(
      sensorW,
      sensorH,
      viewportW,
      viewportH,
      zoomLevel,
      isHardwareZoom
    );

    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) return canvas;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );

    return canvas;
  }
}
