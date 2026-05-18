## Project knowledge

This repository is a Grafana datasource plugin (`leoswing-comparequeries-datasource`) with backend support.

Before editing code, read this file first, then follow the build SOP in `.agents/skills/build-plugin.md`.

## Hard constraints

- Do not change plugin id/type in `src/plugin.json` (`id`, `type`).
- Treat `src/plugin.json` as a compatibility contract (`backend`, `alerting`, `mixed`, `dependencies.grafanaDependency`).
- Any `src/plugin.json` changes require Grafana restart to take effect.
- Keep `.config/` as tool-managed base configuration; do not make arbitrary edits there.
- Frontend build must use webpack config under `.config/webpack/webpack.config.ts`.
- Backend build must use mage targets from Grafana plugin SDK (`mage`, default `BuildAll`).
- Never commit secrets/tokens (for example `GRAFANA_ACCESS_POLICY_TOKEN`, `CHANGELOG_PAT`).

## Preferred execution order

1. Understand change scope from `README.md`, `src/README.md`, and `src/plugin.json`.
2. Implement changes in `src/` and/or `pkg/plugin/`.
3. Run local verification:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:ci`
   - `npm run build`
   - `mage`
4. For runtime checks:
   - single version: `npm run server`
   - matrix mode: `npm run server:matrix:up` (ports start from `3100`)
5. If `plugin.json` was edited, restart the target Grafana container(s).

## Agent entry files

- `AGENTS.md` is the source of truth.
- `CLAUDE.md` and `GEMINI.md` forward to this file.

## Skills

- Build/pack SOP: `.agents/skills/build-plugin.md`
- Artifact/runtime validation SOP: `.agents/skills/validate-plugin.md`
