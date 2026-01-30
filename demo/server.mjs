import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './server/constants.mjs';
import { handleApi } from './server/api.mjs';
import { handleStatic } from './server/static.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const docsDir = path.join(__dirname, '..', 'docs');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }

  // Serve the tutorial from the docs site so it can be published via GitHub Pages.
  // This keeps the tutorial self-contained under /docs/tutorial while still reachable locally at /tutorial.
  if (url.pathname === '/tutorial' || url.pathname.startsWith('/tutorial/')) {
    return handleStatic(req, res, url, docsDir);
  }
  return handleStatic(req, res, url, publicDir);
});

server.listen(PORT, () => {
  console.log(`VSABrains demo running on http://localhost:${PORT}`);
});
