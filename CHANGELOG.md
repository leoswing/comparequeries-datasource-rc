# 2.1.0 (2026-04-28)

### Features and enhancements

- **Grafana 13+ compatibility (non-breaking)** — the QueryEditor now operates in three modes driven by the query data shape:
  - **Self-contained** (recommended) — pick a Target Datasource and the plugin embeds its **native** query editor (PromQL autocomplete, ES bucket aggs, LogQL, SQL, etc.). Works on any panel datasource, no `-- Mixed --` requirement, and is required for Grafana Alerting.
  - **Legacy refId reference** (backward compatible) — pre-Grafana 13 / Mixed-panel dashboards keep working untouched. Old queries that only have a `query` (refId) field auto-fall into this mode.
  - **Empty** — friendly onboarding hint for brand-new queries.
- **One-click Migrate button** in legacy mode — swaps refId reference for a chosen Target Datasource while preserving timeShifts, alias settings and Process TimeShift.
- **Backend `_runSelfContained` flow** — each target carries its own `datasourceUid` + `targetQueryJSON` and produces N frames per timeShift entry (empty Amount = base series). The legacy `_compareQuery` path is untouched.
- **Embedded native editor fallback** — datasources without a contributed `QueryEditor` component still work via a raw JSON textarea.

### Notes

- `query` (refId reference) is marked `@deprecated` in the schema but **fully supported at runtime** for backward compatibility. Dashboards from 2.0.x require zero migration to upgrade.

# 2.0.2 (2024-07-10)

## Bug fixes

- Fix `Amount` field validation issue when using with variable inside

# 2.0.1 (2024-07-04)

### Features and enhancements

- Add validation for amount input field
- Sign plugin in Grafana plugin market, [plugin details](https://grafana.com/grafana/plugins/leoswing-comparequeries-datasource/)
- Add plugin sign github action config

# 2.0.0 (2024-06-25)

### Breaking change

- Refactor the plugin id with `leoswing-comparequeries-datasource`, and signed with public signature level in Grafana.
- Repo name refactor to `comparequeries-datasource-rc`
- Package.json name refactor to `leoswing-comparequeries-datasource`
- Release workflow publish the zip name to formate `${{ env.NAME }}-${{ env.TAG }}.zip`

# 1.2.0 (2024-06-24)

### Features and enhancements

- Upgrade QueryEditor data binding logics from query property

### Bug fixes

- Fix QueryEditor data model timeShifts lost when refresh issue [#2](https://github.com/leoswing/comparequeries-datasource-rc/issues/2)

# 1.1.0 (2024-06-20)

### Features and enhancements

- Suit with Grafana 11, remove filterQuery method as it should migrate, see [PR](https://github.com/leoswing/comparequeries-datasource-rc/pull/1)

# 1.0.0 (2024-06-18)

Restructure repo with React based framework support.

### Features and enhancements

- Restructure codebase with React-based, which could refer to the [tutorial](https://grafana.com/developers/plugin-tools/tutorials/build-a-data-source-plugin)
- Add alias name as displayName support.
- `QueryEditor` with React jsx and models supprt.
- Use `getDataSourceSrv()` and `getTemplateSrv()` import from `'@grafana/runtime'` to fetch dataSourceSrv and templateSrv
- Remove `MutableField` 和 `ArrayVector` from datasource, and refactor with `Field` and `Array` support.

### Bug fixes

- Solve data point undefined issue when no database is selected.