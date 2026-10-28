import { useEffect, useRef, useState } from 'react';
import { FileCheck2, FileText, Upload, X } from 'lucide-react';

export interface DocumentUploadMeta {
  type: string;
  title: string;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, meta: DocumentUploadMeta) => Promise<boolean | void>;
  title?: string;
  subtitle?: string;
  types: Array<{ value: string; label: string }>;
  defaultType: string;
  zIndexClass?: string;
  explicitFilePicker?: boolean;
}

export default function DocumentUploadModal({
  open,
  onClose,
  onUpload,
  title = 'Upload Document',
  subtitle = 'Choose a document to upload.',
  types,
  defaultType,
  zIndexClass = 'z-[70]',
  explicitFilePicker = false,
}: Props) {
  const [type, setType] = useState(defaultType);
  const [documentTitle, setDocumentTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      const initialTypeLabel = types?.find(t => t.value === defaultType)?.label || '';
      setDocumentTitle(initialTypeLabel);
      setDescription('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open, defaultType, types]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, uploading, onClose]);

  const close = () => {
    if (uploading) return;
    setFile(null);
    setDocumentTitle('');
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const selectFile = (selected: File | null) => {
    setFile(selected);
    if (selected) {
      setDocumentTitle(prev => {
        if (prev && prev.trim()) return prev;
        const currentTypeLabel = types?.find(t => t.value === type)?.label;
        return currentTypeLabel || selected.name.replace(/\.[^.]+$/, '');
      });
    }
  };

  const openFilePicker = () => {
    if (!fileInputRef.current || uploading) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const submit = async () => {
    const finalTitle = documentTitle.trim() || types?.find(t => t.value === type)?.label || file?.name.replace(/\.[^.]+$/, '') || '';
    if (!file || !finalTitle) return;
    setUploading(true);
    try {
      const uploaded = await onUpload(file, { type, title: finalTitle, description: description.trim() });
      if (uploaded === false) return;
      setFile(null);
      setDocumentTitle('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} overflow-y-auto`} role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        onClick={close}
      />

      {/* Centered Panel */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 relative pointer-events-none">
        <div className="w-[95vw] sm:w-full max-w-xl bg-white flex flex-col rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden font-sans text-slate-800 pointer-events-auto animate-fadeIn">
          {/* Top Accent Gradient Bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 w-full shrink-0" />

          {/* Header */}
          <div className="flex items-start sm:items-center justify-between px-4 sm:px-8 py-3.5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 border-b border-slate-200/80 shrink-0">
            <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0 pr-2 sm:pr-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80 shadow-2xs">
                <FileText className="text-indigo-600" size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-base font-black text-slate-900 tracking-tight whitespace-normal break-words">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-slate-500 font-semibold leading-normal mt-0.5 whitespace-normal break-words">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 border border-slate-200/60 hover:border-slate-300 cursor-pointer shadow-2xs shrink-0"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-4 sm:px-8 pt-3 pb-5 bg-slate-50/30">
            <div className="space-y-4 py-1">
              <div>
                <label htmlFor="doc-upload-type" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="doc-upload-type"
                  value={type}
                  onChange={event => {
                    const newType = event.target.value;
                    setType(newType);
                    const selectedLabel = types?.find(option => option.value === newType)?.label;
                    if (selectedLabel) {
                      setDocumentTitle(selectedLabel);
                    }
                  }}
                  className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                >
                  {types.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="doc-upload-title" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="doc-upload-title"
                  type="text"
                  value={documentTitle}
                  onChange={event => setDocumentTitle(event.target.value)}
                  className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                  placeholder="Document title (defaults to selected Document Type)"
                />
              </div>

              <div>
                <label htmlFor="doc-upload-description" className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer">
                  Description / Notes
                </label>
                <textarea
                  id="doc-upload-description"
                  rows={3}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  className="w-full !h-auto min-h-[72px] p-2.5 text-xs rounded-xl bg-white border border-slate-200 outline-none transition-all duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder-slate-400 resize-y block font-medium"
                  placeholder="Optional notes about this document"
                />
              </div>

              <div>
                <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Choose File <span className="text-red-500">*</span>
                </label>
                <div className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
                  file ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-300 bg-slate-50/40 hover:border-blue-500 hover:bg-blue-50/30'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    className={explicitFilePicker ? 'sr-only' : 'block w-full cursor-pointer text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700'}
                    disabled={uploading}
                    onChange={event => selectFile(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                      {file ? (
                        <>
                          <FileCheck2 size={18} className="shrink-0 text-emerald-600" />
                          <span className="min-w-0 truncate font-semibold" title={file.name}>{file.name}</span>
                          <span className="shrink-0 text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                        </>
                      ) : (
                        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Upload size={13} /> PDF, image, Word, or Excel
                        </p>
                      )}
                    </div>
                    {explicitFilePicker && (
                      <button
                        type="button"
                        onClick={openFilePicker}
                        disabled={uploading}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload size={14} />
                        {file ? 'Change File' : 'Choose File'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={close} disabled={uploading} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!file || !documentTitle.trim() || uploading}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Add Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
