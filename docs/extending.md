# Расширение консоли

## Манифест плагина

Минимальный манифест (полная схема — `src/core/contracts/plugin.ts`, песочница — раздел «Контракты»):

```json
{
  "id": "dev.me.pomodoro",
  "name": "Помидоры",
  "version": "0.1.0",
  "contract": "^1.4.0",
  "publisher": "me",
  "description": "Фокус-сессии",
  "runtime": { "targets": ["desktop"] },
  "metrics": [{
    "id": "focus", "label": "Фокус", "kind": "duration", "unit": "s",
    "aggregations": ["sum"],
    "dimensions": [{ "id": "project", "label": "Проект", "values": [{ "id": "a", "label": "Работа" }] }],
    "visualizations": ["bar", "timeseries"]
  }],
  "settings": [{ "key": "length", "label": "Длина сессии", "type": "number", "default": 25, "unit": "мин" }]
}
```

- `kind`: `gauge | counter | ratio | duration | distribution | categorical | event` — определяет, какие виджеты подходят.
- `visualizations` — подсказки, а не требования. Неизвестные значения допускаются и отображаются в отчёте.
- `contract` — semver-диапазон версии контракта панели. Несовпадение мажорной версии блокирует установку.
- `settings` — консоль строит форму сама: `string | secret | number | boolean | select | multiselect`.
- `permissions` — области данных, которые пользователь подтверждает при установке; `required: false` можно снять.

## Новый тип виджета

```ts
// src/widgets/registry.ts
widgetRegistry.register({
  type: 'sankey', version: '1.0.0', label: 'Потоки', icon: 'waypoints', category: 'metric',
  description: 'Потоки между категориями', aliases: ['flow'],
  // score 0 = не подходит; reason показывается в редакторе виджета
  accepts: (m) => (m.kind === 'categorical' && m.dimensions.length >= 2 ? { score: 70 } : { score: 0, reason: 'нужно ≥2 измерения' }),
  defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
  options: ['legend', 'palette'],
  component: SankeyWidget,      // получает { config, ctx } — см. src/widgets/types.ts
  migrate: (cfg, from) => cfg,  // вызывается для конфигов с меньшей мажорной версией
});
```

После регистрации тип автоматически:
- участвует в ранжировании для метрик и появляется в редакторе виджета;
- считается «известной визуализацией» при валидации манифестов (`geo-map` перестанет быть предупреждением, если зарегистрировать его);
- получает обработку версий: конфиг новее мажорной версии → «несовместим», старее и есть `migrate` → «мигрирован».

Данные виджет получает через `<MetricData cfg ctx>` (`src/widgets/shared.tsx`) — загрузка, ошибки, пустые состояния и повтор уже обработаны.

## Новый адаптер ядра

Реализуйте `CoreApi` (`src/api/types.ts`) и верните его из `createCoreApi`. UI не нужно менять.


## Plugin-owned diagnostics and sensitive setting confirmations

A manifest may declare `endpoints: {status: "component.status", settings: "component.settings"}`. Endpoints must stay within that component's namespace. The read-only status endpoint returns sanitized `settings` (never secret values) and optional `notices: [{id, severity: "info"|"warn"|"err", message, localizations: {ru: "..."}}]`. The console displays notices on the plugin page and dashboards using its metrics; it does not decide plugin security policy. Status/settings operate on the installed node. Capability descriptions may include source-owned `localizations[locale].description`.

A boolean setting can include `confirmation: {id, title, body, acceptLabel}` and localized presentation fields. Switching it on opens the generic confirmation dialog. Accepted IDs are submitted under `_confirmations`. **The plugin must enforce acknowledgement itself** for API/CLI clients; web UI alone is not a security boundary. Confirmation IDs and policy cannot be translated or replaced by presentation patches.

Metrics can specify `defaultFilters` to keep distinct data modes separate in newly generated widgets. Existing saved widgets keep their filters; edit them explicitly if they should select a new mode. Plugin status refreshes every ten seconds without resetting unchanged/unsaved settings.

