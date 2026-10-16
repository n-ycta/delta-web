# Changelog

## [v0.6.6]

### Improvements
- Move MCP, update scheduling, SSH provisioning, telemetry and the durable event journal into four independent headless plugins.
- Retain Web API aliases and MCP URL forwarding as compatibility adapters; Web no longer starts those background services.
- Consume shared Delta UI 0.1.1 with optional dependency selection, version diagnostics and generic capability/feature gates.
- Forward service calls with the original principal through Core, never with Web's administrative credential.

### Upgrade notes
- Upgrade Core to 0.4.3 before this Web version. Install the optional service plugins for their corresponding functions; missing services do not block unrelated Web features.
- MCP profiles migrate only after legacy Web is stopped or upgraded. Keep a private profile backup before the cutover. The default independent listener is localhost:7720; existing Web `/mcp/:id` addresses are proxied.
- Existing owner keys work. Narrowly scoped compatibility keys may need explicit destination-service scopes. Dependency installation is ordered, not an atomic group rollback.
- Native hosts and independent signed UI updates remain incomplete; this release does not close all P0/P1 requirements.

## [v0.6.5]

### Improvements
- Browser host consumes the immutable shared `@delta/ui` package. Pages, dashboards, translations, styles and client logic are maintained in `delta-ui`, not copied into each host.
- Existing sessions, MCP, SSH onboarding, updater, telemetry and server capabilities remain in Web with unchanged compatibility.

### Upgrade notes
- This stage bundles the verified UI at build time. Independent signed UI activation/rollback is not yet enabled. Desktop/Android support is experimental and does not imply full Web service parity.

## [v0.6.4]

- Owner-authorized updates of paired-node cores through an independent target-node maintenance worker. Official version and SHA-256 pinning, target identity checks, restart health verification and existing rollback protections; no remote file replacement from the browser. Automatic remote core updates require a new, separate opt-in.
- Shared dashboard eligibility/counting keeps sidebar counts consistent with user and plugin dashboards, without counting saved generated layouts twice. Supervisor-only maintenance/SSH processes no longer appear as installed plugins.
- Full-width settings, right-aligned switches, wrapping action headers and viewport-bounded controls across settings, nodes, events and contracts. Fixed an undefined border token; compact RU/EN actions.
- Regression coverage includes two-node core restart/update, owner-only maintenance APIs, responsive layouts and dashboard classification.

## [v0.6.3]

- Compact table refresh: an accessible icon in the widget header beside the menu, with no separate action row. Plugin-page view panels use the same icon-only refresh control.
- Manual record refresh reuses in-flight requests instead of launching duplicate requests.
- Includes the contract 1.6, conditional settings, record tables and node-aware updater introduced in v0.6.2.

## [v0.6.2]

- UI contract 1.6: bounded declarative settings branches (`visibleWhen`, nested all/any/not). Irrelevant controls and empty groups are hidden without clearing saved values or transmitting hidden draft edits.
- Extend the existing Table widget with typed plugin record sources, safe clickable HTTPS post links, node selection, pagination and refresh. No new widget type or Leads-specific runtime code.
- Auto-generate opt-in record tables from plugin views; append missing tables to saved plugin dashboards without resetting layouts or changing metric widget IDs.
- Discover updates across the local profile, the service-connected core and paired nodes. Preserve separate installation identities; show unknown/unmanaged/offline installations and partial-discovery warnings rather than silently omitting plugins.
- Route pinned package installations and job polling to the selected node. Use catalog repository links, preserve disabled installs, and never replace a remote core with local files. Automatic installation still requires separate consent.
- RU/EN regression tests for links, branches, layouts, persistent delivery integration and multi-node updates.

## [v0.6.1]

- Route plugin metrics to an active installed node, including paired remote nodes; an inactive local installation no longer masks an active remote one. Use live remote manifest versions instead of stale cached schemas.
- Full-width schema-driven settings, bounded multiline controls, compact icon-only secret clearing, themed expansion editor and viewport-safe modal scrolling/animation.
- Generic composable settings profiles with per-field merge preview and protected custom prompt fields; no plugin IDs or business logic in the console.
- Generic draft-aware validation actions and structured results; reading selected-node settings is no longer incorrectly recorded as a save.
- Dynamic MCP discovery for registered plugin capabilities and nested parameter schemas; explicit scoped admin grants, plugin ownership pinning, node checks and revocation remain enforced.
- Saved generated dashboards stay in Plugin dashboards, while intentional user copies remain in Mine. Saved layouts are retained.
- RU/EN labels and 135 automated tests, plus live two-node transport/MCP and desktop/mobile browser regressions.

