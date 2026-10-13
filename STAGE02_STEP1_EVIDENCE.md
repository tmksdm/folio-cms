# Свидетельства измерений: Stage 02, шаг 1 (2026-10-13)

Очищенные от секретов, воспроизводимые свидетельства экспериментов на живом GitHub для шага 1 и шага 1.1 Stage 02. Это **не** документ состояния (состояние — `PROJECT_STATE.md`) и **не** план (`ARCHITECTURE.md`): здесь только результаты измерений. Секретов нет — ни приватного ключа, ни JWT, ни access/refresh-токенов, ни OAuth-кодов, ни client secret, ни значений чувствительных заголовков; App ID и ID установки секретами не являются.

Уровни доказательств: **[П]** — прямой ответ живого GitHub; **[И]** — наше HTTP-измерение (независимым ревьюером не проверено).

Аккаунт: `tmksdm`. Приложение: `folio-cms-pages`, App ID 5299581, homepage `https://folio-admin.doridupa.workers.dev`. Установка: `170953323` на `tmksdm`, `repository_selection: all`. Выданные права: `administration: write`, `contents: write`, `pages: write`, `metadata: read`.

Инструмент: `probe.mjs` (локальный, вне Git; подкоманды `raw | token | create | push | urls | wait`), измеритель адресов делает `fetch` с `redirect: manual` и читает `status`, `location`, `content-type`; ключ подписи JWT читается из файла вне репозитория, токены вырезаются из вывода. Команды восстановления: `node probe.mjs token` → `create` → `push jekyll` → `wait` → `urls` → `push nojekyll` → `urls`.

## 1. Installation-токен и управление [П]

| Операция | Результат |
|---|---|
| JWT (RS256) → `POST /app/installations/170953323/access_tokens` | `201`, токен на 1 час |
| `GET /installation/repositories?per_page=100` | `200`, `total_count` 41, включая новый репозиторий |
| `PUT /repos/tmksdm/folio-pages-probe/contents/folio.json` | `201` |
| Git Data API (blob → tree → commit → ref) | `201` / `200` |
| `POST /repos/tmksdm/folio-pages-probe/pages` | `201`, `build_type: legacy`, `https_enforced: true` |
| `GET /repos/tmksdm/folio-pages-probe/pages` | `200` |
| `GET /repos/tmksdm/folio-pages-probe/pages/builds` | `200`; сборки `built` за 3–44 с |

Первая сборка после включения Pages завершилась `errored` («Page build failed.»), последующие — `built`.

Ключ: скачанный из интерфейса — PEM `PKCS#1 RSAPrivateKey`, RSA 2048 (Credentials → Key pairs → New key; раздел «Private keys» в текущем интерфейсе отсутствует). WebCrypto принимает `PKCS#8`, поэтому для Worker нужна конвертация `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt`.

Лимит installation-токена, наблюдавшийся в ответах: `x-ratelimit-limit: 6000` в час (не 5000, как предполагалось по документации).

## 2. Создание репозитория [П]

| Вызов | Токен | Результат |
|---|---|---|
| `POST /user/repos` | installation access token | `403`, тело `{"message":"Rate Limit Exceeded"}`; воспроизведено 3 раза с интервалами 90 с |
| `POST /user/repos` | user OAuth-токен `gh` (scope `repo`) | `201` — репозиторий создан |

Сохранённые заголовки ответа `403`: `x-ratelimit-limit: 6000`, `x-ratelimit-remaining: 5992` (первичный лимит не исчерпан), `x-accepted-github-permissions: administration=write; repository_creation=write`.

**Причина `403` не установлена.** Неизрасходованный первичный лимит не исключает secondary rate limiting, abuse detection и других серверных ограничений GitHub; сообщение `Rate Limit Exceeded` их не различает. Что **не сохранено** и потому неизвестно: `retry-after`, `documentation_url`, `x-github-request-id`, полное тело ответа. Что не проверялось: поведение того же вызова с заведомо невалидным телом и после окна `x-ratelimit-reset`. Переносить результат user-токена `gh` на user access token приложения нельзя — это другой тип токена и другая выдача.

## 3. Адреса GitHub Pages [И]

Репозиторий `tmksdm/folio-pages-probe`, сайт `https://tmksdm.github.io/folio-pages-probe/`. Каждый адрес измерен дважды: обычным запросом и с `Accept: text/html`; ни один статус и ни один `Content-Type` от этого не изменились.

### Основная схема: `.nojekyll`, статические файлы

| Адрес | HTTP | `Location` | `Content-Type` | Вывод |
|---|---|---|---|---|
| `/YYMMDD` (файл `YYMMDD.html`) | `200` | — | `text/html; charset=utf-8` | требование выполнено; в браузере адресная строка остаётся `/folio-pages-probe/261013` |
| `/YYMMDD.html` | `200` | — | `text/html; charset=utf-8` | прямая ссылка на тот же файл |
| `/YYMMDD/` | `404` | — | `text/html; charset=utf-8` | каталога нет, существует только файл |
| `/b` при файле `b.html` | `200` | — | `text/html; charset=utf-8` | подтверждает подстановку расширения |
| `/a` при файле `a/index.html` | `301` | `…/a/` | `text/html` | каталог без слеша переадресуется — не годится |
| `/c` — файл без расширения | `200` | — | `application/octet-stream` | браузер скачивает файл, переход прерывается (`ERR_FAILED`) — не годится |
| `/_redirects` | `200` | — | `application/octet-stream` | отдаётся как файл; правил переадресации GitHub Pages не применяет |
| несуществующий путь | `404` | — | `text/html; charset=utf-8` | тело ответа берётся из `404.html` (измерение, механизмом публикации не является) |

