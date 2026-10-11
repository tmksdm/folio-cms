# Folio CMS

Собственная CMS для независимых сайтов GitHub Pages. Общая админка — Cloudflare Worker с входом через Cloudflare Access по email-коду.

Stage 01: адаптивный интерфейс, проверка доступа, основа развёртывания. Создание сайтов, Markdown-редактор и GitHub-интеграция ещё не реализованы.

- [Продукт](PRODUCT.md), [архитектура](ARCHITECTURE.md), [этапы](ROADMAP.md), [состояние](PROJECT_STATE.md)
- [Развёртывание и ручная проверка](DEPLOY.md)

Node.js 22+; команды в PowerShell из корня проекта:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd run build
```

`npm.cmd run dev` запускает настоящий Worker локально. Без настроенного Access/JWT он намеренно возвращает отказ, а не публичную админку.

`npm.cmd run preview:test` запускает **только тестовый стенд интерфейса** на `http://127.0.0.1:4173`: временный тестовый signer, без Cloudflare OTP. Не использовать как развёртывание или доказательство защиты.

Для воспроизводимой браузерной проверки оставить стенд работающим и в другом PowerShell выполнить (нужен установленный Edge):

```powershell
npx.cmd playwright-cli open http://127.0.0.1:4173 --browser msedge
npx.cmd playwright-cli run-code --filename tests/browser-check.js
npx.cmd playwright-cli close
```

Проверки в GitHub Actions выполняют установку, проверку JavaScript, 15 тестов доступа/маршрутов и dry-run сборку. Автоматического развёртывания Cloudflare нет.
