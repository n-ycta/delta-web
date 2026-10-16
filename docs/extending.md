# Extending the shared interface

Screen, widget and UI contract implementations now live in [delta-ui](https://github.com/n-ycta/delta-ui). Web owns browser hosting and server services. Do not add another copy of a screen to Web or a native host.

## Declarative plugin manifests

See `delta-ui/src/core/contracts/plugin.ts` for the current schema and the Contracts page for validation. A plugin declares metrics, settings, views and actions; the host renders them generically.

```json
{
  "id": "dev.example.focus",
  "name": "Focus",
  "version": "0.1.0",
  "contract": "^1.6.0",
  "description": "Focus sessions",
  "metrics": [{"id":"focus","label":"Focus time","kind":"duration","unit":"s","visualizations":["timeseries"]}],
  "settings": [{"key":"length","label":"Session length","type":"number","default":25,"unit":"min"}]
}
```

This is a partial schema illustration, not an independently installable manifest; required publisher, runtime, permission and endpoint declarations must also be supplied according to the current contract.

- Metric `kind` controls eligible visualizations. Visualization hints are not imperative UI code.
- `contract` is a semantic version range; incompatible major versions prevent activation.
- Settings are typed and may use declarative visibility branches. Hidden values are retained, not implicitly reset.
- Permissions require explicit user grants. Installation alone does not authorize sensitive data access.
- Plugin views can back the existing Table widget, including typed and validated links.

## Widgets

Register widget types in `delta-ui/src/widgets/registry.ts`. Each type supplies metadata, compatibility scoring, defaults, a component and optional configuration migration. Unknown visualizations remain visible in validation diagnostics rather than running arbitrary code. Use the shared data/query primitives for loading, empty states, errors and retry.

## Transports and native hosts

Implement the shared `CoreApi` boundary or the versioned Host Bridge adapter. Do not expose owner tokens, unrestricted file paths or shell commands to plugin UI frames. The initial native previews disable plugin frames until isolation is integrated. The standalone SDK broker is not proof of a complete app/workspace implementation.
