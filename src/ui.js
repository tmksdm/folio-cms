export const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Folio — управление сайтами</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/admin.css">
  <script src="/assets/admin.js" defer></script>
</head>
<body>
  <a class="skip" href="#main">Перейти к содержимому</a>
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="Folio, главная"><span class="brand-mark" aria-hidden="true">f.</span>folio<span class="brand-tag">CMS</span></a>
      <p class="nav-label">Рабочее пространство</p>
      <nav aria-label="Основная навигация">
        <a href="/" data-route="/">Обзор<span aria-hidden="true">↗</span></a>
        <a href="/sites" data-route="/sites">Сайты<span aria-hidden="true">↗</span></a>
        <a href="/settings" data-route="/settings">Доступ<span aria-hidden="true">↗</span></a>
      </nav>
      <div class="sidebar-note"><span class="dot" aria-hidden="true"></span>Личное пространство<br><small>Ваши сайты. Ваши материалы.</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span>Панель управления</span><button id="logout" type="button">Выйти</button></header>
      <main id="main" tabindex="-1">
        <div class="page-heading"><div><p class="eyebrow">FOLIO / <span id="section-label">ОБЗОР</span></p><h1 id="page-title">Ваше пространство для сайтов</h1><p id="page-description" class="lead">Одна панель для ваших независимых проектов.</p></div><span class="stage-badge">Первый этап</span></div>
        <div id="status" role="status" aria-live="polite" class="status"><span class="dot" aria-hidden="true"></span><span id="status-text">Проверяем сессию…</span></div>
        <div id="error" class="error" role="alert" hidden><p id="error-text"></p><button id="retry" type="button">Повторить</button><a id="sign-in" href="/" hidden>Войти снова</a></div>
        <section id="overview-panel" aria-labelledby="start-title">
          <div class="intro-card"><div><p class="eyebrow">НАЧАЛО РАБОТЫ</p><h2 id="start-title">Место для следующей идеи.</h2><p>Здесь появятся ваши сайты и материалы.<br>Основа панели готова; подключение публикации — впереди.</p><a class="primary-link" href="/sites">Посмотреть сайты <span aria-hidden="true">→</span></a></div><div class="paper-stack" aria-hidden="true"><div class="paper back"></div><div class="paper front"><span>folio / journal</span><i></i><b>Каждый сайт —<br>своя история.</b><i></i><small>Напишите первую главу.</small></div></div></div>
          <div class="details-grid"><article class="detail-card"><span class="card-number">01 / САЙТЫ</span><h3>Независимые проекты</h3><p>Каждый сайт будет жить в отдельном репозитории и публиковаться на GitHub Pages.</p></article><article class="detail-card"><span class="card-number">02 / ДОСТУП</span><h3>Только для вас</h3><p>Вход по коду из письма. Сессия проверяется на сервере при каждом запросе.</p></article></div>
        </section>
        <section id="sites-panel" aria-labelledby="sites-title" hidden><div class="section-header"><h2 id="sites-title">Ваши сайты</h2><span class="muted">Публикация ещё не подключена</span></div><div class="empty-card"><span class="empty-icon" aria-hidden="true">▤</span><h3>Здесь будут ваши сайты</h3><p>На первом этапе список пуст.<br>Создание сайтов появится после подключения GitHub.</p><button type="button" disabled>Создать сайт — позже</button></div></section>
        <section id="settings-panel" aria-labelledby="access-title" hidden><h2 id="access-title">Доступ к панели</h2><div class="access-card"><dl><div><dt>Способ входа</dt><dd>Код на разрешённую почту</dd></div><div><dt>Текущий пользователь</dt><dd id="identity">Проверяем…</dd></div><div><dt>Публикация сайтов</dt><dd>Ещё не подключена</dd></div></dl><p class="muted">Адрес для входа задаётся в серверных настройках Folio.</p></div></section>
        <noscript><p class="error">Для проверки сессии в панели включите JavaScript. Серверная защита доступа действует и без него.</p></noscript>
      </main>
      <footer>Folio CMS<span>Основа готова. Истории впереди.</span></footer>
    </div>
  </div>