### Режим Jekyll: посты `YYYY-MM-DD-slug.md` с явным permalink

| Адрес | HTTP | `Content-Type` |
|---|---|---|
| `/261013` (Jekyll permalink) | `200` | `text/html; charset=utf-8` |
| `/261013/` | `404` | `text/html` |
| `/2026/10/13/default.html` (permalink по умолчанию) | `200` | `text/html` |
| `/_redirects` | `404` | `text/html` |

Файл `261013-probe.md` (имя без `YYYY-MM-DD-slug`) Jekyll игнорирует молча, и адрес `/261013` отдаёт `404` — для статической публикации это несущественно.

## 4. Наблюдения на чужих GitHub Pages (2026-10-12) [И]

Запросы curl к реальным Pages-сайтам (ответы `Server: GitHub.com`), не к своему аккаунту: каталог с `index.html` без слеша → `301` на адрес со слешем; файл без расширения (`CNAME`, `.nojekyll`) → `200` с `Content-Type: application/octet-stream`; несуществующий путь → `404` с содержимым `404.html`. Измерения на своём пробном репозитории 2026-10-13 их подтвердили.

## 5. Шаг 1.1 (2026-10-13): GitHub App user access token [П]

### 5.1. Настройки приложения и доступность device flow

| Проверка | Результат |
|---|---|
| `GET /app` по JWT | `200`; App ID 5299581, slug `folio-cms-pages`, владелец `tmksdm` |
| Права приложения | `administration: write`, `contents: write`, `pages: write`, `metadata: read`; события — `events: []` |
| `client_secret` в ответе `GET /app` | отсутствует — через API не выдаётся, только интерфейс приложения |
| `POST /login/device/code` до действия владельца | `400 device_flow_disabled` |
| `POST /login/device/code` после включения device flow владельцем | `200`, выдан одноразовый код (`expires_in: 899`, `interval: 5`) |

### 5.2. Полученный токен

| Свойство | Значение |
|---|---|
| Тип | **GitHub App user access token** (`ghu_`), длина 40; не `ghs_` (installation) и не `gho_` (OAuth) |
| Владелец | `tmksdm` (`GET /user` → `200`, `login: tmksdm`) |
| Срок жизни | 8 часов (`expires_in: 28800`) |
| `scope` | пуст (`x-oauth-scopes: ""`) — приложения используют fine-grained permissions, а не scope |
| Refresh-токен | выдан, тип `ghr_` (GitHub App refresh token), длина 80, срок ~182 дня (`refresh_token_expires_in: 15724800`) |
| Ротация refresh-токена | подтверждена: обмен вернул новый `access_token` и новый `refresh_token`, отличающиеся от прежних; старый refresh перестал действовать |

### 5.3. Доступ к `POST /user/repos`

| Вызов | Токен | Результат |
|---|---|---|
| `POST /user/repos` (имя с пробелами и `!`) | user access token (`ghu_`) | `201` — репозиторий создан; `x-accepted-github-permissions: administration=write; repository_creation=write`; `x-ratelimit-remaining: 4997` |

Оговорка об интерпретации: `201` доказывает создание этим токеном. Обратные ответы (`422`/`403`) ничего не доказывали бы: `422` не гарантирует успеха при валидных параметрах, а `403` не доказывает отсутствия права.

**Инцидент (важно).** Имя `folio probe name with spaces!` GitHub не отклонил, а нормализовал в `folio-probe-name-with-spaces-` и создал репозиторий. Так был создан публичный пустой репозиторий `tmksdm/folio-probe-name-with-spaces-` (`private: false`, `size: 0`, `has_pages: false`, без коммитов) — вопреки ограничению «не создавать репозитории». Создан ровно один репозиторий; существующие репозитории, их файлы, Pages и настройки не изменялись. Репозиторий оставлен как есть; удаление — решение владельца.

### 5.4. Гигиена секретов

Access- и refresh-токены не печатались и не попадали в Git, логи или сообщения — выводился только тип токена по префиксу. Временные файлы `.device.local` и `.tokens.local` (git-ignored `output/`) удалены после проверки.

## 6. Что эти свидетельства не доказывают

- Причину `403` при создании репозитория installation-токеном.
- Поведение при отзыве авторизации владельцем и при истечении/недействительности refresh-токена.
- Поведение адреса второго материала дня (`YYMMDD-2.html` → `/YYMMDD-2`) — ожидается тем же механизмом, но не измерялось; проверка относится к Stage 03.
- Поведение при выборочном доступе к репозиториям и потере установки.
- Что выбранный для реализации flow (device или web) ведёт себя так же: тип токена одинаков, но это не измерялось.

## 7. Очистка ошибочного репозитория (2026-10-13) [П]

Репозиторий, созданный по инциденту шага 1.1, удалён с разрешения владельца.

Проверки до удаления (`GET /repos/tmksdm/folio-probe-name-with-spaces-` installation-токеном): `id` 1416975700, владелец `tmksdm`, `private: false`, `size: 0`, `has_pages: false`, ветки `[]`, коммиты `409` (пустой репозиторий), содержимое `404`, Pages `404`.

| Операция | Результат |
|---|---|
| `DELETE /repos/tmksdm/folio-probe-name-with-spaces-` | `204` |
| `GET /repos/tmksdm/folio-probe-name-with-spaces-` после удаления | `404` |
| контрольный `GET /repos/tmksdm/folio-pages-probe` | `200` (не тронут) |
| независимая проверка другим токеном (`gh`), список репозиториев | 41 репозиторий, искомого имени нет, остался только `folio-pages-probe` |

Побочное наблюдение: installation-токен с правом `Administration` (write) **может удалять репозитории** — это повышает цену установки `All repositories`. Код Folio удаление не вызывает.
