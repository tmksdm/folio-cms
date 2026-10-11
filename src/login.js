export function loginHtml(siteKey) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход — Folio</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/login.css"><script src="/assets/login.js" defer></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script></head><body><main class="login-main"><a class="brand" href="/login"><span class="brand-mark" aria-hidden="true">f.</span>folio<span class="brand-tag">CMS</span></a><div class="access-card"><p class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p><h1>Вход по почте</h1><p class="lead">Получите одноразовый код и откройте свою панель.</p><form id="request-form"><label for="email">Ваша почта</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><div class="cf-turnstile" data-sitekey="${siteKey}" data-action="login" data-size="compact"></div><button id="send-code" type="submit">Получить код</button></form><form id="verify-form" hidden><label for="code">Код из письма</label><input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><p class="muted">Код действует 10 минут. Введите его в этом же браузере.</p><button id="verify-code" type="submit">Войти</button><button id="resend" type="button">Запросить новый код</button></form><p id="login-status" role="status" aria-live="polite"></p><noscript><p>Для входа включите JavaScript.</p></noscript></div></main></body></html>`;
}
export const loginCss = `
.login-main{max-width:480px;padding:36px 20px;margin:0 auto}.login-main>.brand{margin-bottom:32px}.login-main h1{font-size:30px}.login-main form{display:grid;gap:14px;margin-top:24px}.login-main input{font:inherit;width:100%;min-width:0;padding:12px;border:1px solid #9bac99;border-radius:7px;background:#fff}.login-main label{font-size:14px}.login-main .cf-turnstile{min-height:140px;max-width:100%}#login-status{font-size:14px;overflow-wrap:anywhere}#resend{background:#fff}.login-main button:disabled{cursor:wait}
`;
export const loginClient = `
'use strict';
const byId = (id) => document.getElementById(id);
let pending = false;
const messages = {
  rate_limited: 'Слишком много попыток. Подождите и попробуйте позже.',
  challenge_failed: 'Пройдите проверку защиты ещё раз.',
  invalid_code: 'Код неверен, истёк или уже использован. После пяти ошибок нужен новый код.',
  delivery_unavailable: 'Не удалось отправить письмо. Повторите запрос через минуту.',
};
async function submit(path, body) {
  if (pending) return false;
  pending = true;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  byId('login-status').textContent = path === '/auth/request' ? 'Отправляем запрос…' : 'Проверяем код…';
  try {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000), redirect: 'error' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return true;
  } catch (error) {
    byId('login-status').textContent = messages[error.message] || 'Не удалось связаться с сервером. Проверьте соединение и повторите.';
    return false;
  } finally {
    pending = false;
    for (const button of document.querySelectorAll('button')) button.disabled = false;
  }
}
byId('request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pending) return;
  const turnstile = new FormData(event.currentTarget).get('cf-turnstile-response');
  if (!turnstile) { byId('login-status').textContent = 'Сначала пройдите проверку защиты.'; return; }
  const accepted = await submit('/auth/request', { email: byId('email').value, turnstile });
  if (window.turnstile) window.turnstile.reset();
  if (accepted) {
    byId('request-form').hidden = true;
    byId('verify-form').hidden = false;
    byId('login-status').textContent = 'Если адрес разрешён, письмо с кодом отправлено. Проверьте также папку «Спам».';
    byId('code').focus();
  }
});
byId('verify-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (await submit('/auth/verify', { code: byId('code').value })) {
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.assign(['/', '/sites', '/settings'].includes(next) ? next : '/');
  }
});
byId('resend').addEventListener('click', () => {
  byId('verify-form').hidden = true;
  byId('request-form').hidden = false;
  byId('code').value = '';
  byId('login-status').textContent = 'Между отправками нужна минута. Новый код заменит предыдущий.';
  byId('email').focus();
});
`;
