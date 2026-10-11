// TEST FIXTURE ONLY. Not a login service and not included in the Worker bundle.
// Ephemeral RSA keys exercise the real verifier; no production auth bypass exists.
import http from 'node:http';
import { createWorker } from '../src/worker.js';
import { env, signingFixture } from './fixtures.js';

const fixture = await signingFixture();
const worker = createWorker(() => fixture.keys);
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/cdn-cgi/')) {
      res.writeHead(501, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Cloudflare Access не работает в тестовом стенде.');
      return;
    }
    const headers = new Headers(req.headers);
    headers.set('cf-access-jwt-assertion', await fixture.sign());
    const request = new Request(`http://127.0.0.1:4173${req.url}`, { method: req.method, headers });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Test fixture error');
  }
});
server.listen(4173, '127.0.0.1', () => console.log('UI test fixture: http://127.0.0.1:4173 (test signer, NOT Cloudflare login)'));
