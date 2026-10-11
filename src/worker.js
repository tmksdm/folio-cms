import { authenticate } from './auth.js';
import { html, css, client } from './ui.js';

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

function reply(body, status = 200, type = 'application/json; charset=utf-8', extra = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, 'Content-Type': type, ...extra } });
}

export function createWorker(resolveKeys) {
  return {
    async fetch(request, env) {
      // Authenticate before routing: HTML, assets, API and unknown paths alike.
      const identity = await authenticate(request, env, resolveKeys);
      if (identity.status) return reply(JSON.stringify({ error: identity.code }), identity.status);
      if (!['GET', 'HEAD'].includes(request.method)) {
        return reply(JSON.stringify({ error: 'method_not_allowed' }), 405, undefined, { Allow: 'GET, HEAD' });
      }
      const path = new URL(request.url).pathname;
      let response;
      if (['/', '/sites', '/settings'].includes(path)) response = reply(html, 200, 'text/html; charset=utf-8');
      else if (path === '/assets/admin.css') response = reply(css, 200, 'text/css; charset=utf-8');
      else if (path === '/assets/admin.js') response = reply(client, 200, 'text/javascript; charset=utf-8');
      else if (path === '/assets/favicon.svg') response = reply('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#214c3e"/><text x="9" y="30" fill="white" font-family="Georgia,serif" font-size="32">f.</text></svg>', 200, 'image/svg+xml');
      else if (path === '/api/session') response = reply(JSON.stringify({ email: identity.email, stage: '01' }));
      else if (path === '/api/sites') response = reply(JSON.stringify({ sites: [], integration: 'not_connected' }));
      else response = reply(JSON.stringify({ error: 'not_found' }), 404);
      if (request.method === 'HEAD') return new Response(null, { status: response.status, headers: response.headers });
      return response;
    },
  };
}

export default createWorker();
