# План Stage 01 — Минимальный каркас

Статус: подготовлен на Stage 00, выполнение запрещено до явного разрешения заказчика. Вход: ревью [ADR](../decisions/0001-static-cms.md), [PRODUCT](../../PRODUCT.md) и [PROJECT_STATE](../../PROJECT_STATE.md). Нерешённые product вопросы отметить в состоянии, не считать молчание согласием.

## Scope и последовательность после разрешения

1. Проверить ветку, принятые коммиты, git status/log и правила AGENTS; создать отдельную stage/01 ветку от принятого main.
2. Выбрать текущие стабильные совместимые Node LTS/Astro/TypeScript/@astrojs/check; документировать версии, engines и лицензии. Зафиксировать точный Node в version file, package manager и lockfile. Сверить реальный API, не копировать пример из более новой документации вслепую.
3. Создать минимальные package scripts: dev, build, preview, check, test. Использовать astro check для .astro/types; node:test для build-time pure helpers. Линт добавлять только с понятной проверяемой целью, без набора format/lint plugins ради шаблона.
4. Настроить static/file/never и два параметра публичного deployment config: site и base. Валидировать origin (https для production), base (пустой или path без query/hash/traversal) и положительное целое pageSize=20. Секреты не нужны. Проверить no-double-prefix URL helper для root/project, корень заканчивается '/'.
5. Создать единственную минимальную index.astro с названием проекта; без списка статей, search, themes и внешних fonts. Не генерировать starter assets, sample blog, MDX/framework/adapter.
6. Добавить .gitignore для node_modules/dist/.astro/work/.env и документацию чистого install/build. Структуру будущего контента описать, но collections/CLI/registry/article routes не реализовывать.
7. Прогнать критерии ниже, обновить PROJECT_STATE, коммитить, отправить stage ветку и остановиться для ревью. CI/Pages workflows — Stage 04, Pagefind install — Stage 05.

## Acceptance и реальные проверки

| ID | Критерий | Проверка после реализации |
|---|---|---|
| 01-A | Чистый checkout воспроизводим | npm ci, npm run check, npm test, npm run build; log Node/npm versions |
| 01-B | Static file config без runtime | dist/index.html есть, нет server bundle/adapter; инспекция config/dependency list |
| 01-C | Root/project config | Две чистые сборки с base '' и '/folio-cms'; index ссылки/assets корректны, no-double-base |
| 01-D | URL helper контракт | node:test для root, project, trailing base normalization и invalid base; будущий article href /261011 без .html |
| 01-E | Негативная config | Нулевой/дробный pageSize, origin с path, base с '..'/query/двойным prefix отклоняются; build fail понятен |
| 01-F | Артефакт минимален | Нет исходных docs/Markdown, credentials, node_modules и лишнего client framework в dist; git diff --check |
| 01-G | Документы точны | README install commands соответствуют scripts, PROJECT_STATE фиксирует результат/ограничения и SHA в отчёте |

Проверки root/project статического артефакта не доказывают extensionless Pages; это Stage 04. Не добавлять фиктивные content/draft/search tests: их реализации ещё нет. Не обещать byte-identical build, если toolchain включает nondeterministic metadata; фиксировать семантический output и dependency reproducibility.

## Вне scope

Статьи/schema/CLI/tombstones/Markdown sanitizer, production UI/pagination/images, deployment и DNS, Pagefind, theme, ZIP backup, масштабные fixtures. План не разрешает переход к Stage 02.
