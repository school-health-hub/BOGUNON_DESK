import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

// Serve only the disposable product dist, never repository files or credentials.
export async function startServer(directory) {
  const root = await fs.realpath(directory);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };
  const server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const url = new URL(request.url, 'http://127.0.0.1');
      const requested = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      const relative = path.relative(root, requested);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
      const candidate = requested === root ? path.join(root, 'index.html') : requested;
      const file = await fs.realpath(candidate);
      const realRelative = path.relative(root, file);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) { response.writeHead(403).end(); return; }
      if (!(await fs.stat(file)).isFile()) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store');
      response.end(request.method === 'HEAD' ? undefined : await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
