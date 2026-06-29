import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveDatasetImage, saveDatasetImageFile, saveDatasetMasks } from './datasetStorage.mjs';
import { convertTiffBufferToPngDataUrl, hasTiffSignature } from './tiffConversion.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const dataDir = process.env.DATA_DIR || resolve(rootDir, 'data');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/upload-image') {
      const payload = JSON.parse(await readRequestBody(request));
      const result = await saveDatasetImage(payload, { rootDir: dataDir });
      sendJson(response, 200, { folderName: result.folderName, path: result.path });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/upload-image-file') {
      const imageBuffer = await readRequestBuffer(request);
      const imageFileName = request.headers['x-filename'] || 'image';
      const result = await saveDatasetImageFile(
        { imageFileName: String(imageFileName), imageBuffer },
        { rootDir: dataDir },
      );
      const payload = { folderName: result.folderName, path: result.path };

      if (isTiffFilename(String(imageFileName)) || hasTiffSignature(imageBuffer)) {
        payload.imageDataUrl = await convertTiffBufferToPngDataUrl(imageBuffer);
      }

      sendJson(response, 200, payload);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/convert-tiff') {
      const imageBuffer = await readRequestBuffer(request);
      sendJson(response, 200, { imageDataUrl: await convertTiffBufferToPngDataUrl(imageBuffer) });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/export-masks') {
      const payload = JSON.parse(await readRequestBody(request));
      const result = await saveDatasetMasks(payload, { rootDir: dataDir });
      sendJson(response, 200, { folderName: result.folderName, path: result.path });
      return;
    }

    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    await serveStatic(request.url ?? '/', response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Radial annotator listening on http://${host}:${port}`);
  console.log(`Dataset exports will be saved under ${dataDir}`);
});

async function serveStatic(url, response) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost`).pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = safeJoin(distDir, requestedPath);
  const existingFilePath = (await fileExists(filePath)) ? filePath : join(distDir, 'index.html');
  const fileInfo = await stat(existingFilePath);

  response.writeHead(200, {
    'Content-Type': contentType(existingFilePath),
    'Content-Length': fileInfo.size,
  });
  createReadStream(existingFilePath).pipe(response);
}

function safeJoin(baseDir, pathname) {
  const resolved = resolve(baseDir, `.${normalize(pathname)}`);

  if (!resolved.startsWith(baseDir)) {
    return join(baseDir, 'index.html');
  }

  return resolved;
}

async function fileExists(filePath) {
  try {
    const fileInfo = await stat(filePath);
    return fileInfo.isFile();
  } catch {
    return false;
  }
}

function readRequestBody(request) {
  return readRequestBuffer(request).then((buffer) => buffer.toString('utf8'));
}

function readRequestBuffer(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 150 * 1024 * 1024) {
        rejectBody(new Error('Dataset export payload is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', rejectBody);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function isTiffFilename(fileName) {
  return /\.(tif|tiff)$/i.test(fileName);
}
