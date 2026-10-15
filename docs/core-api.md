# Delta protocol v1

Предыдущая спецификация REST v2 заменена реальным API присланного ядра. UI → `POST /api/v1/call` (same-origin proxy) → ядро `POST /v1/call`:

```json
{"capability":"web.metrics_query","args":{"query":{"pluginId":"dev.delta.type","metricId":"wpm","range":{"preset":"24h"},"groupBy":"language"}}}
```

Ответы: `{ok:true,result:...}` или `{ok:false,error:{code,message}}`. Авторизация Bearer. Токены не помещаются в URL. Внешний bridge регистрируется `POST /v1/components`, получает session и опрашивает `/v1/components/web/next`, результаты передаёт в `/result`.

API UI сохранён как `CoreApi`, но транспорт теперь capabilities из `manifest.json`. Browser proxy использует пользовательский токен; server service token не отдаётся браузеру. Long-poll у плагинов; UI обновляет ноды/плагины каждые 15 с, WebSocket ядро не поддерживает. Сквозные сообщения событий/notifications пока не публикуются ядром автоматически.

Метрики: строгая схема запроса, max/min/avg/sum/last/p95/count, RU/EN фильтр, разбиение по измерениям, предыдущий период с выравниванием временной оси. Пустые интервалы = null; лимит 10000 records выдаёт явную ошибку, а не частичную аналитику. Время в storage — Unix ms, в ядре — Unix seconds; преобразование производится bridge.

`metadata.ui` внешнего компонента содержит UI manifest contract ^1.4.0. UI самостоятельно валидирует его и выбирает визуализации. Ядро не знает React/SQL.

Реальные операции: обнаружение плагинов, локальная/peer телеметрия, ping, supervisor start/stop/restart/remove/logs, typing settings/flush, токены create/revoke с TTL, pairing invite, приватные дашборды и аудит через storage. Управление supervisor/tokens admin-only в Delta v1. Глобальная история/обновление packages/роль существующего токена не поддержаны.