## [v0.6.0]

- UI contract 1.5: generic paginated plugin data views, typed action input forms and result output.
- Capability-delegated plugin notification feeds with safe links and per-principal read state.
- Generic configured-secret indicators and explicit clear; saved markers are never resent as secrets.
- Installed-node routing and authorization checks for plugin views/actions. No plugin-specific integration code.


## Release policy

- Collect compatible fixes in **Unreleased**; do not publish a separate release for every small commit.
- Publish tested, meaningful batches only after explicit maintainer approval.
- Before tagging, move the reviewed changes into a version section below. Release workflows require that section.
- Historical patch releases have been consolidated into the next retained release. Git tags remain available for source history and comparison links.

## [Unreleased]

- No pending changes.

## [v0.5.1]

### Fixes
- Keep owner setup sessions for 30 days and restore valid sessions after Web restarts.
- Show an explicit sign-in action for expired authorization instead of a misleading reconnect loop.
- Clear stale manually entered browser tokens after successful key sign-in.
- Label failed SSH setup jobs as failed rather than suggesting installation is still running.

### Improvements
- Add Remember this device for 30 days to signed key login; private signing keys and recovery phrases remain browser-only.
- Check the running core and OpenSSH before requesting SSH credentials.
- Offer a direct, confirmed core update from the SSH wizard, with progress and an automatic readiness recheck.
- Resolve OpenSSH to its absolute executable path, including standard Linux and Windows locations.

### Upgrade notes
- Update Delta Core to v0.4.1 for restart-safe signed login. Existing expired sessions require one fresh sign-in.
- SSH server deployment is still Linux-only. This patch does not change existing peer trust grants.

## [v0.5.0]

### Features
- Nodes → Add device now includes a Linux VPS installation wizard over SSH with IP/hostname, port and username.
- Authenticate with a password or private key, including encrypted-key passphrases.
- Verify the server fingerprint before authentication and choose capability-only, computer-to-server or mutual administrative trust.
- Provision a bare, unprivileged server node without installing Web or Storage.
- Keep a bidirectional encrypted SSH tunnel under core supervision, independent of the browser and completed Web setup.
- View connection progress and manage incoming administrative trust from the node connection page.

### Security
- Owner-only SSH operations; peer administrators and narrowly delegated tokens cannot submit setup credentials.
- Target-bound, expiring, single-use fingerprint approvals and explicit administrative consent.
- Never persist setup passwords, uploaded private keys or passphrases in jobs or browser storage.
- Create a separate private forwarding key with strict host-key pinning, disabled shell/agent/X11 access and loopback-only forwards.
- Reject public plaintext Web credential submission; use HTTPS or a localhost tunnel.
- Remove the local tunnel and its private key when disconnecting the peer.

### Improvements
- Localized Russian/English setup phases, errors and trust controls.
- Responsive desktop/mobile wizard and safe interruption handling.
- Preserve invitation-based installation over an existing protected network.

### Requirements and Limits
- Delta Core 0.4.0 or newer on both nodes; the wizard installs/updates the remote core from verified official releases.
- OpenSSH client on the controlling computer; Linux server with systemd user services and SSH forwarding allowed.
- Root bootstrap configures an unprivileged service account; non-root bootstrap requires user lingering.
- Windows SSH-server provisioning is not included. Controller Windows checks cover build/unit tests, not a real Windows-to-VPS session.
- An inert restricted public-key entry can remain on the server after disconnection; its private key is removed locally.

### Validation
- Real two-core tests through OpenSSH cover password/encrypted-key setup, both routing directions, trust downgrade, core restart without Web and removal.
- Browser tests cover consent gating, desktop/mobile layout and absence of persisted login credentials.
- Verified the real Debian 12 VPS bootstrap/update, restricted OpenSSH key, private reverse listener, both routing directions and removal of temporary test access.

## [v0.4.1]

Includes changes from v0.4.0 through v0.4.1.

