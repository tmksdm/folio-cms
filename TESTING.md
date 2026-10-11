# TESTING.md — Минимальная матрица проверки

## Content/slug
- 2026-10-11: `261011`, `261011-2`, `261011-3` корректны; 2026-10-12: `261012`.
- Duplicate ID, неверная дата, неправильный суффикс, несовпадение slug/date, пустой title, неизвестный status -> ошибка проверки с объяснением.
- Удаление или перестановка файлов не перенумеровывает статьи. Повторное использование опубликованного удалённого slug запрещено/подчинено утверждённой политике.
- Изменение body/title не изменяет route. Старые ссылки работают.

## Output
- `dist/261011.html` присутствует. `dist/261011/index.html` не является источником основного маршрута.
- На published страницах заголовок, дата, контент, изображения; у drafts нет HTML/index entry/search data.
- Отсутствуют исходные Markdown, секреты, локальная рабочая директория в публичном артефакте.
- Порядок: по дате убыванию, при одинаковой дате номер по убыванию, а не по лексикографическому имени (где -10 мог бы стоять перед -2).
- 0/1/20/21/100+ статей: корректная пагинация, отсутствие пустых страниц, правильные ссылки.

## Live GitHub Pages
- Прямая ссылка `/261011`, обновление, новая вкладка, браузер без кеша: HTTP 200 и итоговая адресная строка БЕЗ `/` и `.html`; зафиксировать реальную цепочку редиректов.
- Root site и project site `/repo/261011` с корректными ссылками и ассетами.
- Неизвестный путь отдаёт 404 (не маскировать как чужую статью).

## Search
- Кириллица в заголовке и тексте, список результатов, нет результатов, пустая строка, навигация с клавиатуры, медленное соединение, no-JS состояние, черновики отсутствуют.

## UI / reliability
- Мобильный viewport, десктоп, длинные заголовки, широкие таблицы, код, большие изображения (нет горизонтальной прокрутки всей страницы).
- Темы: system/dark/light, persistence, нет мерцания, доступный переключатель.
- Сборка на чистом checkout через `npm ci`, типы/линт/юнит и интеграционные проверки; smoke после deployment.
- ZIP backup: экспорт, извлечение в чистый репозиторий, повторная сборка и сверка статей/изображений; исключить токены.

## Дополнения Stage 00 (план будущих проверок)

Текущая документация проверяется отдельно; перечисленные выше runtime тесты ещё НЕ запускались. Детальный URL protocol и 11 официальных источников: [исследование](docs/research/STAGE-00.md).

| Этап | Негативные/пограничные случаи | Ожидаемое evidence |
|---|---|---|
| 01 | Base '' и /folio-cms, invalid config, clean npm ci | Build logs, helper tests, dist inventory |
| 02 | Leap day valid/invalid, quoted date, -1/-02, century range по решению ревью, mismatch file/slug/registry | Content validation blocks build |
| 02 | Retired gaps, draft reserves, two concurrent allocations, interrupted CLI write, deletion | Max N+1, no partial state, no overwrite |
| 02/04 | Registry record/date removal, slug/date mutation, PR base drift | Snapshot и history errors; approved restore отдельно |
| 02/03 | Raw script/iframe, javascript link, data URL, HTML fenced code, missing image, traversal/symlink | Raw/unsafe rejected; fenced code harmless |
| 02/03/06 | Draft unique title/body/image sentinel и published→draft toggle | Нет HTML, source, media, map/manifest/public artifact утечек; GitHub исходники всё ещё публичны |
| 03 | 0/1/20/21/100/1000 items, same-date -2/-10, image space/Cyrillic paths | Numeric order, no empty pagination, no-JS links/images |
| 04 | GET first 200, zero redirects, browser reload/no-JS, root/project, missing route | Headers/HAR/commit/run, actual hostname, untested domain явно указан |
| 05 | Empty corpus, published allowlist, title/body Cyrillic, morphology/prefix/ё/е/typo, index unavailable | Article count matches index, documented actual language behavior, accessible errors |
| 05 | /261011 result + /folio-cms/261011, bundle/fragment/WASM fetch | No .html/trailing slash/double base, no service/home/draft result |
| 06 | localStorage denied, early theme script, system change и manual preference | No flash, keyboard/contrast, graceful storage fallback |
| 07 | Clean restore, stale registry, tampered hashes, archive path traversal, secrets/cache exclusion | Fail safely, same normalized routes/content/media, toolchain pinned |
| 08 | 100–1000 articles/media, cold first home/search load, dist size/time | No full-body preload; measured JS/index/media bytes and build time |

Artifact gate проверяет всё дерево dist, включая compressed/search fragments, JSON, sourcemaps и media; простой grep по HTML недостаточен. Media exclusion проверить также manifest/hash уникального draft файла. Test reports должны отличать неисполненный план от реального результата; local preview не substitute live hosting.
