// Test-only adapters. Real SQLite transactions, mocked upstream network, no bypass
// in production. Email contents remain in memory and are never printed.
import { DatabaseSync } from 'node:sqlite';
import { AuthStore } from '../src/auth-store.js';
import worker from '../src/worker.js';
import { SESSION_COOKIE, CHALLENGE_COOKIE } from '../src/auth.js';

export function sqliteStorage(database = new DatabaseSync(':memory:')) {
  return {
    database,
    sql: { exec(sql, ...args) {
      const statement = database.prepare(sql);
      if (/^SELECT/i.test(sql)) return { toArray: () => statement.all(...args) };
      statement.run(...args);
      return { toArray: () => [] };
    } },
    transactionSync(fn) {
      database.exec('BEGIN');
      try { const result = fn(); database.exec('COMMIT'); return result; }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
}

export function fixture() {
  const storage = sqliteStorage();
  const env = {
    APP_ORIGIN: 'https://admin.example.test', ALLOWED_EMAIL: 'owner@example.test',
    AUTH_SECRET: 'a'.repeat(64), RESEND_API_KEY: 're_test_only',
    TURNSTILE_SITE_KEY: 'test-key', TURNSTILE_SECRET_KEY: 'test-only',
  };
  const network = { sends: [], turnstile: 0, failSend: false, failTurnstile: false, invalidTurnstile: false, hostname: 'admin.example.test', action: 'login' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (String(url).includes('siteverify')) {
      network.turnstile++;
      if (network.failTurnstile) throw new Error('sensitive error');
      return Response.json({ success: !network.invalidTurnstile, hostname: network.hostname, action: network.action });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      network.sends.push(JSON.parse(options.body));
      if (network.failSend) return Response.json({ error: 'secret upstream response' }, { status: 500 });
      return Response.json({ id: 'test-message' });
    }
    throw new Error('Unexpected network request');
  };
  let store;
  const namespace = {
    idFromName(name) { if (name !== 'owner-auth-v1') throw new Error('wrong shard'); return name; },
    get() { return { fetch: (request) => store.fetch(request) }; },
  };
  env.AUTH_STORE = namespace;
  const restart = () => { store = new AuthStore({ storage }, env); };
  restart();
  const request = (path, { body, cookies, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) => worker.fetch(new Request(env.APP_ORIGIN + path, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: env.APP_ORIGIN } : {}), ...(cookies ? { Cookie: cookies } : {}), ...headers },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }), env);
  const send = () => request('/auth/request', { body: { turnstile: 'test-token' } });
  const cookieValue = (response, name) => response.headers.getSetCookie().find((value) => value.startsWith(name + '='))?.split(';')[0];
  const code = () => network.sends.at(-1)?.text.match(/\d{6}/)[0];
  const verify = (response, value = code()) => request('/auth/verify', { cookies: cookieValue(response, CHALLENGE_COOKIE), body: { code: value } });
  const login = async () => {
    const issued = await send();
    const response = await verify(issued);
    if (response.status !== 200) throw new Error('fixture login failed');
    return cookieValue(response, SESSION_COOKIE);
  };
  return { env, network, request, send, verify, login, code, storage, restart, cookieValue,
    close() { globalThis.fetch = originalFetch; storage.database.close(); } };
}
