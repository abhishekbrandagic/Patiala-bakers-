import { useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, X } from 'lucide-react';
import { api, apiError, assetUrl } from '../api/client.js';
import { shrinkImage, thumbUrl } from '../utils/referenceImages.js';

export const MAX_REFERENCE_IMAGES = 3;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const CSS = `
.ri-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ri-item { position: relative; display: block; flex: none; overflow: hidden; border: 1px solid rgba(0,0,0,.12); border-radius: 10px; background: #f4f4f4; }
.ri-item img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ri-remove { position: absolute; top: 4px; right: 4px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,.95); color: #222; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.ri-busy { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #555; }
.ri-drop { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1.5px dashed #9AA8B8; border-radius: 12px; font-size: 13.5px; cursor: pointer; }
.ri-drop:hover { border-style: solid; }
.ri-drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.ri-drop small { display: block; font-size: 12px; opacity: .75; }
.ri-head { display: block; margin-bottom: 7px; font-size: 14px; font-weight: 700; }
@media print { .ri-item { border-color: #999; } }
`;

// Thumbnails that open the full photo. Used on orders, production cards and tickets.
export function ReferenceImageList({ images, size = 64, print = false }) {
  if (!images?.length) return null;
  return (
    <div className="ri-list">
      <style>{CSS}</style>
      {images.map((img, i) => (
        <a key={img.url} href={assetUrl(img.url)} target="_blank" rel="noreferrer" className="ri-item" style={{ width: size, height: size }} aria-label={`Open reference photo ${i + 1}`}>
          <img src={assetUrl(print ? img.url : thumbUrl(img.url, size * 2))} alt={`Reference photo ${i + 1}`} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

// Picks, shrinks and uploads up to 3 reference photos for one cake
export function ReferenceImagesInput({ id = 'ref-images', value = [], onChange, label = 'Reference photos', onBusy }) {
  const [busy, setBusy] = useState(0);
  const room = MAX_REFERENCE_IMAGES - value.length;

  const add = async (files) => {
    const picked = files.filter((f) => {
      if (TYPES.includes(f.type)) return true;
      toast.error(`${f.name} isn't a JPG, PNG, WebP or GIF image.`);
      return false;
    });
    if (picked.length > room) toast.error(`You can attach up to ${MAX_REFERENCE_IMAGES} photos.`);
    const chosen = picked.slice(0, Math.max(0, room));
    if (!chosen.length) return;
    setBusy(chosen.length);
    onBusy?.(true);
    try {
      const fd = new FormData();
      for (const f of chosen) {
        const small = await shrinkImage(f);
        if (small.size > 5 * 1024 * 1024) throw new Error(`${f.name} is larger than 5 MB.`);
        fd.append('images', small);
      }
      const { data } = await api.post('/uploads/references', fd);
      onChange([...value, ...data.images].slice(0, MAX_REFERENCE_IMAGES));
    } catch (e) {
      toast.error(e instanceof Error && !e.response ? e.message : apiError(e).message);
    } finally {
      setBusy(0);
      onBusy?.(false);
    }
  };

  return (
    <div>
      <style>{CSS}</style>
      <span className="ri-head" id={`${id}-label`}>
        {label} <span style={{ fontWeight: 600, opacity: 0.7 }}>(optional, up to {MAX_REFERENCE_IMAGES})</span>
      </span>
      <div className="ri-list">
        {value.map((img, i) => (
          <span key={img.url} className="ri-item" style={{ width: 84, height: 84 }}>
            <img src={assetUrl(thumbUrl(img.url, 168))} alt={`Reference photo ${i + 1}`} />
            <button type="button" className="ri-remove" onClick={() => onChange(value.filter((x) => x !== img))} aria-label={`Remove reference photo ${i + 1}`}>
              <X size={14} />
            </button>
          </span>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <span key={`up-${i}`} className="ri-item ri-busy" style={{ width: 84, height: 84 }} role="status">Uploading…</span>
        ))}
      </div>
      {room > 0 && !busy && (
        <label className="ri-drop" style={{ marginTop: value.length ? 10 : 0 }}>
          <ImagePlus size={22} aria-hidden="true" />
          <span>
            <b>Add a photo of the cake design</b>
            <small>JPG, PNG or WebP · tap to take a photo or choose one</small>
          </span>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            aria-labelledby={`${id}-label`}
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}