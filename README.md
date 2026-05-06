[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)

# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

[![License](https://img.shields.io/github/license/leoswing/comparequeries-datasource-rc)](LICENSE)
![Drone](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/release.yaml/badge.svg)

Key features:

- Compatible with Grafana 11, 12, **and 13+** (no `-- Mixed --` panel datasource required)
- Embeds the **native query editor** of any installed datasource (PromQL autocomplete, ES bucket aggs, LogQL, SQL, etc.) — no more hand-writing JSON
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Caches datasource query results to reduce repeated queries when conditions remain the same.
- **Supports Grafana Alerting** via a backend plugin that proxies time-shifted queries to target datasources
- **Backward compatible** — pre-Grafana 13 dashboards using the legacy Mixed + refId reference flow continue to work without migration

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)

## Contents

- [Quick start (3 steps)](#quick-start-3-steps)
- [Query modes](#query-modes)
- [Migration guide (2.0.x -> 2.1.0)](#migration-guide-20x--210)
- [Grafana alerting](#grafana-alerting)
- [Contributing](#contributing)


# Compatibility notes (2.1.0)

- Plugin id is `leoswing-comparequeries-datasource` and uses signature verification.
- Grafana 13+ with **legacy refId mode**: this mode works only when panel datasource is `-- Mixed --`.
- Grafana 13+ non-Mixed panels should use **self-contained mode** (`datasourceUid` + `targetQueryJSON`).
- Grafana Alerting support is a **new capability** in 2.1.0 (backend execution), not a breaking change.


# Download

You can download and install this grafana plugin using various options:

- From [Grafana plugin catalog](https://grafana.com/grafana/plugins/leoswing-comparequeries-datasource/)
- From [Github release page](https://github.com/leoswing/comparequeries-datasource-rc/releases)
- Using grafana cli

   `grafana-cli plugins install leoswing-comparequeries-datasource`

- Using docker

    `docker run -p 3000:3000 -e "GF_INSTALL_PLUGINS=leoswing-comparequeries-datasource" grafana/grafana:latest`


For detailed instructions on how to install the plugin on Grafana Cloud or locally, please check out the [Plugin installation docs](https://grafana.com/docs/grafana/latest/administration/plugin-management/).


# Quick start (3 steps)

For most users, this is all you need:

1. Configure datasource authentication in **Connections -> Data sources** (default `No Authentication`).
2. In panel QueryEditor, pick **Target Datasource** and build query in the embedded native editor.
3. Add **Time-shift** rows (`1d`, `1w`, etc.), then save panel / alert rule.

Need legacy `-- Mixed --` compatibility or upgrade details? See the sections below.

## Query modes

The QueryEditor can be in three states based on how the query is configured:

## 1. Standard mode (recommended)

Use this for new dashboards. It works on **any panel datasource** (no need to switch to `-- Mixed --`) and is the **only** mode that supports Grafana Alerting.

1. Add the **CompareQueries** datasource to a panel.
2. In the QueryEditor, pick a **Target Datasource** (Prometheus, Elasticsearch, Loki, …). The plugin embeds that datasource's **native** query editor right inline — you get the same UX as building the query directly on the source (PromQL autocomplete, ES bucket aggs, LogQL builder, SQL, etc.).
3. Build the query as usual.
4. Add one or more **Time-shift** rows. An empty `Amount` means **no shift** (base series); `1d`, `1w`, etc. shift back in time.
5. Optionally toggle **Process TimeShift** to align timestamps of shifted series with the current window.

The plugin runs the embedded query once per Time-shift row, applies the alias rules, and merges everything into a single result.

## 2. Legacy Mixed mode (backward compatible)

Pre-2.1 dashboards used this mode: the panel datasource is `-- Mixed --`, one query (e.g. `refId: A`) carries the real Elasticsearch / Prometheus query, and a sibling **CompareQueries** row with `Reference Query refId: A` time-shifts that result.

These dashboards keep working as-is after upgrade. The QueryEditor auto-detects them and shows the legacy form **plus** a one-click **Migrate to Target Datasource** button:

- Migration **preserves** all Time-shift rows, alias type, delimiter and Process TimeShift settings.
- After migration you re-build the query in the embedded native editor (the QueryEditor API doesn't expose sibling targets, so the payload can't be auto-cloned).
- Migrating lets you change the panel datasource away from `-- Mixed --`.

> **Why migrate?** Grafana 13's Scenes architecture forces every target in a non-Mixed panel to inherit the panel datasource, which silently breaks the legacy refId reference flow. Self-contained mode side-steps that entirely.

## 3. Not configured yet

This is the initial state for a brand-new query.  
It is not an error — it simply means no Target Datasource/query has been selected yet.

## Datasource settings (Grafana 13+)

Configure the CompareQueries datasource in **Connections -> Data sources**.

- `Authentication (Optional)` defaults to `No Authentication`.
- Switch to `Basic authentication` only when backend or alerting requests fail authentication.
- When `Basic authentication` is selected, configure:
  - `Service Account` token
  - optional `Grafana URL` (only if auto-detection is incorrect)

![Datasource settings](./img/datasource-settings.png)

## Legacy Mixed mode on Grafana 13+ (compatibility)

If you still use the old refId/Mixed workflow on Grafana 13+, set the panel datasource to `-- Mixed --`.
Then keep one source query (for example refId `A`) and one CompareQueries row (for example refId `B`) with Time-shift.

![Grafana 13 Mixed usage](./img/plugin-usage-mixed.png)


# Migration Guide (2.0.x -> 2.1.0)

## TL;DR

- Existing Grafana 11/12 dashboards keep working after upgrade.
- On Grafana 13+, legacy refId flow works only with panel datasource `-- Mixed --`.
- For non-Mixed panels and Alerting, migrate to self-contained mode.

## In-editor migration (recommended)

1. Open the legacy CompareQueries row (`Reference Query refId` is set).
2. Click **Migrate to Target Datasource**.
3. Choose the same target datasource used by the referenced refId query.
4. Re-build the query in the embedded native editor.
5. Save dashboard.

What is preserved during migration:

- Time-shift rows (`Amount`, `alias`, `aliasType`, `delimiter`)
- Process TimeShift toggle
- CompareQueries row `refId`

What changes:

- Legacy `target.query` (refId reference) is cleared
- `targetQueryJSON` is reset and should be rebuilt in embedded editor

For advanced migration operations (manual JSON cloning and bulk Dashboard JSON API migration), see `developer-guide.md`.

## Rollback

Use **Dashboard settings -> Versions -> Restore** to roll back a migration.


# Grafana Alerting

Alerting is supported in backend mode and requires **self-contained mode**.

## Minimal setup

1. Keep datasource auth as `No Authentication` by default.
2. If backend or alerting requests fail authentication, switch to `Basic authentication` and set:
   - `Service Account Token` (Viewer or above)
   - optional `Grafana URL` (only when auto-detection is incorrect)
3. Build query in CompareQueries editor and add alert expressions:
   - **Reduce**
   - **Threshold**

Reference alert rule setup:

![Alert config](./img/alert-config.png)

## Finding datasource UID

```bash
GRAFANA_BASE_URL=<grafana-base-url> # local default: http://localhost:3000
curl -s -u admin:<password> "$GRAFANA_BASE_URL/api/datasources" | python3 -m json.tool | grep -E '"name"|"type"|"uid"'
```

For advanced alert troubleshooting and payload examples, see `developer-guide.md`.


# Contributing

If you're interested in contributing to the project:

- Start by reading the [Contributing guide](./CONTRIBUTING.md).
- Learn how to set up your local environment, in our [Developer guide](./developer-guide.md).


# License

This plugin is distributed under Apache-2.0 License.
