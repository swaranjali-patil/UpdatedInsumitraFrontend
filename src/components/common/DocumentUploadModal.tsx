import { useEffect, useRef, useState } from 'react';
import { FileCheck2, FileText, Upload, X } from 'lucide-react';
import Modal from './Modal';

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
}: Props) {
  const [type, setType] = useState(defaultType);
  const [documentTitle, setDocumentTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;
    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    if (droppedFile) {
      selectFile(droppedFile);
    }
  };

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

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      subtitle={subtitle}
      size="md"
      zIndexClass={zIndexClass}
      icon={<FileText className="text-indigo-600" size={20} />}
      closeOnEscapeAndBackdrop={!uploading}
    >
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
          <label
            htmlFor="doc-upload-file-input"
            className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1 cursor-pointer"
          >
            Choose File <span className="text-red-500">*</span>
          </label>
          <div
            className={`relative rounded-2xl border-2 border-dashed p-4 transition-all duration-150 cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60 ring-4 ring-blue-500/10'
                : file
                ? 'border-emerald-400 bg-emerald-50/60'
                : 'border-slate-300 bg-slate-50/40 hover:border-blue-500 hover:bg-blue-50/30'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
          >
            <input
              ref={fileInputRef}
              id="doc-upload-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={uploading}
              onChange={event => selectFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-none">
              <div className="flex min-w-0 items-center gap-2.5 text-xs text-slate-600">
                {file ? (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileCheck2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="block min-w-0 truncate font-bold text-slate-800" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60">
                      <Upload size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">PDF, image, Word, or Excel</p>
                      <p className="text-[10px] text-slate-400">Click anywhere to browse or drag &amp; drop file</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {file && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="pointer-events-auto p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X size={15} />
                  </button>
                )}
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 shadow-blue-500/20">
                  <Upload size={14} />
                  {file ? 'Change File' : 'Choose File'}
                </span>
              </div>
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
    </Modal>
  );
}
