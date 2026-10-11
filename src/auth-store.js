import { authConfig, CODE_TTL, SESSION_TTL, randomCode, randomToken, digest, mac, equalHash } from './auth.js';

const result = (status, body = {}) => Response.json(body, { status });
const fresh = () => ({ rates: {}, sends: [], lastSend: 0, guesses: [], sessions: [], challenge: null });

// Synchronous SQLite transactions cover read/check/update transitions. Network
// awaits never hold a transaction; reservations are durable before outbound I/O.
export class AuthStore {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS auth_state (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL)');
  }
  change(tag, fn) {
    return this.storage.transactionSync(() => {
      const rows = this.storage.sql.exec('SELECT value FROM auth_state WHERE id = 1').toArray();
      const state = rows.length ? JSON.parse(rows[0].value) : fresh();
      const now = Date.now();
      if (state.tag !== tag) { state.tag = tag; state.challenge = null; state.sessions = []; }
      state.sessions = state.sessions.filter((s) => s.expires > now);
      state.sends = state.sends.filter((time) => time > now - 86_400_000);
      state.guesses = state.guesses.filter((time) => time > now - 3_600_000);
      for (const key of Object.keys(state.rates)) if (state.rates[key].until <= now) delete state.rates[key];
      if (state.challenge?.expires <= now) state.challenge = null;
      const output = fn(state, now);
      this.storage.sql.exec('INSERT INTO auth_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value', JSON.stringify(state));
      return output;
    });
  }
  gate(state, name, limit, now) {
    let rate = state.rates[name];
    if (!rate || now >= rate.until) {
      if (Object.keys(state.rates).length >= 256) return false;
      rate = state.rates[name] = { count: 0, until: now + 60_000 };
    }
    if (rate.count >= limit) return false;
    rate.count++;
    return true;
  }
  async fetch(request) {
    try {
      const config = authConfig(this.env);
      if (!config) return result(503, { error: 'auth_not_configured' });
      const tag = await mac(this.env.AUTH_SECRET, `${config.origin}\n${config.email}`);
      const body = await request.json();
      const path = new URL(request.url).pathname;
      if (path === '/request') return await this.requestCode(body, config, tag);
      if (path === '/verify') return await this.verify(body, tag);
      if (path === '/session' || path === '/logout') {
        const hash = typeof body.token === 'string' && /^[a-f0-9]{64}$/.test(body.token) ? await digest(body.token) : '';
        return this.change(tag, (state) => {
          const session = state.sessions.find((s) => equalHash(s.hash, hash));
          if (path === '/logout') {
            state.sessions = state.sessions.filter((s) => !equalHash(s.hash, hash));
            return result(200);
          }
          return session ? result(200, { email: config.email }) : result(401, { error: 'authentication_required' });
        });
      }
      return result(404);
    } catch { return result(503, { error: 'auth_unavailable' }); }
  }
  async requestCode(body, config, tag) {
    if (typeof body.turnstile !== 'string' || !body.turnstile || body.turnstile.length > 2048) return result(403, { error: 'challenge_failed' });
    // Cloudflare overwrites this header at ingress. Never use X-Forwarded-For.
    // Hash addresses; expire counters after one minute and bound their number.
    const ipHash = await digest(body.ip || 'missing-ip');
    const permitted = this.change(tag, (state, now) => this.gate(state, `request:${ipHash}`, 30, now));
    if (!permitted) return result(429, { error: 'rate_limited' });
    let validation;
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: this.env.TURNSTILE_SECRET_KEY, response: body.turnstile, ...(body.ip ? { remoteip: body.ip } : {}) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return result(503, { error: 'auth_unavailable' });
      validation = await response.json();
    } catch { return result(503, { error: 'auth_unavailable' }); }
    if (validation.success !== true || validation.hostname !== config.hostname || validation.action !== 'login') return result(403, { error: 'challenge_failed' });
    const allowed = typeof body.email === 'string' && body.email.toLowerCase() === config.email;
    if (!allowed) return result(202, { accepted: true });
    const nonce = randomToken();
    const nonceHash = await digest(nonce);
    const code = randomCode();
    const hash = await mac(this.env.AUTH_SECRET, `${nonce}:${code}`);
    const reservation = this.change(tag, (state, now) => {
      if (now - state.lastSend < 60_000 || state.sends.filter((t) => t > now - 3_600_000).length >= 5 || state.sends.length >= 20) return false;
      state.lastSend = now;
      state.sends.push(now);
      state.challenge = { nonceHash, hash, expires: now + CODE_TTL, attempts: 0, ready: false };
      return true;
    });
    if (!reservation) return result(429, { error: 'rate_limited' });
    let sent = false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': nonce },
        body: JSON.stringify({ from: 'Folio <onboarding@resend.dev>', to: [config.email], subject: 'Код входа в Folio', text: `Ваш код входа: ${code}\n\nКод действует 10 минут и используется один раз. Если вы не запрашивали вход, проигнорируйте письмо.` }),
        signal: AbortSignal.timeout(8000),
      });
      sent = response.ok && typeof (await response.json()).id === 'string';
    } catch { /* Reservation remains charged; upstream responses are never logged. */ }
    const current = this.change(tag, (state, now) => {
      if (state.challenge?.nonceHash !== nonceHash) return false;
      if (!sent || state.challenge.expires <= now) { state.challenge = null; return false; }
      state.challenge.ready = true;
      return true;
    });
    return current ? result(202, { accepted: true, challenge: nonce }) : result(503, { error: 'delivery_unavailable' });
  }
  async verify(body, tag) {
    const nonce = typeof body.challenge === 'string' && /^[a-f0-9]{64}$/.test(body.challenge) ? body.challenge : '';
    const nonceHash = await digest(nonce);
    const code = typeof body.code === 'string' && /^\d{6}$/.test(body.code) ? body.code : '';
    const hash = await mac(this.env.AUTH_SECRET, `${nonce}:${code}`);
    const token = randomToken();
    const sessionHash = await digest(token);
    return this.change(tag, (state, now) => {
      const challenge = state.challenge;
      if (!challenge?.ready || !equalHash(challenge.nonceHash, nonceHash)) return result(403, { error: 'invalid_code' });
      if (state.guesses.length >= 30) return result(429, { error: 'rate_limited' });
      state.guesses.push(now);
      challenge.attempts++;
      if (code && equalHash(challenge.hash, hash)) {
        state.challenge = null;
        state.sessions.push({ hash: sessionHash, expires: now + SESSION_TTL });
        state.sessions = state.sessions.slice(-10);
        return result(200, { token });
      }
      if (challenge.attempts >= 5) state.challenge = null;
      return result(403, { error: 'invalid_code' });
    });
  }
}
