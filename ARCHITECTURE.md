# Архитектура

## Stage 01: собственный email-вход

Один Cloudflare Worker, обычные HTML/CSS/JavaScript, без клиентского фреймворка. HTML и ресурсы включены в bundle. Cloudflare Access / Zero Trust не используются: по подтверждённому заданию `05.txt` они заменены Resend и Turnstile.

Браузер → публичная `/login` → серверная проверка Turnstile → Resend → шестизначный код → cookie-сессия → защищённая админка. Форма входа не спрашивает email: единственный получатель задан серверным ALLOWED_EMAIL, адрес из браузера не принимается и на странице входа не показывается. Отправитель — `Folio <onboarding@resend.dev>`; в этом режиме Resend разрешает доставку только владельцу своего аккаунта. Без собственного домена это ограничение подходит только личной панели.

Публичны только GET/HEAD `/login`, `/assets/login.css`, `/assets/login.js` и POST `/auth/request`, `/auth/verify`, `/auth/logout`. Все остальные страницы, ресурсы, API и неизвестные пути проверяют серверную сессию до маршрутизации. Анонимные `/`, `/sites`, `/settings` перенаправляются на вход; ресурсы/API возвращают 401. Заголовки Access и email не дают доступа. Нет конфигурации/хранилища → 503; неверный origin → 403. Все ответы no-store; CSP разрешает внешние скрипт/iframe Turnstile только на странице входа.

## Атомарность и ограничения

