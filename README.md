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
- Cache datasource query result and reduce query reduction when query conditions remains the same.
- **Supports Grafana Alerting** via a backend plugin that proxies time-shifted queries to target datasources
- **Backward compatible** — pre-Grafana 13 dashboards using the legacy Mixed + refId reference flow continue to work without migration

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)


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


For detailed instructions on how to install the plugin on Grafana Cloud or locally, please checkout the [Plugin installation docs](https://grafana.com/docs/grafana/latest/administration/plugin-management/).


# Quick start

## Quick start (3 steps)

For most users, this is all you need:

1. Configure datasource authentication in **Connections -> Data sources** (default `No Authentication`).
2. In panel QueryEditor, pick **Target Datasource** and build query in the embedded native editor.
3. Add **Time-shift** rows (`1d`, `1w`, etc.), then save panel / alert rule.

Need legacy `-- Mixed --` compatibility or upgrade details? See the sections below.

## Query modes

The QueryEditor operates in **three modes** driven by query shape.

## 1. Self-contained mode (recommended, Grafana 13+ ready)

Use this for new dashboards. Works on **any panel datasource** (no need to switch the panel to `-- Mixed --`) and is the **only** mode that supports Grafana Alerting.

1. Add the **CompareQueries** datasource to a panel.
2. In the QueryEditor, pick a **Target Datasource** (Prometheus, Elasticsearch, Loki, …). The plugin embeds that datasource's **native** query editor right inline — you get the same UX as building the query directly on the source (PromQL autocomplete, ES bucket aggs, LogQL builder, SQL, etc.).
3. Build the query as usual.
4. Add one or more **Time-shift** rows. An empty `Amount` means **no shift** (base series); `1d`, `1w`, etc. shift back in time.
5. Optionally toggle **Process TimeShift** to align timestamps of shifted series with the current window.

The plugin runs the embedded query once per Time-shift row, applies the alias rules, and merges everything into a single result.

## 2. Legacy refId reference mode (backward compatible, pre-Grafana 13 / Mixed only)

Pre-2.1 dashboards used this mode: the panel datasource is `-- Mixed --`, one query (e.g. `refId: A`) carries the real Elasticsearch / Prometheus query, and a sibling **CompareQueries** row with `Reference Query refId: A` time-shifts that result.

These dashboards keep working as-is after upgrade. The QueryEditor auto-detects them and shows the legacy form **plus** a one-click **Migrate to Target Datasource** button:

- Migration **preserves** all Time-shift rows, alias type, delimiter and Process TimeShift settings.
- After migration you re-build the query in the embedded native editor (the QueryEditor API doesn't expose sibling targets, so the payload can't be auto-cloned).
- Migrating lets you change the panel datasource away from `-- Mixed --`.

> **Why migrate?** Grafana 13's Scenes architecture forces every target in a non-Mixed panel to inherit the panel datasource, which silently breaks the legacy refId reference flow. Self-contained mode side-steps that entirely.

## 3. Empty mode

A brand-new query shows a guided hint pointing at the Target Datasource picker.

## Datasource settings (Grafana 13+)

Configure the CompareQueries datasource in **Connections -> Data sources**.

- `Authentication (Optional)` defaults to `No Authentication`.
- Switch to `Basic authentication` only when backend/alerting requests fail authentication.
- When `Basic authentication` is selected, configure:
  - `Service Account` token
  - optional `Grafana URL` (only if auto-detection is incorrect)

![Datasource settings](./img/datasource-settings.png)

## Legacy Mixed mode on Grafana 13+ (compatibility)

If you still use the old refId/Mixed workflow on Grafana 13+, set the panel datasource to `-- Mixed --`.
Then keep one source query (for example refId `A`) and one CompareQueries row (for example refId `B`) with Time-shift.

![Grafana 13 Mixed usage](./img/plugin-usage-mixed.png)


# Migration Guide (2.0.x → 2.1.0)

## TL;DR

| You are on… | What happens after upgrade |
|---|---|
| Grafana 11 / 12 + dashboards using the old Mixed + refId reference flow | Nothing breaks. QueryEditor falls into legacy mode, the `_runLegacy` / `_compareQuery` path runs as before. |
| Grafana 13+ + dashboards using the old Mixed + refId reference flow | Still works **only** if the panel datasource is `-- Mixed --`. For non-Mixed panels, the legacy refId reference returns "No data" — migrate to self-contained. |
| Any Grafana version + new dashboards | Use self-contained mode from day one — pick a Target Datasource and the embedded native editor takes care of the rest. |

**Bottom line:** the upgrade itself is zero-action. Migration is only required if you want to drop `-- Mixed --` and unlock Grafana Alerting on a previously legacy-style query.

## When migration is required

Migrate from legacy Mixed/refId mode to self-contained mode when you need any of these:

- Non-Mixed panel datasources on Grafana 13+
- Grafana Alerting with CompareQueries
- Native inline query editor UX for target datasource

If none apply, legacy dashboards can remain as-is.

## In-editor migration (recommended, per-query)

The QueryEditor auto-detects legacy queries and shows a yellow Alert with a one-click Migrate button. The flow:

1. Open the dashboard panel and click **Edit** on the CompareQueries row that has a `Reference Query refId`.
2. Click **`Migrate to Target Datasource →`**.
3. In the inline picker, choose the **same** datasource that the referenced refId (e.g. `A`) was pointing at — typically Prometheus / Elasticsearch / Loki / etc.
4. Click **Migrate**. The QueryEditor flips to self-contained mode and embeds that datasource's native QueryEditor.
5. Re-build the actual query in the embedded editor (copy/paste from the original refId `A` row in the same panel; for raw JSON cloning workflow, see `developer-guide.md`).
6. Optionally delete the now-orphan refId `A` query if no other compare row references it.
7. Optionally switch the panel datasource away from `-- Mixed --` to **CompareQueries** itself (or any other datasource) — non-Mixed panels are now supported.
8. **Save** the dashboard.

### What's preserved vs. reset

| Setting | Preserved? |
|---|---|
| Time-shift rows (`Amount`, `alias`, `aliasType`, `delimiter`) | ✅ |
| Process TimeShift toggle | ✅ |
| `refId` of the CompareQueries row itself | ✅ |
| Old `Reference Query refId` field (`target.query`) | 🧹 cleared |
| `targetQueryJSON` (actual query payload) | ⚠️ reset to `{}` — you re-build it in the embedded editor |

For advanced migration operations (manual JSON cloning from network payloads, and bulk migration via Dashboard JSON API), see **Developer guide → Advanced migration (2.0.x to 2.1.0)**.

## Rollback

If a migration goes wrong, dashboards are versioned by Grafana. Revert via **Dashboard settings → Versions → Restore** to the pre-migration version, or re-import the previous JSON. The plugin runtime continues to handle the legacy data shape regardless.


# Grafana Alerting

This plugin supports Grafana Alerting in backend mode. When an alert rule is evaluated, the backend plugin proxies time-shifted queries directly to the target datasource and returns the results to the Grafana alerting engine.

## Prerequisites

Before configuring alerts, make sure datasource authentication is configured correctly for your environment:

- Default: keep `Authentication` as **No Authentication**.
- If backend/alerting evaluation fails due to authentication, switch to **Basic authentication** and configure:
  - **Service Account Token**: A Grafana service account token with at least `Viewer` permissions.
  - **Grafana URL**: Optional, usually auto-detected (set manually only when auto-detection is incorrect).

To create a service account token: go to **Administration → Service Accounts → Add service account**, then generate a token and paste it into the datasource config.

## Query Editor Configuration

For alerting, use **self-contained mode** (see [Quick start](#quick-start) above) — the embedded native query editor maintains the `targetQueryJSON` payload under the hood, which is exactly what the backend uses during alert evaluation.

### Time Shift Rows

| Field | Description | Example |
|-------|-------------|---------|
| **Amount** | Time shift offset. Supports units: `y`, `M`, `w`, `d`, `h`, `m`, `s`. Leave empty for the current time window (base series). | `-1w`, `-24h`, `-30d` |
| **alias** | Label suffix/prefix added to the returned series name. Defaults to the Amount value. | `last_week` |
| **alias type** | How the alias is applied to the series name: `suffix`, `prefix`, or `absolute`. | `suffix` |
| **delimiter** | Separator between the original name and alias (only used for suffix/prefix). | `_` |

**Process TimeShift** toggle: when enabled, timestamps of shifted data are moved forward to align with the current time window on the graph.

### Target Datasource & Query

| Field | Description |
|-------|-------------|
| **Target Datasource** | Pick any datasource installed in this Grafana — the plugin loads its native QueryEditor inline. |
| **Embedded native editor** | Build the query the way you would on the source datasource. The plugin strips Grafana-injected fields (`refId`, `datasource`, `key`, `hide`) from the payload before saving — they are re-injected on dispatch. |
| **Edit as raw JSON** | Fallback when the target datasource doesn't ship a `QueryEditor` component, or when you want to paste a hand-crafted payload. |

## Alert rule expression setup

After query `A` is configured:

1. Add **Reduce** (recommended reducer: `Last` or `Mean`)
2. Add **Threshold** (for example `IS ABOVE 100`)

Each shifted series carries a `timeshift` label (for example `timeshift="1d"`), so Grafana evaluates each shifted branch correctly.

For raw JSON examples and advanced alert migration troubleshooting, see `developer-guide.md`.

## Finding the Datasource UID

Run the following command to list all datasources and their UIDs:

```bash
GRAFANA_BASE_URL=<grafana-base-url> # local default: http://localhost:3000
curl -s -u admin:<password> "$GRAFANA_BASE_URL/api/datasources" | python3 -m json.tool | grep -E '"name"|"type"|"uid"'
```


# Contributing

If you're interested in contributing to the project:

- Start by reading the [Contributing guide](./CONTRIBUTING.md).
- Learn how to set up your local environment, in our [Developer guide](./developer-guide.md).


# License

This plugin is distributed under Apache-2.0 License..