Native selects retain theme-aware options as a fallback; supporting browsers use `appearance: base-select` for styled pickers. Native popups on older browsers remain OS-dependent.

## SSH server onboarding

Nodes → Add device opens an SSH wizard; invitation-based installation over an existing protected network remains available. Owner-only `web.nodes_ssh_probe/install/status` endpoints never accept peer-admin or narrowly delegated SSH authority. The probe creates a five-minute target-bound single-use ticket. The owner must verify the SSH host fingerprint out of band. Passwords/private setup keys/passphrases remain in memory only. Web rejects credential submission when served on a public plaintext origin; use HTTPS with PUBLIC_ORIGIN configured or a localhost tunnel.

The asynchronous job provisions a bare Linux node, installs a separate restricted forwarding key, and registers an OpenSSH command with the core supervisor. No Web or Storage is installed on the server. Core APIs own invitations, per-relationship callback addresses, directional grants and revocation. The shell-free local argv pins the server host key, ignores user SSH configuration, disables agent/X11 forwarding, and binds both forwards to loopback. The setup SSH session is closed on completion; the persisted tunnel uses its own key, not the login credential. Windows controller profiles use private user/SYSTEM ACLs. A Linux VPS is the supported deployment target in this version, not Windows SSH server deployment.

Jobs expose sanitized phase/error codes and resume visibility after browser refresh. Interrupted Web setup is marked failed on restart and its local access/tunnel is cleaned up where reachable; it is not silently resumed with saved passwords. A completed connection survives closing/restarting Web and restarting the core. Nodes → Connection allows changing incoming administrative trust with explicit confirmation before elevation. Removing a node tears down its local tunnel and private key. Public-key residue on the server is described in the core operations guide.

Tests: `npm run test:server` covers authorization, consent, target binding, job redaction and transport arguments. `DELTA_TEST_BINARY=/path/to/new/delta node tests/ssh-onboarding-live.mjs` exercises real password/encrypted-key SSH bootstrap, two real cores, both routing directions, one-way/mutual administration, downgrade, core restart without Web and removal. The test uses a preinstalled isolated server fixture; it does not pretend to validate Linux package installation or real provider SSH policy.

### SSH wizard preflight and updates (v0.5.1)

The owner-only `web.nodes_ssh_preflight` checks the running local core and resolves OpenSSH to an absolute executable path before host probing or SSH authentication. An outdated core has a direct **Update core** action, with explicit confirmation and progress through the existing updater; readiness is rechecked after completion. Failed setup jobs are labelled as failed rather than still connecting. These changes are included in v0.5.1.

### Restart-safe browser sessions (v0.5.1)

Owner bootstrap cookies last 30 days. Signed key login offers **Remember this device for 30 days** (enabled by default); the lifetime is included in the signed challenge, never accepted as an unsigned login escalation. Core stores only the token hash, Web keeps the corresponding credential in its private server-side session file, and the browser receives an HttpOnly SameSite cookie. Private signing keys and recovery phrases are never persisted by this feature. Logout, token expiry and enrolled-key revocation remain effective. An old core without the signed remember extension is reported explicitly instead of promising restart-safe login.

Existing expired or ephemeral sessions cannot be recovered without authentication. Use an enrolled key or a fresh one-use installer owner link once, then use the new remembered session. Keep the same browser hostname and profile; clearing cookies/private browsing does not preserve login. A 401 now offers sign-in instead of reporting a lost core connection.

Regression: `DELTA_TEST_BINARY=/path/to/updated/delta npm run test:session-restart` starts isolated core/Web processes, signs in with a restricted key, closes all three processes including the browser, restarts using their saved state, verifies access and rejects privilege escalation and revoked keys. It does not reboot or modify the user's machine.

## Generic plugin input/output (console 0.6.0, contract 1.5)

The console knows no business-specific plugin IDs. Plugins can declare:

