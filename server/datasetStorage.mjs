import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function saveDatasetExport(payload, { rootDir = process.env.DATA_DIR || 'data', now = new Date() } = {}) {
  validatePayload(payload);

  const baseName = imageBaseName(payload.imageFileName);
  const timestamp = formatTimestamp(now);
  const folderName = `${timestamp}_${baseName}`;
  const datasetDir = join(rootDir, folderName);
  const imageDir = join(datasetDir, 'image');
  const masksDir = join(datasetDir, 'masks');

  await mkdir(imageDir, { recursive: true });
  await mkdir(masksDir, { recursive: true });

  const imagePath = join(imageDir, `${baseName}.png`);
  const xlsxPath = join(datasetDir, `${folderName}.xlsx`);
  const maskPaths = payload.masks.map((mask) => join(masksDir, ensurePngFilename(mask.fileName)));

  await writeFile(imagePath, decodeDataUrl(payload.imageDataUrl));
  await Promise.all(payload.masks.map((mask, index) => writeFile(maskPaths[index], decodeDataUrl(mask.dataUrl))));
  await writeFile(xlsxPath, decodeDataUrl(payload.xlsxDataUrl));

  return {
    folderName,
    path: datasetDir,
    files: {
      image: imagePath,
      masks: maskPaths,
      workbook: xlsxPath,
    },
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Dataset payload is required.');
  }
  if (typeof payload.imageFileName !== 'string' || payload.imageFileName.trim() === '') {
    throw new Error('imageFileName is required.');
  }
  if (typeof payload.imageDataUrl !== 'string') {
    throw new Error('imageDataUrl is required.');
  }
  if (typeof payload.xlsxDataUrl !== 'string') {
    throw new Error('xlsxDataUrl is required.');
  }
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
