# Stage 00 — Совместимость и доказательства

Проверено 2026-10-11 чтением официальных источников через web tool. Это документальное исследование, без PoC, установки зависимостей и deployment. Источники актуальны на дату чтения; версии API повторно сверить при фиксации toolchain. [ADR](../decisions/0001-static-cms.md) содержит проектные выводы, а не факты хостинга.

## Факты, гипотезы, будущие проверки

| Область | Документальный факт | Вывод / неизвестное | Проверка |
|---|---|---|---|
| Astro file output | S1: file создаёт route.html; build-time Astro.url содержит .html | Ссылки/canonical следует строить по slug | Stage 01 output, Stage 02 routes |
| trailingSlash | S1: для prerender правила определяет hosting, Astro setting может не соблюдаться | Не доказано: Pages выдаёт /261011 сразу 200 без redirect | Stage 04 live protocol ниже |
| Pages | S2: static hosting, project site расположен под repositoryname, custom domain поддержан | Нет в прочитанных источниках обещания mapping /slug → /slug.html | Не считать отсутствие обещания доказательством невозможности |
| Project base | S1/S3: base нужен для subpath, ручные URLs учитывают BASE_URL | Требуется единая нормализация, root отдельно | Build profiles '' и /folio-cms |
| Markdown images | S4: Markdown local src images используют путь от исходника и обрабатываются; public images не оптимизируются | Конкретный collection loader вне/внутри src и draft media требуют fixture | Stage 02/03 published/draft images, missing file |
| HTML | S5: Astro Markdown допускает HTML и processor plugins | Нельзя предполагать default sanitation; AST запрет — проектная политика | Stage 02 raw node/scheme tests |
| Pagefind scope | S6: наличие body marker исключает страницы без него, ignore убирает элементы | Пустой корпус/metadata/служебные страницы требуют отдельного allowlist | Stage 05 count и sentinel tests |
| Search URLs | S7: keep_index_url регулирует index.html, не общий .html | Не использовать эту опцию как extensionless решение | S8 addHTMLFile с явным URL; проверить pinned API |
| Search base | S9: baseUrl добавляется к результатам, bundle path отдельный | Base в index и browser нельзя добавлять дважды | Root и project fixtures, browser fetch/results |
| Кириллица | S10: ru поддерживает UI translation и stemming через lang | Это не доказательство качества поиска, произвольного substring или typo | Stage 05 корпус и query matrix |
| Drafts | Static HTML и assets доступны всем посетителям | Filtration перед HTML не доказывает asset exclusion; GitHub public исходники видны | Whole-dist audit с draft text и уникальным asset |
| Immutable ID | Присвоение на build через count зависит от состава файлов (логический вывод) | Registry + max + Git review достаточны без DB; concurrent PR требуют resolve | Stage 02 allocation/deletion, Stage 04 history diff |
| Backup | Git хранит историю; ZIP выбранных исходников переносим (проектное решение) | ZIP без registry/code version недостаточен для эквивалентного restore | Stage 07 clean restore и hashes |
| Масштаб | S11: Pages published site ≤1 GB, deploy timeout 10 мин | 1000 статей возможно условно по размеру media/index; число само по себе не гарантирует бюджет | Stage 08 size/time/load fixtures |

## Прочитанные первичные источники

- S1 — [Astro configuration reference](https://docs.astro.build/en/reference/configuration-reference/), разделы site/base/trailingSlash/build.format.
- S2 — [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), static hosting, site types, custom domains.
- S3 — [Astro deployment to GitHub Pages](https://docs.astro.build/en/guides/deploy/github/), site/base и Actions.
- S4 — [Astro images](https://docs.astro.build/en/guides/images/), Markdown, src/public, collections.
- S5 — [Astro Markdown](https://docs.astro.build/en/guides/markdown-content/), HTML, collections и plugins.
- S6 — [Pagefind indexing](https://pagefind.app/docs/indexing/), body/ignore и metadata.
- S7 — [Pagefind CLI options](https://pagefind.app/docs/config-options/), glob и keep_index_url.
- S8 — [Pagefind Node API](https://pagefind.app/docs/node-api/), addHTMLFile и writeFiles, error arrays.
- S9 — [Pagefind search configuration](https://pagefind.app/docs/search-config/), baseUrl и bundle path / API basePath.
- S10 — [Pagefind multilingual](https://pagefind.app/docs/multilingual/), html lang и Russian.
- S11 — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

Все 11 ссылок успешно открыты web tool. Первоначальный адрес Pagefind /docs/js-api/ вернул ошибку, заменён подтверждённым /docs/api/; в итоговых ссылках не используется. Якоря внешних ссылок намеренно не добавлены, так как не проверялись HTTP fragment targets.

## Live smoke test Stage 04 (план, НЕ запускался)

В одобренном Stage 04 сначала минимальный deployment fixture: `index.html`, `261011.html`, `261011-2.html`, `404.html`, CSS и локальное image с узнаваемыми маркерами. Сборка соответствует file output; без redirects, SPA, service worker и дублей `261011/index.html`. Сначала подтвердить hosting gate, затем production deploy. Сохранить commit, Actions run, hostname, дату, artifact manifest, headers и browser HAR.

Для каждого реально доступного профиля — project `https://tmksdm.github.io/folio-cms`, root/custom domain (URL назначает владелец):

```sh
curl -sS --max-time 30 -D headers.txt -o article.html "$SMOKE_ORIGIN$SMOKE_BASE/261011"
curl -sS --max-time 30 -L -D chain.txt -o /dev/null -w '%{http_code} %{url_effective} %{num_redirects}\n' "$SMOKE_ORIGIN$SMOKE_BASE/261011"
```

Здесь SMOKE_ORIGIN — только origin, SMOKE_BASE — пустая строка либо /folio-cms. Выполнять GET, не считать HEAD достаточным. Успех первой команды не равен gate: проверить первый HTTP status 200, отсутствие Location, содержимое нужной статьи, правильный Content-Type. Во второй final URL строго тот же и num_redirects=0. Ошибка HTTP curl без -f может иметь exit 0, поэтому status проверяется явно.

В чистом browser profile открыть прямой URL (не переход с homepage), записать network chain и адресную строку; reload, новая вкладка, JS disabled, мобильный браузер/второе устройство. В HTML нет meta refresh, client redirect. CSS/image loads 200 и корректный base; `/261011-2` также проходит. `/missing-stage00-smoke` отдаёт реальный 404; homepage и pagination читаются без JS. Дополнительно записать поведение `/261011.html` и `/261011/`, но не выдавать его за успех canonical gate.

Повторить после deployment реального article pipeline. Stage 05 повторяет GET/browser проверку ссылок search results. Для custom domain проверить HTTPS/DNS готовность и отсутствие redirect на другой hostname; неподготовленный домен остаётся незавершённым критерием. Root fixture на другом локальном сервере — только build evidence, не live Pages evidence.

При провале gate остановиться и дать заказчику headers/HAR и варианты из ADR. На Stage 00 live-test не выполнялся, работоспособность extensionless Pages не заявляется.
