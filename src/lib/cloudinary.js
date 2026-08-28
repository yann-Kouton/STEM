const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// resourceType: 'image' (photos), 'raw' (xlsx, docx, pdf, tout fichier non-média), 'video'
export async function uploadToCloudinary(file, resourceType = 'image') {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary non configuré. Vérifiez vos variables d\'environnement.');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Erreur lors de l\'upload vers Cloudinary');
  }
  const data = await response.json();
  return {
    url: data.secure_url,
    fileName: data.original_filename ? `${data.original_filename}.${data.format || ''}`.replace(/\.$/, '') : file.name,
    format: data.format || file.name.split('.').pop(),
    bytes: data.bytes,
  };
}