```json
{
  "contract": "^1.5.0",
  "actions": [{"id":"preview","label":"Preview","inputs":[{"key":"text","label":"Text","type":"string","multiline":true,"default":""}]}],
  "views": [{"id":"items","label":"Records","capability":"example.items","refreshSec":30,"inputs":[{"key":"search","label":"Search","type":"string","default":""}],"columns":[{"key":"title","label":"Title","type":"link","urlKey":"url"},{"key":"createdAt","label":"Created","type":"datetime"}]}],
  "endpoints": {"notifications":"example.notifications"}
}
```

- Actions receive their typed field values and `_locale` through `web.plugins_action`. The generic form and result modal display inputs and JSON output. Never put secrets in action output. `dangerous` actions still require confirmation.
- A view receives `{...inputs,offset,limit,_locale}` through `web.plugins_query` and must return `{rows:object[],total:number}` (at most 100 rows, 2 MB). Plugins implement filtering, ordering and pagination. Column types are `text`, `number`, `datetime` (Unix milliseconds), `badge`, and `link` (HTTPS only). An optional column `width` (80–600 px) controls readable minimum width. Text is React-escaped; plugin HTML/JavaScript is never executed. Tables scroll inside their container on small screens.
- Each declared endpoint must be inside its component namespace. Actions/views target an installed node. Every call preserves the user's capability/admin scope; the service token cannot grant extra rights.
- A notification feed returns up to 100 `{id,ts,severity,title,body?}` items. Reads require the caller's permission for that feed; unavailable/unauthorized feeds are isolated. IDs are namespaced by plugin and node, links are forced to the plugin page, and read/unread state is stored per console principal.
- Sanitized settings may include `_configuredSecrets: ["apiKey"]` to show saved state without returning values. Untouched secret fields are omitted on save; the generic clear button sends an explicit empty string. Plugins remain responsible for validating and privately persisting settings.
- Declare `contract: "^1.5.0"` when these views are required, so older consoles show incompatibility instead of silently hiding the UI.

## Generic settings profiles and validation (console 0.6.1)

Optional UI metadata `settingsProfiles: {selectionKey, protectedKeys, items:[{id,label,values}]}` supplies composable patches for existing non-secret settings only. `selectionKey` names a declared multiselect field. String values merge as stable deduplicated lines, arrays as stable unions; scalars use declaration order. Protect sensitive custom text keys (such as a user prompt) with protectedKeys. The form previews old/new values per field, preserves customized fields by default, and never saves until the user clicks Save. Profiles cannot set secret fields. Localize item labels through the normal presentation-only localization patch. Do not embed credentials in a manifest.

An action with `settingsAction:true` is available in Settings and receives `{values: currentDraft, _locale}` without automatically saving it. Omitted secrets preserve stored credentials; explicitly cleared secrets are empty strings. Validate and bound every input server-side. Return safe structured results, not response bodies or credentials. Validation and message delivery should be separate actions. The generic result renderer displays structured JSON safely.

`web.plugins_settings` allows omitted values for a selected-node read. It delegates with the same administrative checks as writes but does not emit a settings-saved audit event for a read. `web.metrics_query` accepts optional query.nodeId; absent a target, the first active installed node wins. The physical machine hosting Web and the node on which a capability is registered are distinct concepts. Paired administrative calls require explicit incoming trust on the receiving peer; Web never changes trust automatically.

MCP catalogs include curated core tools and namespaced methods belonging to registered UI plugins. Capability params become JSON input schemas, including nested objects. Owners explicitly select methods; admin methods receive individual admin:method scopes, never global admin. Profile creation pins plugin ownership, and calls revalidate availability, target node and permissions. Existing profiles are not automatically broadened when a plugin gains methods: refresh the catalog and create a new explicitly scoped profile. Field redaction is not a safe substitute for withholding access to arbitrary logs.

Destructive settings actions remain in the confirmed action menu rather than the inline draft-validation toolbar.
