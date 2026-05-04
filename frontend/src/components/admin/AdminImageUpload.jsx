'use client';

import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import { IMAGE_UPLOAD, resolveImageUrl } from '@/lib/uploadApi';

export default function AdminImageUpload({
  label = 'Image',
  value = '',
  previewUrl = '',
  file,
  onFileChange,
  onUrlChange,
  onClearFile,
  helpText = 'JPEG, PNG, GIF, or WebP. Max 5MB.',
}) {
  const imageSrc = previewUrl || resolveImageUrl(value);

  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.875rem', alignItems: 'start' }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 'var(--admin-radius-sm)',
            border: '1px solid var(--admin-border)',
            background: 'var(--admin-bg)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <FiImage style={{ width: 24, height: 24, color: 'var(--admin-text-muted)' }} />
          )}
        </div>

        <div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
            <label className="admin-btn admin-btn-secondary admin-btn-sm" style={{ cursor: 'pointer' }}>
              <FiUpload />
              Choose File
              <input
                type="file"
                accept={IMAGE_UPLOAD.accept}
                onChange={(e) => {
                  onFileChange?.(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>
            {file && (
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClearFile}>
                <FiX />
                Clear
              </button>
            )}
          </div>

          {file && (
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginBottom: '0.625rem' }}>
              Selected: {file.name}
            </div>
          )}

          <input
            className="admin-input"
            value={value}
            onChange={(e) => onUrlChange?.(e.target.value)}
            placeholder="https://..."
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.375rem' }}>
            {helpText}
          </div>
        </div>
      </div>
    </div>
  );
}
