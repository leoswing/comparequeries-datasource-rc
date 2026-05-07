[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)

# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

[![License](https://img.shields.io/github/license/leoswing/comparequeries-datasource-rc)](LICENSE)
![Drone](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/release.yaml/badge.svg)

Key features:

- Compatible with Grafana 11, 12, **and 13+**
- Embeds the **native query editor** of any installed datasource (PromQL autocomplete, ES bucket aggs, LogQL, SQL, etc.) — no more hand-writing JSON
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Caches datasource query results to reduce repeated queries when conditions remain the same.
- **Supports Grafana Alerting** via a backend plugin that proxies time-shifted queries to target datasources
- **Backward compatible** — pre-Grafana 13 dashboards using the legacy Mixed + refId reference flow continue to work without migration

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/plugin-usage-mixed.png)


# Compatibility notes (2.1.0)

- Plugin id is `leoswing-comparequeries-datasource` and uses signature verification.
- For dashboard panels, use Grafana `-- Mixed --` as the panel datasource, then add a CompareQueries query.
- In the CompareQueries query, pick the **Target Datasource**, configure **Time shift**, and build the target query inline.
- Legacy RefId usage is kept only for Grafana versions below 13 with existing CompareQueries RefId dashboards. For Grafana 13+, use `-- Mixed --` as the panel datasource and pick Target Datasource inside CompareQueries.
- Grafana Alerting is supported in 2.1.0 through backend execution.


# Download

You can download and install this grafana plugin using various options:

- From [Grafana plugin catalog](https://grafana.com/grafana/plugins/leoswing-comparequeries-datasource/)
- From [Github release page](https://github.com/leoswing/comparequeries-datasource-rc/releases)
- Using grafana cli

   `grafana-cli plugins install leoswing-comparequeries-datasource`

- Using docker

    `docker run -p 3000:3000 -e "GF_INSTALL_PLUGINS=leoswing-comparequeries-datasource" grafana/grafana:latest`


For detailed instructions on how to install the plugin on Grafana Cloud or locally, please check out the [Plugin installation docs](https://grafana.com/docs/grafana/latest/administration/plugin-management/).


# Quick start

For most users, this is all you need:

1. Add a real target datasource first, such as Elasticsearch, Prometheus, or Loki.
2. Add the **CompareQueries** datasource in **Connections -> Data sources**.
3. Keep `Authentication` as `No Authentication` by default, then click **Save & test**.
4. Create a dashboard panel and set panel datasource to `-- Mixed --`.
5. Add a query row and select **CompareQueries** as that row's datasource.
6. Pick **Target Datasource** inside CompareQueries, build query inline, add **Time-shift** rows (`1d`, `1w`, etc.), then save.

## Which path should I use?

- New dashboard: use **Recommended dashboard usage**.
- Existing 2.0.x dashboard on Grafana < 13: keep **Legacy RefId usage**.
- Existing 2.0.x dashboard on Grafana 13+: use **Recommended dashboard usage**.
- Need alerting: use **Grafana Alerting usage**.

## Usage patterns

The plugin supports three common usage patterns:

## 1. Recommended dashboard usage

Use this for new dashboards, including Grafana 13+.

In a `-- Mixed --` panel, add a **CompareQueries** query row, pick a **Target Datasource**, build the target query inline, and add one or more **Time-shift** rows.

An empty `Amount` means **no shift** (base series); `1d`, `1w`, etc. shift back in time. Optionally toggle **Process TimeShift** to align timestamps of shifted series with the current window.

The plugin runs the embedded query once per Time-shift row, applies the alias rules, and merges everything into a single result.

## 2. Legacy RefId usage (Grafana < 13 existing dashboards only)

Use this only if you are on Grafana versions below 13 and already have dashboards using the old CompareQueries RefId workflow.

In this flow, panel datasource is `-- Mixed --`, one query (for example `refId: A`) is the real datasource query, and a sibling **CompareQueries** row time-shifts that query by referencing `A`.

For Grafana 13+, use the recommended dashboard flow instead: keep the panel datasource as `-- Mixed --`, add a CompareQueries row, then select **Target Datasource** inside CompareQueries.

The QueryEditor auto-detects legacy RefId queries and can show a **Migrate to Target Datasource** button:

- Migration **preserves** all Time-shift rows, alias type, delimiter and Process TimeShift settings.
- After migration you re-build the query in the embedded native editor (the QueryEditor API doesn't expose sibling targets, so the payload can't be auto-cloned).
- Migrating converts the query to the recommended inline Target Datasource flow.

> **When should I migrate?** Migrate when you want the newer inline Target Datasource editor or Grafana Alerting.

![Grafana 13 Mixed usage](./img/plugin-usage-mixed.png)

## 3. Grafana Alerting usage

Alerting runs through backend execution. Configure the CompareQueries query directly with **Target Datasource**, **Time shift**, and query inline. See [Grafana Alerting](#grafana-alerting).

## 4. Not configured yet

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

# Migration Guide (2.0.x -> 2.1.0)

Existing Grafana 11/12 dashboards keep working after upgrade.

For Grafana 13+, legacy RefId dashboards should use the recommended flow:
`-- Mixed --` panel + CompareQueries query + Target Datasource inside CompareQueries.

To migrate in the editor:

1. Open the legacy CompareQueries row (`Reference Query refId` is set).
2. Click **Migrate to Target Datasource**.
3. Choose the original target datasource.
4. Rebuild the query in the embedded editor.
5. Save the dashboard.

Migration keeps time-shift rows, alias settings, delimiter, Process TimeShift, and the CompareQueries `refId`.

Rollback: use **Dashboard settings -> Versions -> Restore**.


# Grafana Alerting

Alerting is supported in backend mode. Configure the CompareQueries query directly with Target Datasource, Time shift, and query inline.

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
