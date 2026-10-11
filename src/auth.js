export const SESSION_COOKIE = '__Host-folio-session';
export const CHALLENGE_COOKIE = '__Host-folio-challenge';
export const CODE_TTL = 600_000;
export const SESSION_TTL = 3_600_000;

export function authConfig(env) {
  try {
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || origin.username || origin.password) return null;
    if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(env.ALLOWED_EMAIL || '')) return null;
    if (!/^[a-f0-9]{64}$/.test(env.AUTH_SECRET || '')) return null;
    if (typeof env.RESEND_API_KEY !== 'string' || !env.RESEND_API_KEY.startsWith('re_')) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(env.TURNSTILE_SITE_KEY || '') || !env.TURNSTILE_SECRET_KEY) return null;
    if (!env.AUTH_STORE) return null;
    return { origin: origin.origin, hostname: origin.hostname, email: env.ALLOWED_EMAIL.toLowerCase() };
  } catch { return null; }
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('');
}
export function randomCode() {
  const limit = Math.floor(2 ** 32 / 1_000_000) * 1_000_000;
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  return String(value % 1_000_000).padStart(6, '0');
}
const hex = (bytes) => Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
export async function digest(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
export async function mac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
export function equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function cookieToken(request, name) {
  const matches = (request.headers.get('cookie') || '').split(';').map((s) => s.trim()).filter((s) => s.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function cookie(name, value, ttl) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ttl / 1000)}`;
}
// All browsers/IPs address one object, so distributed requests share the limits.
export async function callAuth(env, path, body) {
  const object = env.AUTH_STORE.get(env.AUTH_STORE.idFromName('owner-auth-v1'));
  const response = await object.fetch(new Request(`https://auth.internal${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, ...await response.json() };
}
