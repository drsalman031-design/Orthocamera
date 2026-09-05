import React from 'react';
import { X, Download, ExternalLink, Image as ImageIcon, Check } from 'lucide-react';
import { CapturedPhoto, OrthodonticViewDefinition } from '../types';
import { ORTHODONTIC_VIEWS } from './workflowData';
import { GalleryStorage } from '../storage/galleryStorage';

interface PhotoLightboxModalProps {
  photo: CapturedPhoto | null;
  onClose: () => void;
  onOpenMobileGallery?: () => void;
  patientName?: string;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  onClose,
  onOpenMobileGallery,
  patientName = 'Patient',
}) => {
  const [downloaded, setDownloaded] = React.useState<boolean>(false);

  if (!photo) return null;

  const viewDef = ORTHODONTIC_VIEWS.find((v) => v.id === photo.viewId);
  const viewName = viewDef?.name || photo.viewId;
  const isNative = GalleryStorage.isNativeAndroid();

  const handleDownload = () => {
    if (!photo.dataUrl) return;
    const link = document.createElement('a');
    link.href = photo.dataUrl;
    link.download = `${patientName}_${photo.viewId}.jpg`;
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-90 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-lg flex items-center justify-between pt-safe pb-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
            {viewDef?.category || 'Clinical'} • View {viewDef?.index ?? '—'}
          </span>
          <h3 className="text-base font-bold text-white tracking-tight">{viewName}</h3>
          <span className="text-[10px] font-mono text-slate-400">
            {new Date(photo.timestamp).toLocaleTimeString()} {photo.burstIndex ? `(Shot ${photo.burstIndex}/${photo.burstTotal})` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
          aria-label="Close photo preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center High-Res Image Frame */}
      <div className="flex-1 w-full max-w-lg my-2 min-h-0 flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl relative">
        {photo.dataUrl ? (
          <img
            src={photo.dataUrl}
            alt={viewName}
            className="w-full h-full object-contain max-h-[70vh]"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
            <ImageIcon className="w-12 h-12 stroke-1 text-slate-500" />
            <p className="text-xs">Photo saved directly to phone storage</p>
            <span className="text-[10px] font-mono text-emerald-400">Pictures/Orthocamera</span>
          </div>
        )}
      </div>

      {/* Bottom Action Deck */}
      <div className="w-full max-w-lg flex flex-col gap-2 pb-safe pt-2">
        {isNative ? (
          <button
            type="button"
            onClick={() => {
              if (onOpenMobileGallery) {
                onOpenMobileGallery();
              } else {
                GalleryStorage.openGallery();
              }
              onClose();
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
          >
            <ImageIcon className="w-4 h-4 stroke-[2.5]" />
            <span>Open in Phone Gallery</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              {downloaded ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-cyan-400" />}
              <span>{downloaded ? 'Downloaded!' : 'Download JPG'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onOpenMobileGallery) {
                  onOpenMobileGallery();
                } else {
                  GalleryStorage.openGallery();
                }
                onClose();
              }}
              className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              title="Open Mobile Gallery"
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Mobile Gallery</span>
            </button>
            {photo.dataUrl && (
              <button
                type="button"
                onClick={() => {
                  const newTab = window.open();
                  if (newTab) {
                    newTab.document.write(`<img src="${photo.dataUrl}" style="max-width:100%; height:auto;" />`);
                  }
                }}
                className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                title="Open in new browser tab"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Full Tab</span>
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-medium hover:text-slate-200 active:scale-95 transition-all text-center"
        >
          Back to Camera
        </button>
      </div>
    </div>
  );
};
