import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';

export const env = {
  ACCESS_TEAM_DOMAIN: 'https://folio-test.cloudflareaccess.com',
  ACCESS_AUD: 'a'.repeat(64),
  ALLOWED_EMAIL: 'owner@example.test',
};

export async function signingFixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-only';
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims = {}, options = {}) => new SignJWT({ email: env.ALLOWED_EMAIL, type: 'app', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-only' })
    .setIssuer(options.issuer ?? env.ACCESS_TEAM_DOMAIN)
    .setAudience(options.audience ?? env.ACCESS_AUD)
    .setSubject('test-user').setIssuedAt()
    .setExpirationTime(options.expiration ?? '5m').sign(privateKey);
  return { keys, sign, privateKey };
}
