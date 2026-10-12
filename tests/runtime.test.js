import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeFixture } from './runtime-fixture.js';

const extractCookie = (response, name) => response.headers.get('set-cookie')?.match(new RegExp(name + '=[a-f0-9]{64}'))?.[0];

test('real workerd + SQLite DO: login, concurrent attempts, protected routes and logout', async () => {
  const f = await runtimeFixture();
  try {
    assert.equal((await f.request('/login')).status, 200);
    assert.equal((await f.request('/api/session')).status, 401);
    assert.equal((await f.request('/auth/request', { body: { turnstile: 'invalid-token' } })).status, 403);
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => f.request('/auth/request', { body: { turnstile: 'test-token' } })));
    assert.equal(outcomes.filter((r) => r.status === 202).length, 1);
    assert.equal(f.network.sends.length, 1);
    const issued = outcomes.find((r) => r.status === 202);
    const challenge = extractCookie(issued, '__Host-folio-challenge');
    const attempts = await Promise.all(Array.from({ length: 12 }, () => f.request('/auth/verify', { body: { code: f.network.code }, cookies: challenge })));
    assert.equal(attempts.filter((r) => r.status === 200).length, 1);
    const session = extractCookie(attempts.find((r) => r.status === 200), '__Host-folio-session');
    assert.ok(session);
    for (const path of ['/', '/sites', '/settings', '/assets/admin.js', '/api/session', '/api/sites']) assert.equal((await f.request(path, { cookies: session })).status, 200);
    assert.equal((await f.request('/auth/logout', { body: {}, cookies: session })).status, 200);
    assert.equal((await f.request('/api/session', { cookies: session })).status, 401);
  } finally { await f.mf.dispose(); }
});

test('real SQLite DO: parallel failed guesses lock challenge and delivery failures fail closed', async () => {
  const f = await runtimeFixture();
  try {
    const issued = await f.request('/auth/request', { body: { turnstile: 'test-token' } });
    const challenge = extractCookie(issued, '__Host-folio-challenge');
    const wrong = f.network.code === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 15 }, () => f.request('/auth/verify', { body: { code: wrong }, cookies: challenge })));
    assert.equal((await f.request('/auth/verify', { body: { code: f.network.code }, cookies: challenge })).status, 403);
  } finally { await f.mf.dispose(); }
  const broken = await runtimeFixture();
  try {
    broken.network.failSend = true;
    assert.equal((await broken.request('/auth/request', { body: { turnstile: 'test-token' } })).status, 503);
    assert.equal((await broken.request('/auth/request', { body: { turnstile: 'test-token' } })).status, 429);
    assert.equal((await broken.request('/api/session')).status, 401);
  } finally { await broken.mf.dispose(); }
});

test('SQLite DO persists session and logout revocation across runtime restarts', async () => {
  const { mkdtemp, mkdir, rm } = await import('node:fs/promises');
  const { resolve, sep } = await import('node:path');
  const root = resolve('output/runtime');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(root + sep + 'auth-');
  let f;
  try {
    f = await runtimeFixture({ persistence: directory });
    const issued = await f.request('/auth/request', { body: { turnstile: 'test-token' } });
    const verified = await f.request('/auth/verify', { body: { code: f.network.code }, cookies: extractCookie(issued, '__Host-folio-challenge') });
    const session = extractCookie(verified, '__Host-folio-session');
    assert.ok(session);
    await f.mf.dispose(); f = await runtimeFixture({ persistence: directory });
    assert.equal((await f.request('/api/session', { cookies: session })).status, 200);
    assert.equal((await f.request('/auth/logout', { cookies: session, body: {} })).status, 200);
    await f.mf.dispose(); f = await runtimeFixture({ persistence: directory });
    assert.equal((await f.request('/api/session', { cookies: session })).status, 401);
  } finally {
    if (f) await f.mf.dispose();
    // Only the exact temp directory created by this test may be removed.
    if (!resolve(directory).startsWith(root + sep)) throw new Error('Unsafe cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});
