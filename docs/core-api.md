# Core and browser-host API

The shared frontend lives in `delta-ui`. Web retains the browser proxy and its server capabilities. The existing `CoreApi` adapter calls `web.*` capabilities through `POST /api/v1/call`; the proxy forwards to the selected core's `POST /v1/call`.

```json
{"capability":"web.info","args":{"_locale":"en"}}
```

Responses are `{ "ok": true, "result": ... }` or `{ "ok": false, "error": { "code": ..., "message": ... } }`. Authentication uses a Bearer credential or the Web session. Tokens never belong in URLs. The browser proxy forwards the user's credential, not the Web service's owner credential.

External components register with `POST /v1/components`, receive a session and long-poll `/v1/components/<id>/next`; invocation results go to `/result`. The UI polls node/plugin status; this is not a WebSocket event stream. Events, persistence and diagnostic coverage depend on the capabilities actually installed.

Metric queries use validated schemas, aggregation, dimensions and aligned previous-period comparisons. Missing intervals remain null rather than zero. Record limits cause explicit errors instead of silently truncated analytics. Storage timestamps use Unix milliseconds; core timestamps use Unix seconds; the projection layer handles conversion.

`metadata.ui` contains a versioned UI manifest. The shared UI validates compatibility and picks visualizations. The core does not depend on React or SQL. Plugin-specific settings, notices and actions remain declarative and are not hardcoded into the host.

Operations include plugin discovery and settings, node/peer information, scoped capabilities, supervisor controls, persistent dashboards, token management, trust setup, package installation and update jobs. Administrative operations require owner or explicitly granted administrative scopes. Peer routing also requires explicit trust on the destination; a local grant cannot bypass destination policy. Availability is determined by the running version/capability catalog, not by this document alone.

Native hosts use Host Bridge 1.0 with credential-private Rust calls. They must advertise actual features and must not pretend that the independent MCP, SSH or update services are available merely because the same UI package is bundled.
