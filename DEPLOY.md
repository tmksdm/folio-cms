# Развёртывание Stage 01 без Zero Trust

Развёртывание выполняет владелец аккаунта. Код локально проверен; настоящий Worker, доставка Resend и Turnstile на аккаунте требуют ручной приёмки. Не отправляйте ключи, cookie и коды в чат или GitHub. Собственный домен не нужен: используется `workers.dev`.

## 1. Cloudflare Workers Free

В обычном Cloudflare Dashboard откройте Workers & Pages, активируйте Workers Free и выберите поддомен `workers.dev`. Не подключайте Zero Trust/Access и платный Workers план. SQLite Durable Objects поддерживаются на Free; binding и миграция уже в `wrangler.jsonc`, вручную создавать namespace не требуется. [Документация Free](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Если аккаунт всё же требует карту или оплату для Workers/Turnstile, остановитесь и сообщите, на каком экране. Доступность функций на Free подтверждена документацией, отсутствие такого требования именно на вашем аккаунте пока не проверено.

В PowerShell, Node.js 22.13+ (предпочтительно 24):

```powershell
Set-Location D:\Pr\folio
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
npx.cmd wrangler login
npm.cmd run deploy
```

Первый deploy создаст `folio-admin` и SQLite Durable Object. Без всех настроек все маршруты возвращают 503, панель не открыта. Запишите точный production URL вида `https://folio-admin.<ваш-поддомен>.workers.dev`, без завершающего слеша. Preview URL выключены. Не добавляйте другие hostname: Worker принимает только APP_ORIGIN.

Если прежний Worker уже был закрыт Cloudflare Access, отключите его Access-защиту после установки новой версии и всех настроек. Новая версия без настроек сама отказывает с 503. Старые ACCESS_TEAM_DOMAIN/ACCESS_AUD больше не читаются и могут быть удалены из настроек.

## 2. Turnstile Free

В Cloudflare Dashboard откройте **Turnstile → Add widget**:

1. Название: `Folio login`.
2. Hostname: только `folio-admin.<ваш-поддомен>.workers.dev`, без схемы и пути. Не выбирайте разрешение любых hostname и не добавляйте localhost к production-виджету.
3. Режим: Managed. Pre-clearance не включайте.
4. Сохраните публичный Site key и приватный Secret key локально. Используйте реальные ключи виджета, не тестовые ключи документации.

Turnstile работает без Zero Trust. [Free план](https://developers.cloudflare.com/turnstile/plans/), [создание виджета](https://developers.cloudflare.com/turnstile/get-started/).

## 3. Resend и Worker secrets

Используйте уже проверенный Resend API-ключ. Отправитель фиксирован: `Folio <onboarding@resend.dev>`. ALLOWED_EMAIL должен быть тем же адресом владельца аккаунта Resend, на который уже успешно пришло тестовое письмо. Другим получателям отправка с `resend.dev` недоступна без своего подтверждённого домена. Для этой личной панели менять домен или план не требуется. [Resend: ошибка validation_error](https://resend.com/docs/api-reference/errors).

Из корня репозитория последовательно выполните команды. Значения вводите только в локальные приглашения Wrangler:

```powershell
npx.cmd wrangler secret put APP_ORIGIN
npx.cmd wrangler secret put ALLOWED_EMAIL
npx.cmd wrangler secret put RESEND_API_KEY
npx.cmd wrangler secret put TURNSTILE_SITE_KEY
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY
```

APP_ORIGIN — полный HTTPS production URL без `/` на конце, пути и query. ALLOWED_EMAIL — один полный адрес без пробелов. SITE_KEY — публичный ключ созданного виджета, SECRET_KEY — его приватный ключ.

Сгенерируйте AUTH_SECRET и передайте прямо Wrangler, без вывода значения в терминал:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" | npx.cmd wrangler secret put AUTH_SECRET
npm.cmd run deploy
```

Все шесть значений хранить как **Secret**, а не обычные Variables: deploy не должен удалять настройки. Альтернатива вводу — Workers & Pages → folio-admin → Settings → Variables and Secrets → Add → Secret. AUTH_SECRET — ровно 64 строчных hex-символа из криптографического генератора. Смена AUTH_SECRET/email/origin отзывает прежние коды и сессии. Не размещайте реальные значения в `.dev.vars.example`, `wrangler.jsonc`, скриншотах или Git. Не включайте логи тел запросов/писем.

## 4. Приёмка опубликованного сервиса

В приватном окне компьютера и на телефоне:

1. Откройте `/settings` напрямую. Должен открыться `/login?next=...`, без админки.
2. Пройдите Turnstile и нажмите «Получить код» — поле email на странице нет, получателя сервер берёт из ALLOWED_EMAIL. Проверьте загрузку, письмо на разрешённый адрес и папку «Спам». Код действует 10 минут и вводится в том же браузере.
3. Один раз введите неверный код: доступа нет. Введите верный: открывается исходная `/settings`, виден ваш email. Проверьте обзор, пустые сайты, прямые ссылки и обновление страниц.
4. Нажмите «Выйти». Снова откройте panel/API: требуется вход. Ранее сохранённая session-cookie после выхода тоже не должна давать доступа. Не пересылайте cookie.
5. Повторное использование кода запрещено. Пять ошибок подряд аннулируют код. Новый запрос заменяет старый; между запросами нужна минута, максимум 5 в час и 20 в сутки, включая ошибки доставки.
6. В другом приватном окне пройдите Turnstile и запросите код: сообщение нейтральное, письмо всегда уходит только на ALLOWED_EMAIL; каждый такой запрос расходует общую квоту отправок.
7. До входа прямые `/api/session`, `/api/sites`, `/assets/admin.js`, `/assets/admin.css` возвращают 401. Поддельный Access/email-заголовок не помогает. Страница входа и её два ресурса публичны.
8. Через час без нового входа `/api/session` должен вернуть 401; интерфейс при повторной проверке предлагает войти снова. Откройте защищённую страницу напрямую — появится вход.
9. Проверьте ошибки сети и повторную попытку; ошибка выхода не должна показывать успешный выход. На телефоне — отсутствие горизонтальной прокрутки, удобство ввода шести цифр и Turnstile.

Запишите URL, дату, результат доставки, разрешённого/запрещённого входа, повторного кода и выхода. Просмотрите Free usage Workers/DO и остаток Resend quota. Бесплатные лимиты могут временно закрыть сервис; не повышайте тариф автоматически. Код не гарантирует защиту доступности против DDoS.

## Локальный HTTPS-стенд

`npm.cmd run dev` без конфигурации проверяет настоящий закрытый Worker (503). `.dev.vars.example` содержит только имена настроек; реальные значения в `.dev.vars` игнорируются Git.

Для повторения браузерного сценария без отправки реальных писем:

```powershell
npm.cmd run preview:test
```

Во втором PowerShell:

```powershell
'{"browser":{"contextOptions":{"ignoreHTTPSErrors":true}}}' | Set-Content playwright.config.json -Encoding utf8
npx.cmd playwright-cli open https://127.0.0.1:4173 --browser msedge --config=playwright.config.json
npx.cmd playwright-cli run-code --filename tests/browser-check.js
npx.cmd playwright-cli close
```

Игнорирование сертификата применяется только к localhost-стенду. В нём настоящие Worker/SQLite и тестовые значения, а доставка и Siteverify подменены. В браузерном сценарии виджет тоже подменён. Это не подтверждение настоящей доставки/Turnstile. `tests/` и локальный endpoint получения тестового кода не входят в production bundle. После проверки остановите стенд Ctrl+C.

После развёртывания — внешнее ревью Stage 01. Stage 02 не начинать.
