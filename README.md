> Architecture: this repository is now the browser/server host. Shared screens and frontend tests live in [delta-ui](https://github.com/n-ycta/delta-ui), pinned to an immutable commit in package-lock.json. Sessions, MCP, SSH, update workers and server capabilities stay here. UI updates are currently bundled at host build time, not independently hot-swapped.

# Delta Web

**One control room for your Delta devices, plugins and data.** A separate React/TypeScript web plugin, connected to the core through its capability API.

![Delta overview](https://raw.githubusercontent.com/n-ycta/delta/main/docs/images/overview.png)

## Install

The installer checks for the node and installs it if missing. No Rust build is needed.

```sh
curl -fsSL https://raw.githubusercontent.com/n-ycta/delta-web/main/install.sh -o delta-web-install.sh
sh delta-web-install.sh
```

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/n-ycta/delta-web/main/install.ps1 -OutFile delta-web-install.ps1
.\delta-web-install.ps1
```

Open **http://127.0.0.1:7710**. Setup automatically opens a one-use owner session on desktop systems. Headless devices print an SSH tunnel instruction. Existing installations can reopen a setup session using the core installer with `--open` / `-Open`.

## Updates from the console

Open **Settings → Updates** to check and install stable official releases of the core, Web itself and installed managed plugins. Checks run hourly by default while the Web service is running, even with the browser closed. Available versions and completed/failed jobs appear in the notification center.

Automatic installation is **off by default**. Enabling it requires confirmation and saving the setting; core and plugin automation can be selected separately. Manual installation always asks for confirmation. Only a node owner can manage updates.

Updates use published checksums and pinned catalog versions. The core is updated first, ordinary plugins next, Web last. A separate local worker survives restarts; on a systemd installation it runs in a separate user unit. Disabled plugins stay disabled. A failed core health check restores the previous executable and checks the same node identity. Source builds or system-packaged core binaries are not overwritten. This is not a substitute for database backups before incompatible future migrations.

After updating Web, use **Reload console** to load its new interface. To get this update center from an older Web version, first update **Delta Web** on the existing Plugins page. Core 0.3.4 or later is required for pinned plugin updates and preserving disabled state; the update center can upgrade an officially installed older core first.

## Event journal

The Events page records **observed** core connectivity, peer availability, plugin/process state changes and successful/failed console management actions. It is not an OS-wide log or a claim that every command outside the console is captured. Observation and page refresh run every five seconds; Pause freezes page updates, Refresh explicitly fetches the latest records.

History is stored privately under the node profile (`data/events`), independent of the selected Storage backend, and retained for 30 days / 5,000 events. Existing caller audit history is also shown. Global lifecycle changes are visible to callers allowed to read events; private console-action history is visible only to that caller and the owner. Settings, token values, command arguments, process output and typing content are never included in event records.

## Explore

- Customizable home and saved dashboards, drag/resize widgets, comparisons, filters and multiple visualization types.
- Plugin discovery with schema/compatibility validation, GitHub installation jobs, scope review, screenshots carousel and remote-node selection.
- Node telemetry, supervisor processes/logs, explicit administrative commands and pairing wizard.
- EN/RU global switch and presentation-only manifest localization.
- HttpOnly browser sessions, public-key/seed login, scoped tokens and role previews.
- Multiple MCP gateways with independent secrets, tool allowlists and data restrictions.

The live adapter never forwards the service's administrative token as a browser user. The original user's bearer or server-side cookie session is used for API calls. The service token is used only after delegated permission checks.

## Plugin manifest localization

One canonical contract; no duplicated technical IDs:

```json
{
  "metadata": {
    "ui": {
      "id": "dev.example.plugin",
      "name": "Example",
      "defaultLocale": "en",
      "localizations": {
        "en": {"name": "Example", "description": "English description"},
        "ru": {"name": "Russian display name", "description": "Russian description"}
      },
      "screenshots": [
        {"url": "https://example.org/screen.png", "alt": "Dashboard", "locale": "en"}
      ]
    }
  }
}
```

Locale patches can change display fields only. Metrics/settings/options are matched by stable IDs or keys; versions, scope IDs, types and units cannot be overridden by translations. EN is the default; switching language reloads module-level labels consistently. UI catalogs live in `src/i18n/en.json` and `ru.json`. Runtime protocol errors are English with stable machine-readable codes.

## MCP gateways

In **MCP gateways**, select an Analytics/Operations preset or choose tools explicitly. Set plugin/node allowlists, maximum query days/rows and recursive redacted field names. The displayed client JSON contains a secret: save it privately. Each profile owns its own kernel token; revocation invalidates that token.

Endpoints: `POST /mcp/:profileId`, bearer authentication, stateless Streamable HTTP / JSON-RPC, protocol `2025-06-18`. Supports initialize, ping, notifications and tools. No SSE or resource subscription is required for this tool-only implementation. Use an MCP client supporting remote HTTP URL + headers; client-specific setup may vary. Only the published safe tool catalog is exposed. Redaction is structural, not a promise to scrub arbitrary log text.

## Development

Node.js 22.12+ (24 recommended):

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:server
npm run test:i18n
```

`VITE_CORE_MODE=mock` selects realistic isolated demo scenarios; the default is live `/api`. `npm start` serves the built UI and the external plugin bridge. The supervisor supplies `DELTA_URL` and an ephemeral token. `DATA_DIR` holds private session/MCP/catalog files. Set `PUBLIC_ORIGIN=https://your-console.example` and use a TLS proxy before exposing the console beyond loopback. Configure that origin in core `identity_origins` for key login.

Browser tests require a running local core and all source plugins; use the core's `scripts/setup-local.mjs` and untracked test credentials. Screenshots in the core README are real browser captures with generated QA aggregates.

**Current limits:** live polling rather than a system-wide event stream; system historical CPU/memory is not stored yet; plugin processes are not OS-sandboxed. The store accepts the official indexed publisher, not arbitrary pasted repository URLs. See [Delta setup/security](https://github.com/n-ycta/delta#security-and-access).

Licensed under [Apache 2.0](LICENSE). Third-party dependencies retain their own licenses.

### Chart presentation

Open a widget's menu → **Set up** → **3 · Display** to switch the same metric
between **Connected line**, **Dots**, **Area**, **Time histogram / bars**, and
**Step line**. The selected source, filters and aggregation stay unchanged.
Choose a per-widget time range and bucket interval (automatic, 1/5/15/30 minutes,
1/3/6 hours, a day or a week). Time bars show the source aggregation per time
bucket, not the frequency distribution of measured values.

Connected lines join observed values across empty buckets by default; the
**Connect across empty buckets** switch restores visible gaps. This only changes
the drawing: missing data is never replaced with zeros or fabricated values.
For long ranges, very fine intervals are coarsened to respect the 2,000-bucket
query limit. Presentation and cadence are saved with the dashboard.

## Plugin-owned notices and OS permission actions

A status endpoint may return notices with `id`, `severity`, `message`, localized strings and an optional `actionId`. The web console displays the action only if it is declared in the plugin manifest, uses the manifest description for dangerous-action confirmation, and forwards the caller's authority and UI `_locale`. It never authorizes a plugin using the web service's own administrator identity. The same generic renderer is used on plugin pages and related metric dashboards. OS-specific policy, security warnings and authorization state belong to the plugin, not to the web console.

The compact sidebar uses a centred 64px rail, 44px navigation targets, 20px navigation glyphs and a top-mounted expand button. Mobile navigation ignores the desktop collapse preference.

## 0.3 analytics widgets

Categorical `bubbles` is generic: circle area is proportional to count, top-N 1–50, coverage share and accessible table. It also supports table/bar/donut views; donut folds the omitted tail into Other. Plugin metrics may declare `queryCapability` in their own component namespace. The bridge delegates with caller authorization; plugin-private queries never inherit the Web service admin token. Type owns all word schemas, privacy notices and consent. Saved generated dashboards gain newly declared metrics without moving existing widgets.

Source activity uses plugin-published rates and explicit units (keystrokes/min vs records/min), not a decorative bar or unknown `/m`. Node CPU/memory/latency/availability are sampled every 15 seconds into storage source `dev.delta.web.node`, retained 90 days. Availability means observed checks, not guaranteed continuous uptime. Missing historical periods stay missing; history starts when the updated Web sampler runs.

## Connect a Linux VPS over SSH

Update the local core to **0.4.0+** and Web to **0.5.0+**, then open **Nodes → Add device**. Enter the server IP/hostname, SSH port and username, verify its host fingerprint, and choose password or private-key authentication. Encrypted private keys are supported. Select capability-only, computer-to-server administration, or equal administrative access in both directions. Administrative access requires explicit acknowledgement.

The wizard installs/reuses a bare Linux node, not another Web panel. Root setup configures an unprivileged delta service account and boot persistence; non-root setup requires an existing systemd user lingering configuration. A separate restricted key maintains a core-supervised bidirectional SSH tunnel. No router port forwarding or manually configured VPN is needed for a publicly reachable SSH VPS. Setup credentials are not saved. Use the local console or HTTPS, not a public plaintext Web URL.

The controller needs OpenSSH; the server must allow SSH TCP forwarding and must not force the reverse listener onto a public address. The wizard verifies its actual loopback binding before pairing. Completed connections survive closing Web and core restart. Incoming trust can be changed in **Node → Connection**; removing the node removes the local tunnel and private key. The initiating computer must be online. Invitation-based setup over an existing protected network remains available. See [the extension guide](docs/extending.md#ssh-server-onboarding) for limits, security and tests.
