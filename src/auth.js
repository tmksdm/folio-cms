import { createRemoteJWKSet, jwtVerify } from 'jose';

const resolvers = new Map();

export function accessConfig(env) {
  const issuer = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  const email = env.ALLOWED_EMAIL;
  // Only an explicitly configured Cloudflare team may supply signing keys.
  if (typeof issuer !== 'string' || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) return null;
  if (typeof audience !== 'string' || !/^[a-f0-9]{64}$/.test(audience)) return null;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { issuer, audience, email: email.toLowerCase() };
}

function remoteKeys(issuer) {
  if (!resolvers.has(issuer)) {
    // Isolate cache by trusted issuer; bound memory even across config changes.
    if (resolvers.size >= 4) resolvers.clear();
    resolvers.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    }));
  }
  return resolvers.get(issuer);
}

export async function authenticate(request, env, resolveKeys = remoteKeys) {
  const config = accessConfig(env);
  if (!config) return { status: 503, code: 'access_not_configured' };
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { status: 401, code: 'authentication_required' };
  if (token.length > 16384) return { status: 403, code: 'access_denied' };
  try {
    const { payload } = await jwtVerify(token, resolveKeys(config.issuer), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email', 'type'],
    });
    if (payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub ||
        typeof payload.email !== 'string' || payload.email.toLowerCase() !== config.email) {
      return { status: 403, code: 'access_denied' };
    }
    return { email: payload.email };
  } catch {
    // Never return/log token contents, upstream responses, or identity claims.
    return { status: 403, code: 'access_denied' };
  }
}
