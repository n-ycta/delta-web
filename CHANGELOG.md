# Changelog

## Release policy

- Collect compatible fixes in **Unreleased**; do not publish a separate release for every small commit.
- Publish tested, meaningful batches only after explicit maintainer approval.
- Before tagging, move the reviewed changes into a version section below. Release workflows require that section.
- Historical patch releases have been consolidated into the next retained release. Git tags remain available for source history and comparison links.

## [Unreleased]

- Improve release documentation and changelog-backed release publishing; no new runtime release is created for this maintenance change.

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

