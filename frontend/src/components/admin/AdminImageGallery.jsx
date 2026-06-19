'use client';

import { FiImage, FiUpload, FiX, FiArrowLeft, FiArrowRight, FiStar } from 'react-icons/fi';
import { IMAGE_UPLOAD, resolveImageUrl, validateImageFiles, createImagePreview } from '@/lib/uploadApi';

/**
 * Manage an ordered list of product images.
 *
 * Each image entry is one of:
 *   - existing:  { url, publicId, alt, sortOrder }
 *   - new local: { file, previewUrl, alt }   (uploaded on form submit)
 *
 * The first image in the list is treated as the primary/cover image.
 *
 * Props:
 *   images   : array of entries
 *   onChange : (nextImages) => void
 *   max      : max number of images (default 10)
 *   altText  : fallback alt text (e.g. product name)
 *   onError  : (message) => void  — surface validation errors
 */
export default function AdminImageGallery({
  images = [],
  onChange,
  max = 10,
  altText = '',
  onError,
}) {
  const list = Array.isArray(images) ? images : [];

  const emit = (next) => onChange?.(next);

  const remaining = Math.max(0, max - list.length);

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (files.length > remaining) {
      onError?.(`You can add up to ${max} images (${remaining} more allowed).`);
      return;
    }
    try {
      validateImageFiles(files, { maxFiles: remaining || max });
    } catch (err) {
      onError?.(err.message || 'Invalid image file');
      return;
    }
    const entries = files.map((file) => ({
      file,
      previewUrl: createImagePreview(file),
      alt: altText,
    }));
    emit([...list, ...entries]);
  };

  const addByUrl = (url) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return;
    if (list.length >= max) {
      onError?.(`You can add up to ${max} images.`);
      return;
    }
    // Only allow http(s) or safe relative /uploads/ | /images/ paths.
    const isHttp = /^https?:\/\//i.test(trimmed);
    const isSafeRelative = /^\/(?:uploads|images)\//i.test(trimmed);
    if (!isHttp && !isSafeRelative) {
      onError?.('Image URL must start with https:// or be a relative /uploads/ or /images/ path.');
      return;
    }
    emit([...list, { url: trimmed, publicId: '', alt: altText }]);
  };

  const removeAt = (index) => {
    const entry = list[index];
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    emit(list.filter((_, i) => i !== index));
  };

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    emit(next);
  };

  const makePrimary = (index) => {
    if (index === 0) return;
    const next = [...list];
    const [entry] = next.splice(index, 1);
    next.unshift(entry);
    emit(next);
  };

  const srcFor = (entry) => entry.previewUrl || resolveImageUrl(entry.url);

  return (
    <div className="admin-field">
      <label className="admin-label">Product Images</label>

      {list.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          {list.map((entry, index) => (
            <div
              key={entry.publicId || entry.previewUrl || entry.url || index}
              style={{
                border: index === 0 ? '2px solid var(--admin-primary, #d6336c)' : '1px solid var(--admin-border)',
                borderRadius: 'var(--admin-radius-sm)',
                overflow: 'hidden',
                background: 'var(--admin-bg)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: 'var(--admin-bg)' }}>
                {srcFor(entry) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={srcFor(entry)}
                    alt={entry.alt || altText || `Image ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiImage style={{ width: 24, height: 24, color: 'var(--admin-text-muted)' }} />
                  </div>
                )}

                {index === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--admin-primary, #d6336c)',
                      padding: '2px 6px',
                      borderRadius: 999,
                    }}
                  >
                    <FiStar style={{ width: 11, height: 11 }} /> Primary
                  </span>
                )}

                <button
                  type="button"
                  title="Remove image"
                  onClick={() => removeAt(index)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FiX style={{ width: 14, height: 14 }} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, padding: '4px 6px' }}>
                <button
                  type="button"
                  title="Move left"
                  className="admin-btn admin-btn-ghost admin-btn-icon admin-btn-sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  style={{ opacity: index === 0 ? 0.4 : 1 }}
                >
                  <FiArrowLeft />
                </button>
                {index !== 0 ? (
                  <button
                    type="button"
                    title="Set as primary"
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => makePrimary(index)}
                    style={{ fontSize: '0.6875rem', padding: '2px 6px' }}
                  >
                    Set primary
                  </button>
                ) : (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--admin-text-muted)' }}>Cover</span>
                )}
                <button
                  type="button"
                  title="Move right"
                  className="admin-btn admin-btn-ghost admin-btn-icon admin-btn-sm"
                  onClick={() => move(index, 1)}
                  disabled={index === list.length - 1}
                  style={{ opacity: index === list.length - 1 ? 0.4 : 1 }}
                >
                  <FiArrowRight />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label
          className="admin-btn admin-btn-secondary admin-btn-sm"
          style={{ cursor: remaining > 0 ? 'pointer' : 'not-allowed', opacity: remaining > 0 ? 1 : 0.5 }}
        >
          <FiUpload />
          Add Images
          <input
            type="file"
            multiple
            accept={IMAGE_UPLOAD.accept}
            disabled={remaining <= 0}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </label>

        <input
          className="admin-input"
          placeholder="Or paste an image URL and press Enter"
          style={{ flex: 1, minWidth: 200 }}
          disabled={list.length >= max}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addByUrl(e.target.value);
              e.target.value = '';
            }
          }}
        />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.5rem' }}>
        JPEG, PNG, GIF, or WebP. Max 5MB each, up to {max} images. The first image is the cover shown on the storefront.
      </div>
    </div>
  );
}
