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
