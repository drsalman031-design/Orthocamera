import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GalleryStorage } from '../galleryStorage';
import { CapturedPhoto, ClinicalCase, OrthodonticViewDefinition } from '../../types';
import { Capacitor } from '@capacitor/core';
import { GallerySave } from '../galleryPlugin';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
  registerPlugin: vi.fn().mockReturnValue({
    savePhotoToGallery: vi.fn(),
    openGallery: vi.fn(),
  }),
}));

describe('GalleryStorage', () => {
  const mockPhoto: CapturedPhoto = {
    id: 'photo-1',
    viewId: 'FRONTAL_REST',
    dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
    timestamp: 1710000000000,
    width: 1920,
    height: 1080,
    quality: {
      overallPassed: true,
      overallScore: 92,
      position: { passed: true, score: 95, label: 'Position', feedback: 'Centered' },
      orientation: { passed: true, score: 90, label: 'Angle', feedback: 'Level' },
      sharpness: { passed: true, score: 90, label: 'Sharpness', feedback: 'Crisp' },
      exposure: { passed: true, score: 92, label: 'Lighting', feedback: 'Good' },
      framing: { passed: true, score: 95, label: 'Coverage', feedback: 'Adequate' },
      reasons: [],
      recommendation: 'ACCEPT',
    },
  };

  const mockCase: ClinicalCase = {
    id: 'case-1',
    patientId: 'PT-12345',
    patientName: 'Jane Doe',
    date: '2026-09-04',
    operator: 'Dr. Salman',
    clinicName: 'OrthoClinic',
    caseType: 'INITIAL',
    notes: '',
    photos: {},
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  };

  const mockView: OrthodonticViewDefinition = {
    id: 'FRONTAL_REST',
    index: 1,
    name: 'Frontal at Rest',
    category: 'extraoral',
    shortCode: 'F-REST',
    subtitle: 'Natural Head Position',
    clinicalPurpose: 'Facial symmetry',
    landmarks: ['Midline'],
    tips: ['Lips relaxed'],
    preferredFacing: 'environment',
    overlayType: 'frontal_rest',
  };

  let mockClick: any;
  beforeEach(() => {
    vi.clearAllMocks();

    mockClick = vi.fn();
    const mockAnchor = {
      style: {},
      href: '',
      download: '',
      setAttribute: vi.fn(),
      click: mockClick,
      parentNode: null as any,
    };
    const mockBody = {
      appendChild: vi.fn().mockImplementation((el: any) => {
        el.parentNode = mockBody;
        return el;
      }),
      removeChild: vi.fn().mockImplementation((el: any) => {
        el.parentNode = null;
        return el;
      }),
    };

    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: mockBody,
    };
    (globalThis as any).window = globalThis;
    (globalThis as any).URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:http://localhost/test-blob'),
      revokeObjectURL: vi.fn(),
    };
  });

  it('generates a clean, standardized, sanitized clinical filename', () => {
    const filename = GalleryStorage.getPhotoFilename(mockPhoto, mockCase, mockView);
    expect(filename).toBe('Jane_Doe_01_Frontal_at_Rest.jpg');
  });

  it('sanitizes illegal path characters from patient and view names', () => {
    const unsafeCase: ClinicalCase = {
      ...mockCase,
      patientName: 'John/Doe: Jr. *Special*',
    };
    const filename = GalleryStorage.getPhotoFilename(mockPhoto, unsafeCase, mockView);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain(':');
    expect(filename).not.toContain('*');
    expect(filename).toBe('John_Doe__Jr.__Special__01_Frontal_at_Rest.jpg');
  });

  it('appends deterministic suffix to prevent accidental duplicate collisions', () => {
    const filename = GalleryStorage.getPhotoFilename(mockPhoto, mockCase, mockView, 'retake1');
    expect(filename).toBe('Jane_Doe_01_Frontal_at_Rest_retake1.jpg');
  });

  it('routes to native MediaStore save when running inside Capacitor', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(GallerySave.savePhotoToGallery).mockResolvedValueOnce({
      success: true,
      uri: 'content://media/external/images/media/45678',
      filename: 'Jane_Doe_01_Frontal_at_Rest.jpg',
      album: 'Orthocamera',
    });

    const result = await GalleryStorage.savePhotoToGallery(mockPhoto, mockCase, mockView);

    expect(Capacitor.isNativePlatform).toHaveBeenCalled();
    expect(GallerySave.savePhotoToGallery).toHaveBeenCalledWith({
      filename: 'Jane_Doe_01_Frontal_at_Rest.jpg',
      jpegBase64: mockPhoto.dataUrl,
      album: 'Orthocamera',
    });
    expect(result.success).toBe(true);
    expect(result.method).toBe('gallery');
    expect(result.uri).toBe('content://media/external/images/media/45678');
  });

  it('reports failure accurately when native MediaStore save fails without claiming gallery success', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(GallerySave.savePhotoToGallery).mockRejectedValueOnce(
      new Error('Disk storage full / Permission denied')
    );

    const result = await GalleryStorage.savePhotoToGallery(mockPhoto, mockCase, mockView);

    expect(result.success).toBe(false);
    expect(result.method).toBe('gallery');
    expect(result.error).toContain('Disk storage full');
  });

  it('falls back safely to browser downloads in PWA/Web environment', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const result = await GalleryStorage.savePhotoToGallery(mockPhoto, mockCase, mockView);

    expect(result.success).toBe(true);
    expect(result.method).toBe('downloads');
    expect(mockClick).toHaveBeenCalled();
  });

  it('batch saves all photos using native path without zip in Capacitor', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(GallerySave.savePhotoToGallery).mockResolvedValue({
      success: true,
      uri: 'content://media/external/images/media/100',
    });

    const caseWithPhotos: ClinicalCase = {
      ...mockCase,
      photos: {
        FRONTAL_REST: mockPhoto,
        FRONTAL_SMILE: { ...mockPhoto, viewId: 'FRONTAL_SMILE' },
      },
    };

    const progressSpy = vi.fn();
    const batchResult = await GalleryStorage.saveAllPhotosToGallery(caseWithPhotos, progressSpy);

    expect(batchResult.savedCount).toBe(2);
    expect(batchResult.results.every((r) => r.method === 'gallery')).toBe(true);
    expect(progressSpy).toHaveBeenCalledTimes(2);
  });

  describe('openGallery', () => {
    it('invokes native GallerySave.openGallery when running on native platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(GallerySave.openGallery).mockResolvedValueOnce({ success: true });

      const result = await GalleryStorage.openGallery('content://media/test/123');

      expect(Capacitor.isNativePlatform).toHaveBeenCalled();
      expect(GallerySave.openGallery).toHaveBeenCalledWith({ uri: 'content://media/test/123' });
      expect(result.success).toBe(true);
    });

    it('triggers document file input click in web/browser environment', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      const result = await GalleryStorage.openGallery();

      expect(result.success).toBe(true);
      expect(mockClick).toHaveBeenCalled();
    });
  });
});
