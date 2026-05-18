# Validate plugin

## Goal

Validate plugin output after code/build changes before release.

## Steps

1. Build artifacts first.

```bash
npm run build
mage
```

2. Run local matrix runtime validation (Grafana 11/12/13 by default ports 3100+).

```bash
npm run server:matrix:up
npm run server:matrix:status
```

3. Manual smoke checks per target Grafana version.

- Open `http://localhost:3100`, `http://localhost:3101`, `http://localhost:3102`.
- Verify datasource `CompareQueries` is discoverable in Connections.
- Verify one Mixed panel query with `CompareQueries` + target datasource executes.
- If applicable, verify alert rule query path still works in backend mode.

4. Stop matrix environment when finished.

```bash
npm run server:matrix:down
```

## Release-path validation notes

- Release workflow (`.github/workflows/release.yaml`) builds/signs with `grafana/plugin-actions/build-plugin@main`.
- Provenance attestation is enabled (`attestation: true` with `id-token` and `attestations` permissions).
- Do not attempt release without configured secrets:
  - `GRAFANA_ACCESS_POLICY_TOKEN`
  - `CHANGELOG_PAT`

## Failure handling

- If a single version fails to load plugin, collect that version's container logs and report port/version mapping.
- If datasource is missing from UI, confirm `dist/` was rebuilt and container restarted.
- If only alerting path fails, check backend binary build (`mage`) and datasource auth settings.
