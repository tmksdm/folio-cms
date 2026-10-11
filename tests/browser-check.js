// Run via playwright-cli run-code --filename tests/browser-check.js against the
// localhost test fixture. This checks UI, not the real Cloudflare Access policy.
async (page) => {
  const base = 'http://127.0.0.1:4173';
  const failures = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  page.on('pageerror', (error) => failures.push(error.message));
  const text = async (selector) => (await page.locator(selector).textContent()).trim();
  const confirmed = () => page.locator('#status-text').filter({ hasText: 'Сессия подтверждена' }).waitFor();
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal page overflow');

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
  console.log('PASS: desktop/mobile 1440/390/320, navigation, direct reload, keyboard, loading, 503 retry, offline retry, expired session; no page errors. Cloudflare OTP/logout not tested.');
}
