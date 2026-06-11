import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function saveDatasetImage(payload, { rootDir = process.env.DATA_DIR || 'data', now = new Date() } = {}) {
  validateImagePayload(payload);

  const baseName = imageBaseName(payload.imageFileName);
  const timestamp = formatTimestamp(now);
  const folderName = `${timestamp}_${baseName}`;
  const datasetDir = join(rootDir, folderName);
  const imageDir = join(datasetDir, 'image');
  const masksDir = join(datasetDir, 'masks');
  const imagePath = join(imageDir, `${baseName}.png`);

  await mkdir(imageDir, { recursive: true });
  await mkdir(masksDir, { recursive: true });
  await writeFile(imagePath, decodeDataUrl(payload.imageDataUrl));

  return {
    folderName,
    path: datasetDir,
    files: {
      image: imagePath,
    },
  };
}

export async function saveDatasetMasks(payload, { rootDir = process.env.DATA_DIR || 'data' } = {}) {
  validateMasksPayload(payload);

  const datasetDir = join(rootDir, safeFolderName(payload.folderName));
  const masksDir = join(datasetDir, 'masks');
  const maskPaths = payload.masks.map((mask) => join(masksDir, ensurePngFilename(mask.fileName)));

  await mkdir(masksDir, { recursive: true });
  await Promise.all(payload.masks.map((mask, index) => writeFile(maskPaths[index], decodeDataUrl(mask.dataUrl))));

  return {
    folderName: payload.folderName,
    path: datasetDir,
    files: {
      masks: maskPaths,
    },
  };
}

function validateImagePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Image upload payload is required.');
  }
  if (typeof payload.imageFileName !== 'string' || payload.imageFileName.trim() === '') {
    throw new Error('imageFileName is required.');
  }
  if (typeof payload.imageDataUrl !== 'string') {
    throw new Error('imageDataUrl is required.');
  }
}

function validateMasksPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Mask export payload is required.');
  }
  if (typeof payload.folderName !== 'string' || payload.folderName.trim() === '') {
    throw new Error('folderName is required.');
  }
  safeFolderName(payload.folderName);
  if (!Array.isArray(payload.masks) || payload.masks.length === 0) {
    throw new Error('At least one mask is required.');
  }
  payload.masks.forEach((mask) => {
    if (!mask || typeof mask.fileName !== 'string' || typeof mask.dataUrl !== 'string') {
      throw new Error('Each mask requires fileName and dataUrl.');
    }
  });
}

function imageBaseName(fileName) {
  return sanitizeFilename(fileName.replace(/\.[^.]+$/, '') || 'image');
}

function ensurePngFilename(fileName) {
  const baseName = sanitizeFilename(fileName.replace(/\.[^.]+$/, '') || 'mask');
  return `${baseName}.png`;
}

function safeFolderName(folderName) {
  if (folderName !== sanitizeFilename(folderName)) {
    throw new Error('Invalid dataset folder name.');
  }

  return folderName;
}

function sanitizeFilename(value) {
  return value.trim().replace(/[^A-Za-z0-9가-힣._-]+/g, '_').replace(/^_+|_+$/g, '') || 'image';
}

function decodeDataUrl(dataUrl) {
  const match = /^data:[^;,]+;base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw new Error('Expected a base64 data URL.');
  }

  return Buffer.from(match[1], 'base64');
}

function formatTimestamp(date) {
  return [
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-'),
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-'),
  ].join('_');
}

function pad(value) {
  return String(value).padStart(2, '0');
}
