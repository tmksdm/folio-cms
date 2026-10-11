// Test-only HTTPS preview with real workerd/SQLite, mocked Resend/Turnstile and
// in-memory code retrieval for browser tests. NOT a deployment or real OTP proof.
import { runtimeFixture } from './runtime-fixture.js';
const fixture = await runtimeFixture({ preview: true });
console.log('TEST ONLY: https://127.0.0.1:4173 (mocked email/CAPTCHA, temporary SQLite)');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await fixture.mf.dispose(); process.exit(0); });
