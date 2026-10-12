import { authConfig, callAuth, cookieToken, cookie, SESSION_COOKIE, CHALLENGE_COOKIE, CODE_TTL, SESSION_TTL, randomToken } from './auth.js';
import { html, css, client } from './ui.js';
import { loginHtml, loginClient, loginCss } from './login.js';
export { AuthStore } from './auth-store.js';

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};
function reply(body, status = 200, type = 'application/json; charset=utf-8', extra = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, 'Content-Type': type, ...extra } });
}
const failure = (status, error) => reply(JSON.stringify({ error }), status);
const clearChallenge = () => cookie(CHALLENGE_COOKIE, '', 0);
const clearSession = () => cookie(SESSION_COOKIE, '', 0);

async function readJson(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new Error('body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Error('body'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body');
  return value;
}

export default {
  async fetch(request, env) {
    try {
      const config = authConfig(env);
      if (!config) return failure(503, 'auth_not_configured');
      const url = new URL(request.url);
      if (url.origin !== config.origin) return failure(403, 'origin_denied');
      const path = url.pathname;
      const get = ['GET', 'HEAD'].includes(request.method);
      const publicAssets = { '/assets/login.css': [css + loginCss, 'text/css; charset=utf-8'], '/assets/login.js': [loginClient, 'text/javascript; charset=utf-8'] };
      if (get && (path === '/login' || publicAssets[path])) {
        const asset = publicAssets[path];
        const response = asset ? reply(asset[0], 200, asset[1]) : reply(loginHtml(env.TURNSTILE_SITE_KEY), 200, 'text/html; charset=utf-8', {
          'Content-Security-Policy': "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self'; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
        });
        return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
      }
      if (['/auth/request', '/auth/verify', '/auth/logout'].includes(path)) {
        if (request.method !== 'POST') return failure(405, 'method_not_allowed');
        if (request.headers.get('origin') !== config.origin || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site'))) return failure(403, 'origin_denied');
        let body;
        try { body = await readJson(request); } catch { return failure(400, 'invalid_request'); }
        if (path === '/auth/request') {
          const outcome = await callAuth(env, '/request', { turnstile: body.turnstile, ip: request.headers.get('cf-connecting-ip') });
          if (outcome.status !== 202) return failure(outcome.status, outcome.error);
          // Neutral public response; the recipient is never disclosed.
          return reply(JSON.stringify({ accepted: true }), 202, undefined, { 'Set-Cookie': cookie(CHALLENGE_COOKIE, outcome.challenge || randomToken(), CODE_TTL) });
        }
        if (path === '/auth/verify') {
          const outcome = await callAuth(env, '/verify', { code: body.code, challenge: cookieToken(request, CHALLENGE_COOKIE) });
          if (outcome.status !== 200) return failure(outcome.status, outcome.error);
          const response = reply(JSON.stringify({ authenticated: true }));
          response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, outcome.token, SESSION_TTL));
          response.headers.append('Set-Cookie', clearChallenge());
          return response;
        }
        const outcome = await callAuth(env, '/logout', { token: cookieToken(request, SESSION_COOKIE) });
        if (outcome.status !== 200) return failure(outcome.status, outcome.error);
        const response = reply(JSON.stringify({ signedOut: true }));
        response.headers.append('Set-Cookie', clearSession());
        response.headers.append('Set-Cookie', clearChallenge());
        return response;
      }
      // All remaining routes, including assets and unknown paths, require a session.
      const token = cookieToken(request, SESSION_COOKIE);
      const identity = token ? await callAuth(env, '/session', { token }) : { status: 401, error: 'authentication_required' };
      if (identity.status !== 200) {
        if (identity.status === 401 && get && ['/', '/sites', '/settings'].includes(path)) {
          return reply(null, 303, undefined, { Location: `/login?next=${encodeURIComponent(path)}`, 'Set-Cookie': clearSession() });
        }
        return failure(identity.status, identity.error);
      }
      if (!get) return reply(JSON.stringify({ error: 'method_not_allowed' }), 405, undefined, { Allow: 'GET, HEAD' });
      let response;
      if (['/', '/sites', '/settings'].includes(path)) response = reply(html, 200, 'text/html; charset=utf-8');
      else if (path === '/assets/admin.css') response = reply(css, 200, 'text/css; charset=utf-8');
      else if (path === '/assets/admin.js') response = reply(client, 200, 'text/javascript; charset=utf-8');
      else if (path === '/assets/favicon.svg') response = reply('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#214c3e"/><text x="9" y="30" fill="white" font-family="Georgia,serif" font-size="32">f.</text></svg>', 200, 'image/svg+xml');
      else if (path === '/api/session') response = reply(JSON.stringify({ email: identity.email, stage: '01' }));
      else if (path === '/api/sites') response = reply(JSON.stringify({ sites: [], integration: 'not_connected' }));
      else response = failure(404, 'not_found');
      return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
    } catch { return failure(503, 'auth_unavailable'); }
  },
};
