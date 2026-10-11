import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fixture } from './fixtures.js';
import { authConfig, SESSION_COOKIE, CHALLENGE_COOKIE, cookieToken, randomCode } from '../src/auth.js';
import { client } from '../src/ui.js';
import { loginClient } from '../src/login.js';

async function check(fn) { const f = fixture(); try { await fn(f); } finally { f.close(); } }

test('missing configuration fails closed on every public and protected route', () => check(async (f) => {
  delete f.env.AUTH_SECRET;
  for (const path of ['/', '/login', '/assets/login.js', '/assets/admin.js', '/api/session', '/unknown']) assert.equal((await f.request(path)).status, 503);
}));
test('config requires canonical HTTPS origin, exact email and strong secret', () => check(async (f) => {
  for (const origin of ['http://admin.example.test', 'https://admin.example.test/', 'https://user@admin.example.test', 'https://admin.example.test/path']) assert.equal(authConfig({ ...f.env, APP_ORIGIN: origin }), null);
  for (const email of ['*', 'a@example.test,b@example.test', 'a@example.test ']) assert.equal(authConfig({ ...f.env, ALLOWED_EMAIL: email }), null);
  for (const secret of ['', 'password', 'z'.repeat(64)]) assert.equal(authConfig({ ...f.env, AUTH_SECRET: secret }), null);
}));
test('only login assets are public; admin pages redirect and APIs/assets reject anonymous users', () => check(async (f) => {
  for (const path of ['/login', '/assets/login.js', '/assets/login.css']) assert.equal((await f.request(path)).status, 200);
  for (const path of ['/', '/sites', '/settings']) { const res = await f.request(path); assert.equal(res.status, 303); assert.match(res.headers.get('location'), /^\/login\?next=/); }
  for (const path of ['/assets/admin.js', '/assets/admin.css', '/assets/favicon.svg', '/api/session', '/api/sites', '/unknown']) assert.equal((await f.request(path)).status, 401);
  assert.equal((await f.request('/api/session', { headers: { 'cf-access-jwt-assertion': 'anything', 'cf-access-authenticated-user-email': f.env.ALLOWED_EMAIL } })).status, 401);
}));
test('auth POST endpoints reject CSRF, wrong media type, huge and malformed bodies', () => check(async (f) => {
  for (const path of ['/auth/request', '/auth/verify', '/auth/logout']) {
    assert.equal((await f.request(path)).status, 405);
    for (const headers of [{ Origin: 'https://evil.test' }, { Origin: '' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await f.request(path, { body: {}, headers })).status, 403);
    for (const body of ['{', '[]', 'null', 'x'.repeat(4097)]) assert.equal((await f.request(path, { body })).status, 400);
    assert.equal((await f.request(path, { body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 400);
  }
}));
test('Turnstile validates success, expected hostname/action and handles failure', () => check(async (f) => {
  assert.equal((await f.request('/auth/request', { body: { email: f.env.ALLOWED_EMAIL } })).status, 403);
  for (const [key, value] of [['invalidTurnstile', true], ['hostname', 'evil.test'], ['action', 'other']]) {
    const before = f.network[key]; f.network[key] = value;
    assert.equal((await f.send()).status, 403); f.network[key] = before;
  }
  f.network.failTurnstile = true;
  const response = await f.send(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /sensitive/);
  assert.equal(f.network.sends.length, 0);
}));
test('non-owner receives generic response and cannot establish session', () => check(async (f) => {
  const response = await f.send('other@example.test');
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { accepted: true });
  assert.ok(f.cookieValue(response, CHALLENGE_COOKIE)); assert.equal(f.network.sends.length, 0);
  assert.equal((await f.verify(response, '123456')).status, 403);
}));
test('full login uses owner email, one-time code, hashed state and protected cookie', () => check(async (f) => {
  const issued = await f.send(f.env.ALLOWED_EMAIL.toUpperCase());
  assert.equal(issued.status, 202); assert.match(f.code(), /^\d{6}$/);
  assert.deepEqual(f.network.sends[0].to, [f.env.ALLOWED_EMAIL]);
  assert.equal(f.network.sends[0].from, 'Folio <onboarding@resend.dev>');
  const verified = await f.verify(issued); assert.equal(verified.status, 200);
  const setCookie = verified.headers.getSetCookie().find((value) => value.startsWith(SESSION_COOKIE));
  assert.match(setCookie, /Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600$/); assert.doesNotMatch(setCookie, /Domain=/);
  assert.deepEqual(await verified.clone().json(), { authenticated: true });
  const cookies = f.cookieValue(verified, SESSION_COOKIE);
  assert.equal((await f.request('/api/session', { cookies })).status, 200);
  const stored = f.storage.sql.exec('SELECT value FROM auth_state WHERE id = 1').toArray()[0].value;
  assert.ok(!stored.includes(cookies.split('=')[1])); assert.ok(!stored.includes(f.code()));
  assert.equal((await f.verify(issued)).status, 403);
}));
test('code is bound to requesting browser; a foreign browser does not consume guesses', () => check(async (f) => {
  const issued = await f.send();
  for (let i = 0; i < 8; i++) assert.equal((await f.request('/auth/verify', { body: { code: f.code() } })).status, 403);
  assert.equal((await f.verify(issued)).status, 200);
}));
test('parallel correct code submissions yield exactly one session', () => check(async (f) => {
  const issued = await f.send();
  const responses = await Promise.all(Array.from({ length: 20 }, () => f.verify(issued)));
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(responses.filter((r) => r.status === 403).length, 19);
}));
test('parallel wrong attempts consume at most five guesses and invalidate code', () => check(async (f) => {
  const issued = await f.send(); const wrong = f.code() === '000000' ? '111111' : '000000';
  await Promise.all(Array.from({ length: 20 }, () => f.verify(issued, wrong)));
  assert.equal((await f.verify(issued)).status, 403);
  const state = JSON.parse(f.storage.sql.exec('SELECT value FROM auth_state WHERE id = 1').toArray()[0].value);
  assert.equal(state.guesses.length, 5); assert.equal(state.challenge, null);
}));
test('parallel send requests charge durable reservation before network, allowing one email', () => check(async (f) => {
  const responses = await Promise.all(Array.from({ length: 20 }, () => f.send()));
  assert.equal(responses.filter((r) => r.status === 202).length, 1);
  assert.equal(responses.filter((r) => r.status === 429).length, 19);
  assert.equal(f.network.sends.length, 1);
}));
test('request flood is bounded before calling Turnstile', () => check(async (f) => {
  const responses = await Promise.all(Array.from({ length: 40 }, () => f.send('other@example.test')));
  assert.equal(responses.filter((r) => r.status === 429).length, 10); assert.equal(f.network.turnstile, 30);
}));
test('upstream send failure produces no usable challenge and still charges cooldown', () => check(async (f) => {
  f.network.failSend = true;
  const issued = await f.send(); assert.equal(issued.status, 503); assert.doesNotMatch(await issued.text(), /secret upstream/);
  assert.equal(issued.headers.getSetCookie().length, 0); assert.equal((await f.send()).status, 429);
  assert.equal((await f.request('/auth/verify', { body: { code: f.code() } })).status, 403);
}));
test('code expires at ten minutes and replacement invalidates earlier browser challenge', () => check(async (f) => {
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    const first = await f.send(); now += 60_000;
    const second = await f.send(); assert.equal(second.status, 202);
    assert.equal((await f.verify(first)).status, 403);
    now += 600_000; assert.equal((await f.verify(second)).status, 403);
  } finally { Date.now = originalNow; }
}));
test('hourly/day sending quotas survive new challenges', () => check(async (f) => {
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    for (let i = 0; i < 5; i++) { assert.equal((await f.send()).status, 202); now += 60_000; }
    assert.equal((await f.send()).status, 429);
    for (let hour = 1; hour < 4; hour++) { now += 3_600_000; for (let i = 0; i < 5; i++) { assert.equal((await f.send()).status, 202); now += 60_000; } }
    now += 3_600_000; assert.equal((await f.send()).status, 429);
  } finally { Date.now = originalNow; }
}));
test('sessions persist across object restart, expire after an hour, logout revokes saved cookie', () => check(async (f) => {
  const cookies = await f.login(); f.restart();
  assert.equal((await f.request('/api/session', { cookies })).status, 200);
  const loggedOut = await f.request('/auth/logout', { cookies, body: {} }); assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.getSetCookie().join(';'), /Max-Age=0/);
  assert.equal((await f.request('/api/session', { cookies })).status, 401);
  const originalNow = Date.now; Date.now = () => originalNow() + 60_000;
  let another; try { another = await f.login(); } finally { Date.now = originalNow; }
  Date.now = () => originalNow() + 3_660_001;
  try { assert.equal((await f.request('/api/session', { cookies: another })).status, 401); } finally { Date.now = originalNow; }
}));
test('secret changes invalidate existing sessions; storage failure fails closed', () => check(async (f) => {
  const cookies = await f.login(); f.env.AUTH_SECRET = 'b'.repeat(64);
  assert.equal((await f.request('/api/session', { cookies })).status, 401);
  f.env.AUTH_STORE.get = () => { throw new Error('private storage detail'); };
  const res = await f.request('/api/session', { cookies }); assert.equal(res.status, 503); assert.doesNotMatch(await res.text(), /private/);
}));
test('authenticated routes retain security headers, HEAD semantics and Stage 01 boundaries', () => check(async (f) => {
  const cookies = await f.login();
  for (const path of ['/', '/sites', '/settings', '/assets/admin.js', '/assets/admin.css', '/assets/favicon.svg', '/api/sites']) {
    const res = await f.request(path, { cookies }); assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store'); assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  }
  assert.deepEqual(await (await f.request('/api/sites', { cookies })).json(), { sites: [], integration: 'not_connected' });
  assert.equal((await f.request('/api/sites', { cookies, body: {} })).status, 405);
  assert.equal((await f.request('/unknown', { cookies })).status, 404);
  assert.equal(await (await f.request('/sites', { cookies, method: 'HEAD' })).text(), '');
}));
test('cookies reject duplicates and malformed values; client parses and never stores tokens', () => {
  assert.equal(cookieToken(new Request('https://example.test', { headers: { cookie: `${SESSION_COOKIE}=bad` } }), SESSION_COOKIE), null);
  const pair = `${SESSION_COOKIE}=${'a'.repeat(64)}`;
  assert.equal(cookieToken(new Request('https://example.test', { headers: { cookie: `${pair}; ${pair}` } }), SESSION_COOKIE), null);
  for (const code of [client, loginClient]) { assert.doesNotThrow(() => new vm.Script(code)); assert.doesNotMatch(code, /innerHTML|localStorage|sessionStorage/); }
  for (let i = 0; i < 100; i++) assert.match(randomCode(), /^\d{6}$/);
});

test('foreign IP request flood and unrelated verification cookies cannot lock owner out', () => check(async (f) => {
  await Promise.all(Array.from({ length: 40 }, () => f.request('/auth/request', { body: { email: 'other@example.test', turnstile: 'token' }, headers: { 'cf-connecting-ip': '198.51.100.1' } })));
  const issued = await f.request('/auth/request', { body: { email: f.env.ALLOWED_EMAIL, turnstile: 'token' }, headers: { 'cf-connecting-ip': '198.51.100.2' } });
  assert.equal(issued.status, 202);
  await Promise.all(Array.from({ length: 80 }, () => f.request('/auth/verify', { body: { code: '000000' } })));
  assert.equal((await f.verify(issued)).status, 200);
}));
test('request IP counters are bounded and expire without resetting owner send quota', () => check(async (f) => {
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    for (let i = 0; i < 256; i++) assert.equal((await f.request('/auth/request', { body: { email: 'other@example.test', turnstile: 'token' }, headers: { 'cf-connecting-ip': String(i) } })).status, 202);
    assert.equal((await f.send('other@example.test')).status, 429);
    now += 60_000; assert.equal((await f.send()).status, 202);
  } finally { Date.now = originalNow; }
}));