### Features
- Unified Settings → Updates for the core, installed plugins and Web itself.
- Hourly background checks, persistent update notifications and explicit opt-in automatic installation.
- Independent installation worker with core-first/plugin-next/Web-last ordering and progress/reload controls.
- Persistent journal for observed lifecycle changes and successful/failed console actions.
- Events auto-refresh every five seconds with pause/resume, search, filters and JSON export.

### Improvements
- Preserve disabled plugins and roll back the core executable when its health/identity check fails.
- Retain event history across Web restarts without requiring a configured Storage backend.
- Improve desktop/mobile update settings, event rows and readable action messages.

### Bug Fixes
- Compare semantic versions correctly instead of offering downgrades as updates.
- Identify Windows core binaries across short/long executable path aliases.
- Replace the unwritten event namespace that left Events permanently empty.
- Display event-fetch failures instead of a misleading healthy indicator.
- Search codes/source IDs/labels and localized messages; avoid success wording for failed actions.

### Security
- Restrict updates to the owner and validate official download origins, checksums and selected package versions.
- Do not overwrite source-built or system-packaged core binaries.
- Limit private action history to its caller and the owner; omit credentials/settings/command arguments/process output/typing content.

### Notes
- Checks continue with the browser closed while Web runs. Automatic installation is off until explicitly enabled; checked plugin updates require core v0.3.4 or later.
- Events describe observed lifecycle changes and console actions, not every OS event or external command. The local journal retains up to 30 days / 5,000 events; existing caller audit history is also shown.
- Executable rollback does not replace backups before future incompatible data migrations.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Full Changelog:** https://github.com/n-ycta/delta-web/compare/v0.3.4...v0.4.1

## [v0.3.4]

Includes changes from v0.3.0 through v0.3.4.

### Features
- Word-frequency bubbles sized by count, with table, bar and pie/donut alternatives.
- Producer-owned metric queries with dynamic word/language dimensions.
- Observed node CPU, memory, latency and availability history through Storage.
- Dismissible plugin notices with account/node/content-aware persistence and a restore control.

### Improvements
- Show real activity units/last-sync information and readable metric dimension labels.
- Remove generated-from-contract banners and keep widget icons fixed while descriptions wrap.
- Refresh widget previews from the current unsaved selection and improve keyboard/mobile notice controls.

### Bug Fixes
- Replace unavailable node history with persisted observations without fabricating missing telemetry.
- Align root/UI manifests, package and lockfile versions to fix installer verification.
- Prevent editor source text from overflowing and keep generated widget identities stable during polling.
- Forward the UI locale to plugin settings validation.
- Do not redisplay unchanged dismissed banners after every reload or alter plugin consent/settings when dismissing them.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Full Changelog:** https://github.com/n-ycta/delta-web/compare/v0.2.7...v0.3.4

## [v0.2.7]

Includes changes from v0.2.0 through v0.2.7.

### Features
- Web console for dashboards, plugins, nodes, access keys, key sessions and scoped MCP gateways.
- Real Delta capability integration, plugin-provided metric contracts and English/Russian presentation.
- Official verified plugin installation and generic plugin-owned settings/security notices.
- Connected-line/dots chart options with configurable time buckets and gap handling.
- Plugin-owned authorization actions rendered from notices and plugin details.

### Improvements
- Publish actionable MCP schemas for nested metric/storage queries and restricted target nodes.
- Use themed keyboard-accessible controls, readable settings spacing and a fixed-size profile silhouette.
- Persist service-notice dismissal and expose its visibility in interface settings.
- Preserve chart settings/default metric filters and forward the interface locale to plugin actions.

### Bug Fixes
- Allow initial local owner sign-in and keep metadata for disabled plugins.
- Render sparse metric comparisons and distinguish missing activity from real zero values.
- Fix stretched avatars, inconsistent dropdown appearance and default filters in generated widgets.
- Center compact-sidebar icons, correctly place the collapse control and improve mobile navigation.

### Security
- Keep browser credentials session-scoped and reflect authenticated roles.
- Enforce MCP plugin policies for component operations and filter restricted listings.
- Check destination capability administration rules; call:* no longer grants privileged delegated operations.
- Update frontend dependencies to address known advisories.

### Installation
- Requires Delta 0.3 and Node.js 22.12 or later. Use the official plugin catalog for current installations; verify manually downloaded assets against `SHA256SUMS`.

**Source:** https://github.com/n-ycta/delta-web/tree/v0.2.7

