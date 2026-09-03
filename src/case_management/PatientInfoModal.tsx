import React, { useState } from 'react';
import { X, Save, User, Calendar, Shield, Building, FileText } from 'lucide-react';
import { ClinicalCase } from '../types';

interface PatientInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCase: ClinicalCase;
  onSaveCaseInfo: (updated: ClinicalCase) => void;
}

export const PatientInfoModal: React.FC<PatientInfoModalProps> = ({
  isOpen,
  onClose,
  activeCase,
  onSaveCaseInfo,
}) => {
  const [formData, setFormData] = useState<ClinicalCase>({ ...activeCase });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCaseInfo(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-950/95 border border-slate-700/60 rounded-3xl overflow-hidden shadow-[0_16px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Clinical Case Information</h2>
              <p className="text-[11px] font-mono text-slate-400">Standardized Orthodontic Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-900 border border-slate-700/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px]">Patient ID</label>
              <input
                type="text"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                placeholder="PT-12345"
              />
            </div>
            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px]">Case ID</label>
              <input
                type="text"
                value={formData.caseId}
                onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                placeholder="CASE_2026_01"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px]">Patient Name</label>
            <input
              type="text"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              placeholder="Jane Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              />
            </div>

            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> Stage
              </label>
              <select
                value={formData.caseType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    caseType: e.target.value as 'INITIAL' | 'PROGRESS' | 'FINAL' | 'RETENTION',
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all cursor-pointer"
              >
                <option value="INITIAL">Initial / Pre-Tx</option>
                <option value="PROGRESS">Progress / Mid-Tx</option>
                <option value="FINAL">Final / Post-Tx</option>
                <option value="RETENTION">Retention Follow-up</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px]">Operator</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                placeholder="Dr. Smith"
              />
            </div>

            <div>
              <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" /> Clinic
              </label>
              <input
                type="text"
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                placeholder="Orthodontic Specialty"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-slate-300 font-semibold mb-1.5 text-[11px] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Clinical Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/70 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all resize-none"
              placeholder="Clinical observations or malocclusion notes..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700/70 text-slate-300 hover:bg-slate-800 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
            >
              <Save className="w-4 h-4" /> Save Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
