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

### Pending SSH wizard improvements (Unreleased)

The owner-only `web.nodes_ssh_preflight` checks the running local core and resolves OpenSSH to an absolute executable path before host probing or SSH authentication. An outdated core has a direct **Update core** action, with explicit confirmation and progress through the existing updater; readiness is rechecked after completion. Failed setup jobs are labelled as failed rather than still connecting. These source changes do not create a new runtime release.

### Restart-safe browser sessions (Unreleased)

Owner bootstrap cookies last 30 days. Signed key login offers **Remember this device for 30 days** (enabled by default); the lifetime is included in the signed challenge, never accepted as an unsigned login escalation. Core stores only the token hash, Web keeps the corresponding credential in its private server-side session file, and the browser receives an HttpOnly SameSite cookie. Private signing keys and recovery phrases are never persisted by this feature. Logout, token expiry and enrolled-key revocation remain effective. An old core without the signed remember extension is reported explicitly instead of promising restart-safe login.

Existing expired or ephemeral sessions cannot be recovered without authentication. Use an enrolled key or a fresh one-use installer owner link once, then use the new remembered session. Keep the same browser hostname and profile; clearing cookies/private browsing does not preserve login. A 401 now offers sign-in instead of reporting a lost core connection.

Regression: `DELTA_TEST_BINARY=/path/to/updated/delta npm run test:session-restart` starts isolated core/Web processes, signs in with a restricted key, closes all three processes including the browser, restarts using their saved state, verifies access and rejects privilege escalation and revoked keys. It does not reboot or modify the user's machine.
