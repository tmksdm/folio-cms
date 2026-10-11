# Первый запуск Cloudflare

Реальное развёртывание выполняет владелец аккаунта. На Stage 01 оно не выполнено; localhost и dry-run не доказывают работу Access. Секреты и код из письма не отправлять в чат или GitHub.

## 1. Подготовка

Нужны Node.js 22+, собственный Cloudflare-аккаунт, Workers Free и Zero Trust Free. Не выбирать платный план. По [текущей инструкции Cloudflare](https://developers.cloudflare.com/cloudflare-one/setup/) при подключении Zero Trust Free могут потребоваться платёжные данные, хотя бесплатный план не начисляет плату. Если это неприемлемо — остановиться; платный тариф не включать.

В PowerShell:

```powershell
Set-Location D:\Pr\folio
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
npx.cmd wrangler login
npm.cmd run deploy
```

`wrangler login` открывает авторизацию Cloudflare в вашем браузере. Токены в репозиторий не копировать. Первый deploy создаёт `folio-admin` на `https://folio-admin.<ваш-поддомен>.workers.dev`. Пока параметры Access не заданы, **все страницы и API возвращают 503 без интерфейса**. Это закрытый старт, а не публичная админка. Preview URL отключены в `wrangler.jsonc`.

## 2. Email-код и единственный разрешённый адрес

1. В Cloudflare открыть **Zero Trust**, завершить настройку Free, выбрать имя команды. Записать точный адрес `https://<имя-команды>.cloudflareaccess.com` без завершающего слеша.
2. В **Zero Trust → Integrations → Identity providers** добавить **One-time PIN**. Для новых организаций он больше не включается автоматически. Названия пунктов могут меняться; [официальная инструкция OTP](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).
3. В **Workers & Pages → folio-admin → Access → Protect this Worker behind Access** выбрать **All traffic**, чтобы защитить production и связанные адреса, не только preview. [Инструкция защиты Worker](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
4. Настроить policy: **Action = Allow**, **Include → Emails → ваш единственный полный email**, **Require → Login methods → One-time PIN**. Для приложения оставить только One-time PIN как способ входа; отключить использование всех провайдеров по умолчанию. Session duration — например 1 час.
5. Удалить автоматически добавленные разрешения другим участникам аккаунта и проверить, что нет иных Allow/Bypass/Service Auth правил. Не выбирать `Everyone`, весь email-домен или `One-time PIN` как самостоятельное Include. [Правила Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/).
6. В **Zero Trust → Access controls → Applications → приложение folio-admin → Overview** скопировать **Application Audience (AUD) Tag**. Это 64 шестнадцатеричных символа конкретного приложения. Если Worker-level Access недоступен, создать **Self-hosted** приложение на весь production-hostname без ограничения пути, с той же policy; preview оставить выключенным, дополнительные hostname не добавлять до их защиты.

## 3. Параметры Worker

После настройки policy открыть **Workers & Pages → folio-admin → Settings → Variables and Secrets**, добавить серверные параметры (можно тип Secret, чтобы не раскрывать email):

| Имя | Значение |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `https://<имя-команды>.cloudflareaccess.com`, без `/` на конце |
| `ACCESS_AUD` | AUD из Access application |
| `ALLOWED_EMAIL` | Тот же единственный полный email, который разрешён policy |

Сохранить и применить изменения. Не записывать значения в `wrangler.jsonc` и не коммитить `.dev.vars`. Эти значения не заменяют policy — нужны обе проверки. [Серверная проверка JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Для последующих обновлений `npm.cmd run deploy` сохраняет Cloudflare secrets. Если добавляли параметры как обычные Variables, сначала убедиться, что Wrangler не удалит их: предпочтительно хранить все три как **Secret** или задавать через `npx.cmd wrangler secret put ИМЯ` (ввод только в локальный терминал).

## 4. Ручная приёмка именно опубликованного сервиса

- В приватном окне открыть Worker: сначала страница Cloudflare Access, без панели Folio. Прямые `/api/session`, `/api/sites`, `/assets/admin.js` тоже требуют входа; UI/identity не доступны анонимно.
- Ввести разрешённый email, получить код, войти: открывается обзор. Перейти в «Сайты» (пустой список), «Доступ» (ваш email). На телефоне проверить отсутствие горизонтальной прокрутки и удобство навигации.
- Открыть `/sites` и `/settings` напрямую, обновить страницу: интерфейс и стили загружаются после проверки Access.
- Нажать «Выйти», затем повторно открыть panel/API: снова требуется вход. После истечения сессии API не выдаёт identity, панель предлагает повторный вход.
- В другом приватном окне указать другой email: доступа нет. Cloudflare может показать «код отправлен» для скрытия существования адреса; это не означает разрешение доступа.
- Через терминал запросить URL без cookie, затем с поддельным `Cf-Access-Jwt-Assertion: invalid`: не должно быть 200 с панелью или данными API. Если Access перехватит запрос и вернёт свою login-страницу со статусом 200, отличать её от Folio/JSON; это не доступ к приложению.
- Проверить все включённые hostname; preview URL сейчас выключены. Не добавлять route/custom domain без защиты. При сбое конфигурации панели возвращается отказ, а не гостевой режим.

Записать фактический URL, дату, разрешённый/отклонённый вход и результат выхода. До этих проверок статус остаётся «подготовлено к развёртыванию», а не «опубликовано и защищено».

## Локальные проверки

`npm test` проверяет настоящие RSA-подписи на временных ключах, issuer/audience/expiry/email, отрицательные случаи и защищённость маршрутов. `npm run dev` запускает runtime Worker без обхода доступа. `npm run preview:test` — только стенд интерфейса с тестовой identity `owner@example.test`; не проверяет доставку OTP, policy или logout Cloudflare.

Worker не использует платные bindings. [Ограничения Workers Free](https://developers.cloudflare.com/workers/platform/limits/) включают суточную квоту запросов и CPU; реальные расходы CPU криптопроверки под этой квотой требуют проверки на вашем аккаунте. Если лимит мешает, сначала измерить и обсудить решение, не менять тариф автоматически.
