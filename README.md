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


# Breaking changes

- Plugin with id `leoswing-comparequeries-datasource`, and with signature verification.


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

The QueryEditor operates in **three modes** driven by the query data shape — you pick by simply choosing what to fill in.

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

## Why migrate

| Capability | Legacy refId mode | Self-contained mode |
|---|---|---|
| Works on non-Mixed panel datasources (Grafana 13+) | ❌ | ✅ |
| Native query editor UX (PromQL autocomplete, ES bucket aggs, …) | ❌ (the source query lives in a sibling refId, no inline editor for the compare row) | ✅ |
| Grafana Alerting (backend mode) | ❌ | ✅ |
| Single-query simplicity (no separate "host" refId required) | ❌ | ✅ |
| Backward compatible with pre-Grafana 13 panels | ✅ | ✅ |

If any of the rows above matter for a given dashboard, migrate it. Otherwise, leaving the dashboard on legacy mode is perfectly fine — the plugin keeps both flows alive indefinitely.

## In-editor migration (recommended, per-query)

The QueryEditor auto-detects legacy queries and shows a yellow Alert with a one-click Migrate button. The flow:

1. Open the dashboard panel and click **Edit** on the CompareQueries row that has a `Reference Query refId`.
2. Click **`Migrate to Target Datasource →`**.
3. In the inline picker, choose the **same** datasource that the referenced refId (e.g. `A`) was pointing at — typically Prometheus / Elasticsearch / Loki / etc.
4. Click **Migrate**. The QueryEditor flips to self-contained mode and embeds that datasource's native QueryEditor.
5. Re-build the actual query in the embedded editor (copy/paste from the original refId `A` row in the same panel — see [Manual cloning helper](#manual-cloning-helper) below).
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

Why the payload isn't auto-cloned: the Grafana QueryEditor API exposes only the **current** target's data, never sibling targets in the same panel. Across Grafana 11/12/13+ versions there is no stable, public hook to introspect them, so cloning silently in the UI would be brittle. The trade-off is asking you to paste the query once.

### Manual cloning helper

For each panel you are migrating, this trick gets you the original payload to paste:

1. Before clicking **Migrate**, open browser DevTools → **Network** tab.
2. Refresh the dashboard panel once. Filter for `/api/ds/query`.
3. In the request payload of the CompareQueries-bearing call, find `queries[]` and locate the entry whose `refId` matches the legacy `Reference Query refId` value (e.g. `A`). Copy its body.
4. Strip these reserved fields before pasting: `refId`, `datasource`, `intervalMs`, `maxDataPoints`, `hide`, `key`.
5. After clicking **Migrate**, switch the embedded editor to **`Edit as raw JSON →`** and paste the cleaned object. Switch back to the native editor — Grafana renders the equivalent UI from your JSON.

## Bulk migration via the dashboard JSON API

For large estates, you can rewrite dashboards programmatically. Each CompareQueries target shape:

```jsonc
// Legacy (2.0.x) — relies on a sibling refId in a Mixed panel
{
  "refId": "B",
  "datasource": { "type": "leoswing-comparequeries-datasource", "uid": "<cq-uid>" },
  "query": "A",
  "timeShifts": [{ "id": 0, "value": "1d", "alias": "yesterday", "aliasType": "suffix", "delimiter": "_" }],
  "process": true
}

// Self-contained (2.1.0+) — works on any panel datasource and on Alerting
{
  "refId": "B",
  "datasource": { "type": "leoswing-comparequeries-datasource", "uid": "<cq-uid>" },
  "datasourceUid": "<target-ds-uid>",
  "targetQueryJSON": {
    "expr": "rate(http_requests_total[5m])",
    "legendFormat": "{{instance}}"
  },
  "timeShifts": [{ "id": 0, "value": "1d", "alias": "yesterday", "aliasType": "suffix", "delimiter": "_" }],
  "process": true
}
```

### Migration script outline

```bash
# 1. Pull the dashboard
curl -s -u admin:<pwd> http://localhost:3000/api/dashboards/uid/<dashboard-uid> > dash.json

# 2. For each CompareQueries target with `query: "A"`:
#    a) find sibling target with refId === "A" in the same panel
#    b) copy its datasource.uid into the CompareQueries target as `datasourceUid`
#    c) copy the rest of the sibling target (minus refId/datasource/intervalMs/maxDataPoints/hide/key)
#       into `targetQueryJSON`
#    d) delete the legacy `query` field
#    e) optionally delete the now-orphan sibling target

# 3. Push back
curl -s -u admin:<pwd> -X POST -H 'Content-Type: application/json' \
     -d '{"dashboard": <patched>, "overwrite": true}' \
     http://localhost:3000/api/dashboards/db
```

The plugin's runtime detects the new shape via `datasourceUid` + non-empty `targetQueryJSON` and routes to `_runSelfContained` automatically — no further dashboard reload required.

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

## Target Query JSON Examples

### Elasticsearch

Count of documents over time:

```json
{
  "query": "*",
  "timeField": "@timestamp",
  "metrics": [{ "type": "count", "id": "1" }],
  "bucketAggs": [{
    "type": "date_histogram",
    "field": "@timestamp",
    "id": "2",
    "settings": { "interval": "auto", "min_doc_count": "0" }
  }]
}
```

Count with filter (e.g. error logs):

```json
{
  "query": "level:error AND service:my-service",
  "timeField": "@timestamp",
  "metrics": [{ "type": "count", "id": "1" }],
  "bucketAggs": [{
    "type": "date_histogram",
    "field": "@timestamp",
    "id": "2",
    "settings": { "interval": "auto" }
  }]
}
```

Average of a numeric field:

```json
{
  "query": "service:api",
  "timeField": "@timestamp",
  "metrics": [{ "type": "avg", "id": "1", "field": "response_time" }],
  "bucketAggs": [{
    "type": "date_histogram",
    "field": "@timestamp",
    "id": "2",
    "settings": { "interval": "auto" }
  }]
}
```

### Prometheus

```json
{
  "expr": "rate(http_requests_total[5m])",
  "legendFormat": "{{instance}}"
}
```

> **Tip**: The easiest way to get the correct JSON for your datasource is to configure the query in a normal dashboard panel, then open the browser DevTools → Network, filter for `/api/ds/query`, run the query, and copy the `queries[0]` object from the request payload. Remove `refId`, `datasource`, `intervalMs`, `maxDataPoints`, and `hide` before pasting.

## Alert Expression Setup

After configuring the query, set up expressions in the alert rule as follows:

1. **Reduce** — collapse each time-shifted series to a single value (recommended: `Last` or `Mean`)
2. **Threshold** — apply a condition on the reduced value (e.g. `IS ABOVE 100`)

Each time-shifted series is identified by a unique `timeshift` label (e.g. `timeshift="-1w"`), so Grafana can correctly union and evaluate multiple shifts in a single alert rule.

## Finding the Datasource UID

Run the following command to list all datasources and their UIDs:

```bash
curl http://admin:<password>@localhost:3000/api/datasources | python3 -m json.tool | grep -E '"name"|"type"|"uid"'
```


# Contributing

If you're interested in contributing to the project:

- Start by reading the [Contributing guide](./CONTRIBUTING.md).
- Learn how to set up your local environment, in our [Developer guide](./developer-guide.md).


# License

This plugin is distributed under Apache-2.0 License..
