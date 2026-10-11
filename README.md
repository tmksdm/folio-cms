# Folio CMS

Собственная CMS для нескольких независимых сайтов GitHub Pages. Общая админка — Cloudflare Worker с собственным входом по email-коду через Resend и Turnstile, без Zero Trust и собственного домена.

Stage 01: адаптивные страницы, вход, защищённая серверная сессия, основа развёртывания. Создание сайтов, Markdown-редактор и GitHub-интеграция ещё не реализованы. SQLite Durable Object хранит только состояние авторизации и доступен на Workers Free.

- [Продукт](PRODUCT.md), [архитектура](ARCHITECTURE.md), [этапы](ROADMAP.md), [состояние](PROJECT_STATE.md)
- [Развёртывание и ручная проверка](DEPLOY.md)

Node.js 22.13+ (предпочтительно 24), PowerShell из корня проекта:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Без настроек `npm.cmd run dev` возвращает 503. Секреты задаёт владелец через Wrangler/Cloudflare Dashboard. `npm.cmd run preview:test` запускает только HTTPS localhost-стенд с настоящим Worker/SQLite и подменой email/CAPTCHA; инструкции воспроизведения — в DEPLOY.md.

GitHub Actions выполняет install/check/test/build, без автоматического deploy и production secrets. Успех локальных тестов не доказывает работу опубликованного сервиса; Stage 01 требует развёртывания владельцем и внешнего ревью.