Один Durable Object `owner-auth-v1`, SQLite backend (`new_sqlite_classes`), одна строка состояния. Это минимальное хранилище авторизации, а не БД контента CMS. Workers KV не применяется из-за eventual consistency. SQLite Durable Objects доступны на Workers Free: [тариф и квоты](https://developers.cloudflare.com/durable-objects/platform/pricing/). На Free превышение квот приводит к отказам, а не автоматическому переходу на платный план.

`storage.transactionSync` атомарно читает, проверяет и записывает состояние. Внешние запросы выполняются вне транзакций. До отправки письма сохраняются квота и неподтверждённый код; только успешный ответ Resend активирует код. Неуспешная/неопределённая отправка расходует лимит и не разрешает вход. Поздний ответ старой отправки не активирует заменённый код. Состояние и квоты переживают перезапуск объекта.

- Случайный код: 6 цифр, Web Crypto без modulo bias; срок 10 минут от резервирования. Новая отправка заменяет предыдущий код.
- Код привязан к cookie браузера `__Host-folio-challenge` (256 бит). Без совпадения cookie чужой браузер не расходует попытки текущего кода.
- Максимум 5 попыток на код, дополнительно 30 попыток за скользящий час. Проверка, расход попытки, удаление кода и создание сессии — одна транзакция. Конкурентно код используется ровно один раз.
- Отправки: минимум 60 секунд между ними, максимум 5 за скользящий час и 20 за скользящие сутки. Эти лимиты общие для владельца, независимо от IP/браузера, и включают неудачные отправки.
- До Siteverify: максимум 30 непустых запросов в минуту с одного доверенного `CF-Connecting-IP`. IP хранится как SHA-256, счётчики живут минуту, максимум 256 активных IP. При заполнении новые IP временно получают 429. Нет доверия `X-Forwarded-For`.
- Siteverify проверяет success, точный hostname APP_ORIGIN и action `login`. Токены Turnstile одноразовые; отказ/таймаут не разрешает отправку. [Серверная проверка](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- POST требует точный Origin, JSON и тело до 4096 байт; cross-site/same-site Fetch Metadata отклоняются. Сервер принимает запросы только на APP_ORIGIN.

Сессия: случайный токен 256 бит, сервер хранит только SHA-256; cookie `__Host-folio-session`, Path=/, HttpOnly, Secure, SameSite=Strict, без Domain. Абсолютный срок — 1 час, без автоматического продления; максимум 10 активных сессий (самая старая вытесняется). Выход — POST с проверкой Origin, удаление серверной сессии и обеих cookies. Изменение AUTH_SECRET, разрешённого email или APP_ORIGIN отзывает прежние коды/сессии. Коды хранятся как HMAC-SHA256 с серверным секретом; plaintext существует только в памяти на время отправки.

Лимиты защищают почтовую квоту и перебор, но не гарантируют доступность против распределённого DDoS и исчерпания бесплатных квот. Любой анонимный посетитель, прошедший Turnstile, расходует общую квоту отправок — письмо всегда уходит на ALLOWED_EMAIL. Это следствие входа без ввода email и ограничение личного входа, без обещаний неуязвимости.

## Файлы и проверки

`src/auth.js` — конфигурация, криптография, cookies, обращение к фиксированному объекту; `src/auth-store.js` — код, лимиты, Resend, Turnstile и сессии; `src/worker.js` — маршруты/защита; `src/login.js` — вход; `src/ui.js` — прежняя админка и выход.

Секреты AUTH_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY и приватный ALLOWED_EMAIL — Worker secrets. APP_ORIGIN и публичный TURNSTILE_SITE_KEY тоже задаются через secrets ради единого способа настройки; только sitekey включается в страницу входа. Не хранить значения в Git/логах. Observability выключена, код не логирует тела, email, токены и ответы upstream.

`tests/worker.test.js` использует настоящую SQLite и криптографию с управляемыми часами и внешней сетью. `tests/runtime.test.js` запускает production-модули в workerd с SQLite Durable Object. `tests/preview-server.js` — только HTTPS localhost с временным состоянием и подменой доставки/CAPTCHA; `/__test/code` существует исключительно в тестовом entrypoint, отсутствует в production. Подмена внешнего виджета в браузерном сценарии не доказывает реальный Turnstile.

## Stage 02: создание сайтов — план от 2026-10-12

Ничего из этого раздела не реализовано: код, секреты и внешние ресурсы не создавались. Всё ниже — исследование и решение для ревью.

### Авторизация GitHub: приложение (GitHub App) с installation-токенами

Выбран GitHub App, а не личный токен: installation-токен выпускается сервером автоматически на час, поэтому ручное обновление не требуется; права выдаются конечным списком и отзываются одним действием; приватный ключ живёт только в Worker secrets и не попадает в браузер, Git или логи.

- Права приложения (repository permissions): `Administration: write` — создание репозитория и включение Pages; `Pages: write` — настройка Pages и запрос сборки; `Contents: write` — файлы сайта; `Metadata: read` — обязательное. Право `Workflows` не запрашивается: workflow-файлы в репозитории сайта не создаются, каталог `.github/workflows` не затрагивается.
- Основание: [Create a repository for the authenticated user](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) перечисляет GitHub App installation access tokens среди поддерживаемых типов токенов и требует `Administration` (write) либо `Repository creation` (write); [Create a GitHub Pages site](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site) требует `Pages` (write) и `Administration` (write); [права приложений](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps).
- Поток целиком на сервере: JWT (`RS256`, `iss` = App ID, `iat` на минуту назад, `exp` не более 10 минут) → `POST /app/installations/{installation_id}/access_tokens` → installation-токен на 1 час. ID установки не хранится в секретах: он находится вызовом `GET /app/installations` по JWT. Лимит installation-токена — 5 000 запросов в час. [JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [лимиты](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- Ключ приложения GitHub отдаёт в PEM `PKCS#1 RSAPrivateKey`, а WebCrypto принимает только `PKCS#8`; ключ конвертируется командой `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key-pkcs8.key`. Подпись RS256 и импорт `pkcs8` в Workers поддержаны. [Managing private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps), [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).
- Новые секреты: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8). Оба — только Worker secrets. GitHub не используется для входа владельца: вход остаётся прежним (Resend/Turnstile/сессия).

### Создание сайта: идемпотентные шаги вместо состояния

Порядок шагов: проверка имени → создание репозитория (`POST /user/repos`, `auto_init: true`, `private: false`, тема `folio-site`, описание и homepage) → запись файлов (`folio.json`, `index.html`, `.nojekyll`) через Contents API → включение Pages (`POST /repos/{owner}/{repo}/pages`, `build_type: legacy`, `source: {branch: "main", path: "/"}`) → ожидание `GET /repos/{owner}/{repo}/pages` до `status: built`.

- Тема `folio-site` и `folio.json` внутри репозитория — маркер владения. Если имя занято репозиторием без маркера (например `folio-cms` или пользовательский сайт `tmksdm.github.io`), Folio не меняет в нём ничего и просит другое имя.
- Каждый шаг идемпотентен: `422` «имя занято», `409` «Pages уже включены», `409` «файл существует без sha», таймаут и `5xx` трактуются либо как «шаг уже выполнен», либо как ошибка конкретного шага. Повторный запрос из админки доводит сайт до конца, потому что список сайтов и состояние публикации читаются из GitHub, а не из своей базы.
- Своего хранилища нет: список сайтов — `GET /installation/repositories` с фильтром по теме, метаданные — в репозитории, `folio.json` позже становится источником заголовка и настроек. Единственный Durable Object `owner-auth-v1` остаётся хранилищем авторизации; новых binding и постоянного кэша не добавляется (installation-токен кэшируется в памяти изолята не дольше часа; новый выпуск токена при промахе кэша безвреден).
- Независимость: у каждого сайта свой репозиторий, своя история, свой Pages-сайт и свой адрес. Folio не пишет общие файлы, поэтому поломка или удаление одного сайта не затрагивает другие и сам `tmksdm/folio-cms`.
- Ограничения GitHub Pages, важные для работы: один Pages-сайт на репозиторий; Pages для публичных репозиториев доступен на GitHub Free; сайт до 1 ГБ, мягкий лимит трафика 100 ГБ/мес, мягкий лимит 10 сборок в час для сборки из ветки, деплой до 10 минут. [Лимиты](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- Телефон: форма имени и заголовка с крупными целями, нормализация имени (нижний регистр, пробелы в дефисы), инлайн-проверка, видимые шаги публикации, повтор при сбое, ссылка на опубликованный сайт.

### Адреса статей: измеренное поведение GitHub Pages

Требование «`/site-name/YYMMDD` без `.html` и без завершающего слеша» проверено на реальном GitHub Pages 2026-10-12 (curl, ответы `Server: GitHub.com`):

| Что проверено | Где | Результат |
|---|---|---|
| каталог с `index.html`, запрос без слеша | `https://jekyllrb.com/docs`, `https://github.github.com/gfm` | `301` → адрес со слешем, затем `200` |
| файл без расширения | `https://jekyllrb.com/CNAME`, `/.nojekyll` | `200`, `Content-Type: application/octet-stream` |
| несуществующий путь | `https://jekyllrb.com/zzz-...`, `https://github.github.com/gfm/zzz-nope` | `404` с содержимым `404.html` сайта |

Проектные сайты публикуются по адресу `https://<owner>.github.io/<repositoryname>`, Pages для публичных репозиториев работает на Free. [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Вывод: статический GitHub Pages не отдаёт HTML одновременно без расширения и без слеша. Варианты:

- **A** — каталог `YYMMDD/index.html`: адрес `/YYMMDD` работает и ведёт к HTML, но отвечает `301`, и канонический адрес получает завершающий слеш.
- **B** — `404.html` с разбором пути на клиенте: адрес ровно `/YYMMDD` и HTML, но ответ приходит со статусом `404`.
- **C** — файл `YYMMDD.html`: расширение в адресе, требование нарушено напрямую.

Решение принимает владелец после проверки на пробном репозитории (шаг 1 плана). Эксперимент не запускался: создание репозиториев требует отдельного согласования.

## Следующие этапы

Stage 02 не разрешён к реализации: этот раздел — план для ревью. Старая Astro/CLI/односайтовая архитектура Stage 00 отменена; история сохранена.
