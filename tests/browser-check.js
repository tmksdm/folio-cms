// Run via playwright-cli run-code --filename tests/browser-check.js against the
// HTTPS test fixture. Email and CAPTCHA are mocked; Worker and SQLite are real.
async (page) => {
  const base = 'https://127.0.0.1:4173';
  const failures = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  page.on('pageerror', (error) => failures.push(error.message));
  const text = async (selector) => (await page.locator(selector).textContent()).trim();
  const confirmed = () => page.locator('#status-text').filter({ hasText: 'Сессия подтверждена' }).waitFor();
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal page overflow');

  await page.context().clearCookies();
  // Only the external Turnstile widget is mocked; production has no test switch.
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `const input = document.createElement('input'); input.type = 'hidden'; input.name = 'cf-turnstile-response'; input.value = 'test-token'; document.getElementById('request-form').append(input); window.turnstile = { reset() {} };` }));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/settings');
    assert(new URL(page.url()).pathname === '/login', 'Protected direct link must require login');
    await noOverflow();
    await page.screenshot({ path: 'output/playwright/login-' + width + '.png', fullPage: true });
  }
  await page.locator('#email').fill('owner@example.test');
  await page.route('**/auth/request', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Получить код', exact: true }).click();
  await page.getByText('Не удалось связаться с сервером.', { exact: false }).waitFor();
  await page.unroute('**/auth/request');
  await page.getByRole('button', { name: 'Получить код', exact: true }).click();
  await page.locator('#verify-form').waitFor();
  const code = (await (await page.request.get(base + '/__test/code')).json()).code;
  await page.locator('#code').fill(code === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByText('Код неверен, истёк или уже использован.', { exact: false }).waitFor();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(base + '/settings');
  await confirmed();
  const session = (await page.context().cookies()).find((c) => c.name === '__Host-folio-session');
  assert(session?.httpOnly && session?.secure && session?.sameSite === 'Strict', 'Session cookie protection missing');
  assert(!await page.evaluate(() => document.cookie.includes('folio-session')), 'Session cookie exposed to JavaScript');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await confirmed();
  await noOverflow();
  await page.keyboard.press('Tab');
  assert(await page.locator('.skip').evaluate((el) => document.activeElement === el), 'Skip link not keyboard reachable');
  await page.keyboard.press('Enter');
  assert(await page.locator('#main').evaluate((el) => document.activeElement === el), 'Skip link does not focus main');
  await page.locator('#main').evaluate((el) => el.blur());
  await page.screenshot({ path: 'output/playwright/desktop.png', fullPage: true });

  await page.getByRole('link', { name: 'Сайты', exact: true }).click();
  await confirmed();
  assert(await page.locator('#sites-panel').isVisible(), 'Sites navigation failed');
  assert(await page.getByRole('button', { name: 'Создать сайт — позже' }).isDisabled(), 'Future feature must stay unavailable');
  await page.reload();
  await confirmed();
  assert(await page.locator('#sites-panel').isVisible(), 'Sites direct reload failed');
  await page.goto(base + '/settings');
  await confirmed();
  assert(await text('#identity') === 'owner@example.test', 'Verified identity missing');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base);
    await confirmed();
    await noOverflow();
    await page.screenshot({ path: 'output/playwright/mobile-' + width + '.png', fullPage: true });
    await page.goto(base + '/sites');
    await confirmed();
    await noOverflow();
    await page.screenshot({ path: 'output/playwright/mobile-sites-' + width + '.png', fullPage: true });
  }

  const api = '**/api/session';
  await page.route(api, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ json: { email: 'owner@example.test', stage: '01' } });
  });
  await page.goto(base + '/settings');
  assert(await text('#status-text') === 'Проверяем сессию…', 'Loading state absent');
  await confirmed();
  await page.unroute(api);

  await page.route(api, (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.reload();
  await page.locator('#error').waitFor();
  assert(await text('#status-text') === 'Сессия не подтверждена', 'Server error falsely confirms session');
  await page.unroute(api);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await confirmed();
  assert(await page.locator('#error').isHidden(), 'Retry does not clear error');

  await page.route(api, (route) => route.abort('internetdisconnected'));
  await page.reload();
  await page.locator('#error').waitFor();
  assert(await text('#identity') === 'Не удалось проверить', 'Network failure shows stale identity');
  await page.unroute(api);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await confirmed();

  await page.route(api, (route) => route.fulfill({ status: 403, json: { error: 'access_denied' } }));
  await page.reload();
  await page.locator('#error').waitFor();
  assert(await page.getByRole('link', { name: 'Войти снова' }).isVisible(), 'Expired session needs sign-in link');
  assert(await page.getByRole('button', { name: 'Повторить', exact: true }).isHidden(), 'Expired session should request sign-in');
  await page.screenshot({ path: 'output/playwright/session-expired.png', fullPage: true });
  await page.unroute(api);
  await page.goto(base);
  await confirmed();
  assert(failures.length === 0, 'Unhandled browser errors: ' + failures.join('; '));
  await page.route('**/auth/logout', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByText('Не удалось выйти.', { exact: false }).waitFor();
  await page.unroute('**/auth/logout');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.waitForURL(base + '/login');
  await page.goto(base + '/sites');
  assert(new URL(page.url()).pathname === '/login', 'Logout did not revoke access');
  console.log('PASS: login/errors/cookies/logout, desktop/mobile 1440/390/320, navigation, direct reload, keyboard, loading, 503 retry, offline retry, expired session; no page errors. Real Resend and Turnstile not tested.');
}
