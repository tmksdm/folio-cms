// Local Cloudflare runtime with real SQLite-backed DO. Only upstream email and
// CAPTCHA are mocked; this module is never bundled into the production Worker.
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';

export async function runtimeFixture({ preview = false, persistence = false } = {}) {
  const origin = preview ? 'https://127.0.0.1:4173' : 'https://admin.example.test';
  const network = { sends: [], code: null, failSend: false, failTurnstile: false };
  const modules = await Promise.all(['worker.js', 'auth.js', 'auth-store.js', 'ui.js', 'login.js'].map(async (name) => ({ type: 'ESModule', path: 'src/' + name, contents: await readFile(new URL('../src/' + name, import.meta.url), 'utf8') })));
  if (preview) modules.unshift({ type: 'ESModule', path: 'tests/entry.js', contents: `import worker from '../src/worker.js'; export { AuthStore } from '../src/auth-store.js'; export default { fetch(request, env) { if(new URL(request.url).pathname === '/__test/code') return env.TEST_CODE.fetch(request); return worker.fetch(request, env); } };` });
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'folio-test', modules, modulesRoot: process.cwd(), compatibilityDate: '2026-10-11',
    host: '127.0.0.1', port: preview ? 4173 : 0, https: preview, cf: false,
    log: new Log(LogLevel.ERROR), telemetry: { enabled: false },
    durableObjects: { AUTH_STORE: { className: 'AuthStore', useSQLite: true, unsafeUniqueKey: 'folio-test-auth' } },
    ...(persistence ? { resourcePersistencePath: persistence } : {}),
    bindings: { APP_ORIGIN: origin, ALLOWED_EMAIL: 'owner@example.test', AUTH_SECRET: 'a'.repeat(64), RESEND_API_KEY: 're_test_only', TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: 'test-only' },
    ...(preview ? { serviceBindings: { TEST_CODE: () => Response.json({ code: network.code }) } } : {}),
    outboundService: async (request) => {
      if (request.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        const body = await request.json();
        return Response.json({ success: !network.failTurnstile && body.response === 'test-token', hostname: new URL(origin).hostname, action: 'login' });
      }
      if (request.url === 'https://api.resend.com/emails') {
        const body = await request.json(); network.sends.push(body);
        network.code = body.text.match(/\d{6}/)[0];
        return network.failSend ? Response.json({}, { status: 503 }) : Response.json({ id: 'test-message' });
      }
      return new Response(null, { status: 503 });
    },
  }));
  await mf.ready;
  const request = (path, { body, cookies, headers = {} } = {}) => mf.dispatchFetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json' }), ...(cookies ? { Cookie: cookies } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
  });
  return { mf, network, request, origin };
}
