# PROJECT_STATE.md — Snapshot Stage 00

Статус: документация Stage 00 подготовлена для внешнего ревью; архитектура proposed. Ни один этап ещё не принят. Stage 01 не разрешён, CMS не реализована, deployment не выполнялся.

## Контекст и scope

Repository: https://github.com/tmksdm/folio-cms (public). При чтении GitHub branches вернул пустой список, size=0; local checkout work — unborn, изменений пользователя нет. Приоритет — явный запрос пользователя: только Stage 00, публикация изменений и остановка для ревью.

Изучены оба вложения, все 8 Markdown файлов пакета; FIRST_PROMPT отдельного вложения совпадает с пакетным. Пользователь поручил выполнить FIRST_PROMPT, но предложения пакета и ADR не являются самостоятельным разрешением будущих этапов.

Branch результата: `stage/00-design`. Поскольку удалённый репозиторий пуст, план публикации: начальный README на default main для базы сравнения, затем атомарный docs commit на stage ветке через авторизованный GitHub connector. Terminal git ls-remote не работает: proxy:8080 connection refused. Удалённая публикация и SHA подтверждаются отдельно в финальном отчёте; этот документ внутри коммита не может содержать свой собственный SHA. Если публикация не подтверждена, не считать её выполненной. История результата: [GitHub commits stage/00-design](https://github.com/tmksdm/folio-cms/commits/stage/00-design); [сравнение main...stage](https://github.com/tmksdm/folio-cms/compare/main...stage/00-design).

## Подготовлено

- Шесть проектных документов согласованы по scope, workflow и gates; README — навигация.
- [Исследование](docs/research/STAGE-00.md): факты/гипотезы, 11 прочитанных официальных источников, конкретный live smoke Stage 04.
- [ADR](docs/decisions/0001-static-cms.md): каждое существенное изменение, альтернативы, вопросы.
- [План Stage 01](docs/plans/STAGE-01.md): ограниченный каркас, acceptance, позитивные/негативные проверки.
- No DB/runtime обоснован; ID/реестр/concurrency/media/search URLs/backup описаны. PoC не потребовался: документальные данные достаточны для проектирования, hosting gate требует будущего live-test.

## Проверки и ограничения

Web tool успешно открыл 11 итоговых source URLs. Локально выполнены cmp двух FIRST_PROMPT (совпадают), Python stdlib validation (10 документов, 26 локальных ссылок, 11 источников, fences/whitespace/scope — PASS), git diff --cached --check (PASS). Временный checker находится вне репозитория в work/check_docs.py; финальный отчёт перечисляет фактические проверки. npm/build/runtime/Pages/search/restore tests не запускались, зависимостей/package.json нет. Публичного сайта нет. Network environment readiness не доказывала git transport; connector подтвердил repo push permission, это ещё не evidence публикации.

## Открытые решения

Полный список в ADR: date 2000–2099, date lock и lifetime draft reserves, web ручной ID против CLI, raw HTML rejection, custom domain/root test, альтернативный хостинг/URL при live gate fail, независимое хранение ZIP. Draft status скрывает контент с сайта, но не в public source repo.

Главный технический риск: extensionless URL на реальном Pages не доказан. Следующий разрешённый шаг сейчас — только внешнее ревью Stage 00. После явного принятия обновить snapshot отдельным изменением; до того Stage 01 не начинать.
