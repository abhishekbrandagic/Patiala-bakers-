// Reference photos are shrunk in the browser before upload, so they send fast and use little storage
const MAX_SIDE = 1600;

export async function shrinkImage(file) {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 700 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Cloudinary resizes on the fly, so lists load small thumbnails instead of full photos
export function thumbUrl(url, width) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}