test('malformed codes consume attempts, and replacing a code retains attempt history', () => check(async (f) => {
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    const issued = await f.send();
    for (const wrong of ['', '123', 'abcdef', 123456, null]) assert.equal((await f.verify(issued, wrong)).status, 403);
    assert.equal((await f.verify(issued)).status, 403);
    now += 60_000;
    const next = await f.send();
    assert.equal((await f.verify(next)).status, 200);
    const state = JSON.parse(f.storage.sql.exec('SELECT value FROM auth_state WHERE id = 1').toArray()[0].value);
    assert.equal(state.guesses.length, 6);
  } finally { Date.now = originalNow; }
}));
test('changing configured owner email or origin revokes sessions', async () => {
  for (const key of ['ALLOWED_EMAIL', 'APP_ORIGIN']) await check(async (f) => {
    const cookies = await f.login();
    f.env[key] = key === 'ALLOWED_EMAIL' ? 'another@example.test' : 'https://another.example.test';
    assert.equal((await f.request('/api/session', { cookies })).status, 401);
  });
});
test('pending or abandoned delivery cannot be used after object restart', () => check(async (f) => {
  const originalFetch = globalThis.fetch;
  let release;
  let captured;
  globalThis.fetch = async (url, options) => {
    if (String(url) !== 'https://api.resend.com/emails') return originalFetch(url, options);
    captured = JSON.parse(options.body);
    await new Promise((resolve) => { release = resolve; });
    return Response.json({ id: 'delayed-message' });
  };
  const pending = f.send();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  f.restart();
  const state = JSON.parse(f.storage.sql.exec('SELECT value FROM auth_state WHERE id = 1').toArray()[0].value);
  assert.equal(state.challenge.ready, false);
  assert.equal((await f.request('/auth/verify', { body: { code: captured.text.match(/\d{6}/)[0] } })).status, 403);
  assert.equal((await f.send()).status, 429);
  release(); await pending;
}));
test('later response of an older email cannot reactivate a replaced challenge', () => check(async (f) => {
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  const originalFetch = globalThis.fetch; let release; let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://api.resend.com/emails' && ++calls === 1) {
      await new Promise((resolve) => { release = resolve; });
      return Response.json({ id: 'older-message' });
    }
    return originalFetch(url, options);
  };
  try {
    const older = f.send();
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    now += 60_000;
    const newer = await f.send(); assert.equal(newer.status, 202);
    release(); assert.equal((await older).status, 503);
    assert.equal((await f.verify(newer)).status, 200);
  } finally { Date.now = originalNow; }
}));
