'use client';

import { useRef, useState } from 'react';
import { FiImage, FiUploadCloud, FiX } from 'react-icons/fi';
import { IMAGE_UPLOAD } from '@/lib/uploadApi';

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

export default function InquiryImageUpload({
  files = [],
  previews = [],
  onAdd,
  onRemove,
  disabled = false,
  title = 'Upload reference images',
  description = 'Add photos from your device to help us match the design.',
  helperText = 'Clear, well-lit photos give the bakery team the best reference.',
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const maxFiles = IMAGE_UPLOAD.maxInquiryFiles;
  const remaining = Math.max(maxFiles - files.length, 0);
  const uploadDisabled = disabled || remaining === 0;

  const handleFiles = (selectedFiles) => {
    if (uploadDisabled) return;
    onAdd?.(selectedFiles);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!uploadDisabled) setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleInputChange = (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  return (
    <section className="space-y-3" aria-label={title}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed p-4 transition-colors ${
          dragActive
            ? 'border-pink-deep bg-pink-deep/5'
            : 'border-outline-variant/50 bg-white/70 hover:border-pink-deep'
        } ${uploadDisabled ? 'opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMAGE_UPLOAD.accept}
          disabled={uploadDisabled}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-deep/10 text-pink-deep">
              <FiImage className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-dark">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-outline">{description}</p>
              <p className="mt-2 text-[11px] font-medium uppercase text-outline">
                {files.length}/{maxFiles} selected - {formatFileSize(IMAGE_UPLOAD.maxSize)} each - JPG, PNG, WebP, GIF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-pink-deep px-4 py-2 text-sm font-semibold text-pink-deep transition-colors hover:bg-pink-deep hover:text-white disabled:cursor-not-allowed disabled:border-outline-variant disabled:text-outline disabled:hover:bg-transparent"
          >
            <FiUploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload from device
          </button>
        </div>

        <p className="mt-3 text-xs text-outline">
          {remaining > 0 ? `${helperText} You can add ${remaining} more.` : 'Maximum reference images selected.'}
        </p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {previews.map((preview, index) => {
            const file = files[index];

            return (
              <div key={preview} className="overflow-hidden rounded-xl border border-outline-variant/30 bg-white">
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemove?.(index)}
                    disabled={disabled}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Remove ${file?.name || `reference image ${index + 1}`}`}
                  >
                    <FiX className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-w-0 px-2 py-2">
                  <p className="truncate text-xs font-medium text-dark">{file?.name || `Reference ${index + 1}`}</p>
                  <p className="text-[11px] text-outline">{formatFileSize(file?.size)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
