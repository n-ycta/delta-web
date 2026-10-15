# Delta Web

Независимый плагин управления Delta: React 18 + TypeScript + Vite 8, Node.js 22.12+ backend. Оригинальный дизайн, светлая/тёмная тема, адаптивный layout, редактируемые дашборды и динамические Zod-контракты плагинов. Логотип — предоставленный SVG.

```sh
npm ci
npm run build
# .env.example → .env, DELTA_TOKEN — серверный токен
npm start
```

Полный запуск ядра и всех плагинов — в `delta/docs/ecosystem.md`. Реальный режим по умолчанию: в UI «Настройки → Подключение», HTTP, `/api`, пользовательский token. Для автономного демо: `VITE_CORE_MODE=mock npm run dev`, либо выберите Mock в настройках. Демо-данные остаются отдельным адаптером, никогда не используются как запасной ответ реального API.

## Архитектура

- `src/api/http/HttpCoreAdapter.ts`: Delta v1 envelope/capabilities, polling, session-only browser credential.
- `server/`: отдельный внешний компонент `web`, static server и same-origin proxy; Zod-валидация дашбордов/метрик; caller-scope checks.
- `src/i18n/ru.json`: весь собственный текст UI; части по модулям, `tr(key, params)`; `server/locales/ru.json`: сообщения bridge. Plugin metadata принадлежит публикующему плагину, а не hardcode UI.
- `src/core/contracts`, `src/core/registry`: схемы и динамическая совместимость.
- `src/widgets/`: временные ряды, столбцы, показатели, шкалы, heatmap, histogram, pie/treemap, comparison, таблицы и системные виджеты.
- `src/dashboards/`: drag/resize, сохранение и импорт/экспорт.

Для i18n не требуется отдельный сервис: один ru.json. Ключи имеют вид `pages.Home.s_<hash>`; partition соответствует модулю, интерполяция `{{p0}}`. `npm run test:i18n` запрещает хардкод русского и JSX-текста. Скрипт `extract-i18n.cjs` — разовая миграция, повторно запускать НЕ нужно.

## Ограничения реального ядра

В UI есть notice. Историческая телеметрия, глобальный поток kernel events, обновление бинарников/marketplace и изменение роли существующего токена пока отсутствуют. Эти операции возвращают ошибку, не mock. Установка/перезапуск работает только для доверенных процессов в supervisor. Type — агрегатный opt-in сбор; не глобальный keylogger. См. `docs/core-api.md`.

## Проверки

```sh
npm test
npm run test:server
npm run test:i18n
npm run build
```

Токены не коммитить. Server admin credential необходим из-за admin-only управления исходного ядра, изолируйте backend и используйте TLS/VPN снаружи.

## Live/browser QA

After `delta/scripts/setup-local.mjs` on a disposable test node: `npm run test:e2e`. Install matching Chromium with `npm exec playwright install chromium --only-shell`; then `npm run test:first-login` and `npm run test:browser`. Tokens are read from runtime files outside repositories, never embedded in scripts. Full verification and limitations: `delta/docs/verification.md`.
