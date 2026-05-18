# Build plugin

## Goal

Provide one deterministic build path for frontend + backend plugin artifacts.

## Steps

1. Verify Node/Go tools are available.

```bash
node -v
go version
```

2. Install dependencies (skip if already installed and unchanged).

```bash
npm install
```

3. Run quality gates in order.

```bash
npm run typecheck
npm run lint
npm run test:ci
```

4. Build frontend artifact.

```bash
npm run build
```

5. Build backend artifact (Mage default target = BuildAll).

```bash
mage
```

6. Optional runtime smoke check.

```bash
npm run server:matrix:up
npm run server:matrix:status
```

7. Optional cleanup.

```bash
npm run server:matrix:down
```

## Failure handling

- If `npm run build` fails, stop and report the exact webpack error.
- If `mage` fails, stop and report Go compile output.
- If matrix containers fail to start, report failing version/port mapping from `scripts/grafana-matrix.sh`.

## Notes

- `src/plugin.json` edits require Grafana restart to take effect.
- Release workflow uses `grafana/plugin-actions/build-plugin@main` with provenance attestation enabled.
