const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function uploadToImageKit(buffer, fileName, folder = '/safelancer') {
  const response = await imagekit.upload({
    file: buffer,
    fileName: Date.now() + '-' + fileName.replace(/\s/g, '_'),
    folder,
  });
  return response.url;
}

module.exports = { imagekit, uploadToImageKit };
