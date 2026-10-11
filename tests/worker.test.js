import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SignJWT } from 'jose';
import productionWorker, { createWorker } from '../src/worker.js';
import { accessConfig } from '../src/auth.js';
import { client } from '../src/ui.js';
import { env, signingFixture } from './fixtures.js';

const fixture = await signingFixture();
const worker = createWorker(() => fixture.keys);
const validToken = await fixture.sign();
const request = (path = '/', token = validToken, method = 'GET') => new Request(`https://admin.example.test${path}`, {
  method, headers: token ? { 'cf-access-jwt-assertion': token } : {},
});

test('production denies every route until explicitly configured, even with a test token', async () => {
  for (const path of ['/', '/sites', '/settings', '/assets/admin.css', '/assets/admin.js', '/assets/favicon.svg', '/api/session', '/api/sites', '/unknown']) {
    const response = await productionWorker.fetch(request(path), {});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'access_not_configured' });
  }
});

test('config rejects URL injection, bad audience and unrestricted email', () => {
  for (const issuer of ['http://folio-test.cloudflareaccess.com', 'https://evil.example', 'https://folio-test.cloudflareaccess.com@evil.example', 'https://folio-test.cloudflareaccess.com/path', 'https://folio-test.cloudflareaccess.com/']) {
    assert.equal(accessConfig({ ...env, ACCESS_TEAM_DOMAIN: issuer }), null);
  }
  for (const audience of ['', '*', 'replace-me']) assert.equal(accessConfig({ ...env, ACCESS_AUD: audience }), null);
  for (const email of ['', '*', '@example.test', 'a@example.test,b@example.test', 'owner@example.test ']) {
    assert.equal(accessConfig({ ...env, ALLOWED_EMAIL: email }), null);
  }
});

test('every route and method rejects missing JWT', async () => {
  for (const path of ['/', '/sites', '/settings', '/assets/admin.css', '/assets/admin.js', '/assets/favicon.svg', '/api/session', '/api/sites', '/unknown']) {
    for (const method of ['GET', 'POST', 'OPTIONS', 'HEAD']) {
      assert.equal((await worker.fetch(request(path, null, method), env)).status, 401);
    }
  }
});

test('spoofed email header grants no access', async () => {
  const response = await worker.fetch(new Request('https://admin.example.test/', {
    headers: { 'cf-access-authenticated-user-email': env.ALLOWED_EMAIL },
  }), env);
  assert.equal(response.status, 401);
});

test('malformed, unsigned, oversized and tampered JWT are denied', async () => {
  const segments = validToken.split('.');
  const altered = Buffer.from(JSON.stringify({ email: 'intruder@example.test' })).toString('base64url');
  for (const token of ['garbage', 'e30.e30.', `${segments[0]}.${altered}.${segments[2]}`, 'x'.repeat(16385)]) {
    const response = await worker.fetch(request('/', token), env);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied' });
  }
});

test('wrong signer, issuer, audience, expired and future JWT are denied', async () => {
  const otherSigner = await signingFixture();
  const futureToken = await new SignJWT({ email: env.ALLOWED_EMAIL, type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-only' }).setIssuer(env.ACCESS_TEAM_DOMAIN)
    .setAudience(env.ACCESS_AUD).setSubject('test-user').setIssuedAt().setExpirationTime('5m')
    .setNotBefore(Math.floor(Date.now() / 1000) + 120).sign(fixture.privateKey);
  const tokens = [await otherSigner.sign(), await fixture.sign({}, { issuer: 'https://other.cloudflareaccess.com' }),
    await fixture.sign({}, { audience: 'b'.repeat(64) }),
    await fixture.sign({}, { expiration: Math.floor(Date.now() / 1000) - 1 }), futureToken];
  for (const token of tokens) assert.equal((await worker.fetch(request('/', token), env)).status, 403);
});

test('JWT requires expiry, identity and app token type', async () => {
  const noExpiry = await new SignJWT({ email: env.ALLOWED_EMAIL, type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-only' }).setIssuer(env.ACCESS_TEAM_DOMAIN)
    .setAudience(env.ACCESS_AUD).setSubject('test-user').setIssuedAt().sign(fixture.privateKey);
  for (const token of [noExpiry, await fixture.sign({ email: undefined }), await fixture.sign({ email: 123 }),
    await fixture.sign({ type: 'org' }), await fixture.sign({ type: undefined })]) {
    assert.equal((await worker.fetch(request('/api/session', token), env)).status, 403);
  }
});

test('a valid token for a different email is still denied', async () => {
  assert.equal((await worker.fetch(request('/api/session', await fixture.sign({ email: 'other@example.test' })), env)).status, 403);
});

test('JWKS/network failures fail closed without error details', async () => {
  const unavailable = createWorker(() => { throw new Error('sensitive upstream error'); });
  const response = await unavailable.fetch(request(), env);
  assert.equal(response.status, 403);
  assert.equal(await response.text(), '{"error":"access_denied"}');
});

test('verified owner can open every page and both assets with security headers', async () => {
  for (const path of ['/', '/sites', '/settings', '/assets/admin.css', '/assets/admin.js', '/assets/favicon.svg']) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.ok((await response.text()).length > 100);
  }
});

test('session returns verified identity; headers cannot override it', async () => {
  const req = request('/api/session');
  req.headers.set('cf-access-authenticated-user-email', 'attacker@example.test');
  const response = await worker.fetch(req, env);
  assert.deepEqual(await response.json(), { email: env.ALLOWED_EMAIL, stage: '01' });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('email matching is case insensitive but exact', async () => {
  assert.equal((await worker.fetch(request('/', await fixture.sign({ email: 'OWNER@EXAMPLE.TEST' })), env)).status, 200);
  assert.equal((await worker.fetch(request('/', await fixture.sign({ email: 'owner+other@example.test' })), env)).status, 403);
});

test('sites report empty list and absent integration', async () => {
  assert.deepEqual(await (await worker.fetch(request('/api/sites'), env)).json(), { sites: [], integration: 'not_connected' });
});

test('mutations unavailable, unknown routes 404, HEAD has no body', async () => {
  const mutation = await worker.fetch(request('/api/sites', validToken, 'POST'), env);
  assert.equal(mutation.status, 405);
  assert.equal(mutation.headers.get('allow'), 'GET, HEAD');
  assert.equal((await worker.fetch(request('/unknown'), env)).status, 404);
  const head = await worker.fetch(request('/', validToken, 'HEAD'), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('client script parses and uses safe text insertion', () => {
  assert.doesNotThrow(() => new vm.Script(client));
  assert.doesNotMatch(client, /innerHTML|localStorage|sessionStorage/);
});
