import path from 'node:path';
import fs from 'node:fs/promises';

export async function handleStatic(req, res, url, publicDir) {
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = decodeURIComponent(filePath);
  const resolvedPath = path.normalize(path.join(publicDir, filePath));

  if (!resolvedPath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (stat.isDirectory()) {
      return handleStatic(req, res, new URL('/index.html', url), publicDir);
    }
    const data = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    }[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
}
