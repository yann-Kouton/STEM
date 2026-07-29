const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractPublicIdFromUrl(url) {
  if (!url) return null;
  const regex = /\/upload\/(?:v\d+\/)?(.+?)(\.[a-zA-Z]+|\?|$)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1].replace(/\.[^.]+$/, '');
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl' });
  }
  const publicId = extractPublicIdFromUrl(imageUrl);
  if (!publicId) {
    return res.status(400).json({ error: 'Invalid Cloudinary URL' });
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};