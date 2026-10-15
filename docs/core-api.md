# Core API v2 — что ожидает консоль

Базовый URL задаётся в настройках (`/api/v1` по умолчанию в `.env.http`). Авторизация: `Authorization: Bearer <token>`.
Ошибки — JSON `{ code, message, hint? }`; статусы ≥500 и 429 считаются повторяемыми.

| Метод | Путь | Тело / ответ |
|---|---|---|
| GET | `/info` | `CoreInfo` |
| GET | `/plugins` | `RawPluginRecord[]` — `{ manifest: unknown, latest: unknown, instance: PluginInstance }` |
| GET | `/plugins/:id/logs?limit=` | `LogLine[]` |
| POST | `/plugins/:id/install` | `InstallRequest` → `PluginInstance` |
| POST | `/plugins/:id/update` | → `PluginInstance` |
| POST | `/plugins/:id/enable` · `/disable` | → `PluginInstance` |
| DELETE | `/plugins/:id?purge=bool` | — |
| PATCH | `/plugins/:id/settings` | `Record<string, unknown>` → `PluginInstance` |
| PUT | `/plugins/:id/permissions` | `{ scopes }` → `PluginInstance` |
| PUT | `/plugins/:id/nodes` | `{ nodeIds }` → `PluginInstance` |
| POST | `/plugins/:id/actions/:actionId` | → `CommandResult` |
| POST | `/metrics/query` | `MetricQuery` → `MetricResult` |
| GET | `/nodes` | `NodeInfo[]` |
| GET | `/nodes/:id/history?range=ms` | `{ cpu, mem, latency: Series }` |
| GET | `/nodes/:id/uptime?days=` | `UptimeCell[]` |
| POST | `/nodes/:id/commands` | `{ command: NodeCommandId, args? }` → `CommandResult` |
| PUT | `/nodes/:id/connection` | `ConnectionConfig` → `NodeInfo` |
| POST | `/nodes/pairing` | `{ kind, name }` → `PairingTicket` |
| DELETE | `/nodes/:id` | — |
| GET | `/events?severity=&source=&sourceId=&q=&limit=&before=` | `CoreEvent[]` (по убыванию времени) |
| GET | `/notifications` · POST `/notifications/mark` | `Notification[]` · `{ ids \| 'all', read }` |
| GET/PUT/DELETE | `/console/dashboards[/:id]` | `DashboardConfig` |
| GET | `/access/principals` · PATCH/DELETE `/access/principals/:id` | `Principal` |
| POST | `/access/tokens` | `{ name, role, scopes, ttlDays }` → `{ principal, secret }` |
| GET | `/access/audit?limit=` | `AuditEntry[]` |

## Realtime: `WS {base}/stream?token=`

Сообщения `RealtimeMessage` (JSON):

```ts
{ type: 'event', event: CoreEvent }
{ type: 'node.update', nodeId, patch: Partial<NodeInfo> }
{ type: 'plugin.update', pluginId }
{ type: 'notification', notification }
```

Адаптер сам публикует `{ type: 'connection', state }` и переподключается с экспоненциальной паузой (до 30 с).
Все типы — в `src/core/contracts` и `src/api/types.ts`; это источник истины для реализации ядра.