</body>
</html>`;

export const css = `
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#252f2b;background:#f6f7f3;font-synthesis:none;line-height:1.55;--green:#214c3e;--muted:#5e6b63;--line:#dce2da}
*{box-sizing:border-box}body{margin:0}a{color:inherit}button{font:inherit}a,button{-webkit-tap-highlight-color:transparent}button:not(:disabled),a{touch-action:manipulation}[hidden]{display:none!important}:focus-visible{outline:3px solid #956829;outline-offset:4px}.skip{position:fixed;top:-100px;left:15px;z-index:5;background:white;padding:12px}.skip:focus{top:12px}
.shell{display:flex;min-height:100vh}.sidebar{width:240px;flex-shrink:0;background:#edf1e9;border-right:1px solid var(--line);padding:36px 26px;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:10px;font-size:29px;font-weight:650;letter-spacing:-1px;text-decoration:none}.brand-mark{background:var(--green);color:#fff;width:38px;height:38px;border-radius:10px;font-family:Georgia,serif;text-align:center;font-size:32px;line-height:36px}.brand-tag{font-size:10px;letter-spacing:1px;align-self:center;margin-left:1px;border:1px solid #adbbae;padding:1px 5px;border-radius:4px}.nav-label{font-size:11px;color:var(--muted);margin:54px 0 14px;letter-spacing:.08em}nav{display:grid;gap:7px}nav a{display:flex;justify-content:space-between;align-items:center;text-decoration:none;padding:12px 14px;border-radius:8px;font-size:14px;min-height:46px}nav a:hover{background:#e2e9dc}nav a[aria-current="page"]{color:white;background:var(--green)}nav a span{opacity:.65}.sidebar-note{margin-top:auto;padding-top:70px;font-size:12px;color:var(--green)}.sidebar-note small{font-size:11px;color:var(--muted)}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#50765c;margin-right:8px}.workspace{flex:1;min-width:0}.topbar{height:78px;border-bottom:1px solid var(--line);padding:0 46px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted)}.topbar a{padding:12px 0;min-height:44px;text-underline-offset:4px}main{max-width:1140px;padding:46px 46px 34px;margin:0 auto;outline:none}.page-heading{display:flex;gap:20px;justify-content:space-between;align-items:flex-start}.eyebrow{font-size:10px;font-weight:700;letter-spacing:.14em;margin:0 0 15px;color:var(--muted)}h1{font-size:clamp(25px,2.7vw,36px);line-height:1.2;letter-spacing:-.035em;font-weight:600;margin:0 0 12px}h2{font-weight:550;font-size:26px;line-height:1.25;margin:0 0 16px;letter-spacing:-.02em}h3{font-size:19px;font-weight:600;margin:14px 0 9px}.lead{font-size:14px;margin:0;color:var(--muted)}.stage-badge{font-size:11px;white-space:nowrap;background:#e9eddf;border:1px solid #d5dec9;color:#526347;padding:6px 10px;border-radius:20px;margin-top:32px}.status{margin:28px 0 22px;font-size:12px;display:flex;align-items:center;color:var(--muted)}.intro-card{position:relative;background:#e8eedf;border:1px solid #d8e2ce;border-radius:14px;padding:36px;display:flex;justify-content:space-between;gap:28px;overflow:hidden;min-height:286px}.intro-card h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:34px;max-width:340px;color:#284535}.intro-card p:not(.eyebrow){font-size:13px;line-height:1.8;color:#53614f;max-width:360px;margin:0 0 22px}.primary-link{display:inline-flex;gap:24px;align-items:center;text-decoration:none;color:white;background:var(--green);padding:12px 18px;border-radius:7px;font-size:12px;min-height:44px}.primary-link:hover{background:#17392e}.paper-stack{width:240px;position:relative;flex-shrink:0;min-height:214px}.paper{position:absolute;width:196px;height:220px;border:1px solid #c3ceba;border-radius:6px}.back{background:#d3deca;transform:rotate(10deg);top:2px;left:28px}.front{background:#fafbf6;transform:rotate(-5deg);top:0;left:10px;padding:22px;color:#41503e;box-shadow:0 12px 20px #39533012}.front span{font-size:9px;letter-spacing:.09em}.front i{display:block;border-top:1px solid #d4dccb;margin:17px 0}.front b{font-family:Georgia,serif;font-size:22px;font-weight:400;line-height:1.25;display:block}.front small{font-size:9px}.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.detail-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:26px}.card-number{font-size:10px;letter-spacing:.08em;color:var(--muted)}.detail-card p{margin:0;font-size:13px;color:var(--muted);max-width:370px}.section-header{display:flex;gap:16px;justify-content:space-between;align-items:center}.section-header h2{margin-bottom:0}.muted{color:var(--muted);font-size:12px}.empty-card{margin-top:22px;border:1px dashed #b9c5b5;border-radius:14px;text-align:center;padding:55px 20px;background:#fff}.empty-icon{font-size:32px;color:#5b7359}.empty-card p{font-size:14px;color:var(--muted);margin-bottom:23px}button{padding:11px 18px;border:1px solid #9bac99;border-radius:7px;background:#edf1e9;color:#304b35;min-height:44px;cursor:pointer}button:disabled{color:#637060;background:#eef1e9;cursor:not-allowed}.error{border:1px solid #d3bba0;background:#fff5e9;padding:15px;border-radius:9px;margin-bottom:20px;font-size:14px}.error p{margin:0 0 12px}.error a{display:inline-block;padding:10px}.access-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px}dl{margin:0}dl div{display:grid;grid-template-columns:1fr 1.4fr;gap:20px;padding:17px 0;border-bottom:1px solid var(--line)}dt{font-size:13px;color:var(--muted)}dd{font-size:14px;margin:0;overflow-wrap:anywhere}.access-card>p{margin-bottom:0}footer{max-width:1140px;margin:0 auto;padding:15px 46px 25px;color:var(--muted);font-size:10px;display:flex;justify-content:space-between;gap:16px}
.front b{font-size:19px}.front small{display:block}
@media(min-width:1500px){main{padding-top:65px}}@media(max-width:1050px){.sidebar{width:200px;padding:30px 18px}main{padding:34px 28px}.topbar{padding:0 28px}.intro-card{padding:28px}.paper-stack{width:185px}.paper{width:165px}.back{left:13px}.front{left:0;padding:18px}.front b{font-size:17px}footer{padding-left:28px;padding-right:28px}}
@media(max-width:760px){.shell{display:block}.sidebar{width:auto;padding:18px 20px 12px;border-right:0;border-bottom:1px solid var(--line)}.brand{font-size:25px}.brand-mark{width:34px;height:34px;line-height:32px;font-size:29px}.nav-label,.sidebar-note{display:none}nav{display:flex;gap:8px;margin-top:18px}nav a{flex:1;padding:10px 12px;justify-content:center;min-width:0}nav a span{display:none}.topbar{height:56px;padding:0 20px;font-size:12px}main{padding:28px 20px 20px}.page-heading{display:block}.stage-badge{display:inline-block;margin-top:16px}h1{font-size:29px}.intro-card{padding:25px;min-height:0}.intro-card h2{font-size:32px}.paper-stack{display:none}.details-grid{grid-template-columns:1fr;gap:12px}.detail-card{padding:22px}.status{margin:22px 0 18px}.section-header{display:block}.section-header h2{margin-bottom:8px}.empty-card{padding:38px 15px}dl div{grid-template-columns:1fr;gap:5px}.access-card{padding:20px}footer{padding:12px 20px 22px}footer span{max-width:170px;text-align:right}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;

export const client = `
'use strict';
const byId = (id) => document.getElementById(id);
const page = window.location.pathname;
byId('sign-in').href = '/login?next=' + encodeURIComponent(page);
byId('logout').addEventListener('click', async () => {
  byId('logout').disabled = true;
  try {
    const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error('logout');
    window.location.assign('/login');
  } catch {
    byId('status-text').textContent = 'Не удалось выйти. Проверьте соединение и повторите.';
    byId('logout').disabled = false;
  }
});
const pages = {
  '/': ['ОБЗОР', 'Ваше пространство для сайтов', 'Одна панель для ваших независимых проектов.', 'overview-panel'],
  '/sites': ['САЙТЫ', 'Ваши сайты', 'Отдельное место для каждого проекта.', 'sites-panel'],
  '/settings': ['ДОСТУП', 'Ваш доступ к Folio', 'Личное пространство с входом по почте.', 'settings-panel'],
};
const current = pages[page] || pages['/'];
byId('section-label').textContent = current[0];
byId('page-title').textContent = current[1];
byId('page-description').textContent = current[2];
for (const panel of ['overview-panel', 'sites-panel', 'settings-panel']) byId(panel).hidden = panel !== current[3];
for (const link of document.querySelectorAll('[data-route]')) {
  if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
}
let pending = false;
async function loadSession() {
  if (pending) return;
  pending = true;
  byId('error').hidden = true;
  byId('retry').disabled = true;
  byId('status-text').textContent = 'Проверяем сессию…';
  byId('identity').textContent = 'Проверяем…';
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 403) throw new Error('session');
    if (!response.ok) throw new Error('server');
    const data = await response.json();
    if (typeof data.email !== 'string') throw new Error('server');
    byId('status-text').textContent = 'Сессия подтверждена';
    byId('identity').textContent = data.email;
  } catch (error) {
    const expired = error.message === 'session';
    byId('status-text').textContent = 'Сессия не подтверждена';
    byId('identity').textContent = 'Не удалось проверить';
    byId('error-text').textContent = expired ? 'Сессия завершилась или доступ закрыт. Войдите снова.' : 'Не удалось проверить сессию. Проверьте соединение и повторите. Если сессия закончилась, войдите снова.';
    byId('sign-in').hidden = false;
    byId('retry').hidden = expired;
    byId('error').hidden = false;
  } finally {
    pending = false;
    byId('retry').disabled = false;
  }
}
byId('retry').addEventListener('click', loadSession);
window.addEventListener('pageshow', loadSession);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadSession(); });
loadSession();
`;
