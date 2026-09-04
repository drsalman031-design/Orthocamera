import { registerPlugin } from '@capacitor/core';

export interface SavePhotoOptions {
  filename: string;
  jpegBase64: string;
  album?: string;
}

export interface SavePhotoNativeResponse {
  success: boolean;
  uri?: string;
  filename?: string;
  album?: string;
}

export interface GallerySavePlugin {
  savePhotoToGallery(options: SavePhotoOptions): Promise<SavePhotoNativeResponse>;
}

export const GallerySave = registerPlugin<GallerySavePlugin>('GallerySave');
