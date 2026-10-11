// Visual check with Cloudflare's real widget and official always-pass test sitekey.
// Siteverify/email are still mocked: this tests widget layout, not production keys.
async (page) => {
  await page.unroute('https://challenges.cloudflare.com/turnstile/v0/api.js');
  await page.context().clearCookies();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://127.0.0.1:4173/login');
    // Turnstile may place its iframe inside a closed shadow root. Its response
    // input is the public integration surface and proves completion here.
    await page.waitForFunction(() => Boolean(document.querySelector('[name="cf-turnstile-response"]')?.value));
    if (!await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) throw new Error('Real Turnstile widget causes overflow');
    await page.screenshot({ path: 'output/playwright/widget-' + width + '.png', fullPage: true });
  }
  if (errors.length) throw new Error(errors.join('; '));
  console.log('PASS: real Turnstile widget with official test sitekey fits 1440/390/320; no page errors. Production siteverify not tested.');
}
