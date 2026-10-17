import { misc } from '../api/misc.js';

async function compressImage(file, maxSide = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob || file;
}

export async function uploadImage(file, { folder = 'listings', onProgress } = {}) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Image is too large. Choose one under 15 MB.');

  const blob = await compressImage(file);
  const config = await misc.uploads.sign({ folder });

  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', config.uploadPreset);
  form.append('folder', config.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data.error?.message || 'Upload failed. Try again.'));
      } catch {
        reject(new Error('Upload failed. Try again.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.send(form);
  });
}
