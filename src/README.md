[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)


# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

Key features:

- Compatible with Grafana 11/12/13+
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Supports Grafana Alerting through backend execution
- Delegates dashboard variables and Ad Hoc filters to target datasources
- Supports Math expressions with multi-value variables (v2.1.0+)

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)


# Quick start

Step 1. Add the real target datasource you want to compare, such as Elasticsearch.
CompareQueries does not store metrics by itself; it runs queries against this target datasource.

Step 2. Create a datasource of type CompareQueries.  
Grafana -> Connections -> Data sources -> Add new data source -> search `compare`.


![Screenshot-create-db](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/create-db.png)

Step 3. Configure CompareQueries datasource settings.

- `Authentication (Optional)` defaults to `No Authentication`
- Switch to `Basic authentication` only when backend or alerting requests fail authentication
- Fill `Service Account` and optional `Grafana URL` only in that case

![Screenshot-datasource-settings](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/datasource-settings.png)

Step 4. Create a dashboard panel and set panel datasource to `-- Mixed --`.

Step 5. Add a query row and select CompareQueries as that row's datasource.

Step 6. Pick `Target Datasource` inside CompareQueries, build target query inline, and add time shift rows (`Amount` like `1d`, `1w`, etc.).

![Screenshot-plugin-usage-mixed](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/plugin-usage-mixed.png)

# Dashboard variables & Ad Hoc filters

CompareQueries delegates variable and Ad Hoc filter formatting to the **target datasource** (Elasticsearch, Prometheus, SQL, etc.). It does not maintain per-datasource multi-value syntax rules.

- **Panel / Math expression / Alerting**: `targetQueryJSON` is interpolated via the target plugin's `applyTemplateVariables` when available.
- **Multi-value variables**: formatted by the target (e.g. Elasticsearch → `("a" OR "b" OR "c")`), not CompareQueries' glob fallback `{a,b,c}`.
- **Ad Hoc filters**: bind the Ad hoc variable to **CompareQueries** (not the target datasource). Enable **Use static key dimensions** and list fields one per line as `label,fieldName` (e.g. `moduleName,moduleName`). URL: `var-filter=moduleName%7C%3D%7Caction` — one key per parameter.
- **Verify**: Query inspector → final target request (`ds_type=elasticsearch`, etc.) should show expanded variables and appended filters.

# Mathematical expressions (2.1.0+)

Use with Grafana [Math expressions](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/) in a `-- Mixed --` panel: base query + CompareQueries shifted query + Expression row.

- Enable **Basic authentication** + **Service Account token** on the CompareQueries datasource when backend expression execution requires auth.
- Enable **Process TimeShift** when the expression must align shifted series on the same time axis.

Details: [Wiki — Mathematical Expressions](https://github.com/leoswing/comparequeries-datasource-rc/wiki/Mathematical-Expressions).

# Legacy RefId usage (Grafana < 13 existing dashboards only)

Use this only if you are on Grafana versions below 13 and already have dashboards using the old CompareQueries RefId workflow.

- Query A: build normal source query (e.g. Elasticsearch)
- Query B: use CompareQueries and reference Query A by RefId
- Keep panel datasource as `-- Mixed --`

For Grafana 13+, use Step 4 recommended flow instead: select `Target Datasource` inside CompareQueries.

# Grafana Alerting (2.1.0+)

Alerting uses backend execution. Alert rules do not use the panel `-- Mixed --` datasource flow.
Configure CompareQueries directly with `Target Datasource`, `Time shift`, and query inline.

- The backend treats `targetQueryJSON` as an opaque target-datasource payload. Any remaining variables or datasource-specific macros are forwarded for the target datasource to validate.
- Default datasource auth mode is `No Authentication`.
- If backend or alerting requests fail authentication, switch to `Basic authentication`.
- In `Basic authentication`, configure `Service Account` token and (optionally) `Grafana URL`.

Reference alert rule setup (query + condition):

![Screenshot-alert-config](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/alert-config.png)
