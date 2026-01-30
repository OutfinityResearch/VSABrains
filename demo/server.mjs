import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './server/constants.mjs';
import { handleApi } from './server/api.mjs';
import { handleStatic } from './server/static.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }
  return handleStatic(req, res, url, publicDir);
});

server.listen(PORT, () => {
  console.log(`VSABrains demo running on http://localhost:${PORT}`);
});
