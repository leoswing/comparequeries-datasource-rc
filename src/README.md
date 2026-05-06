[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)


# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

Key features:

- Compatible with Grafana 11/12/13+
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Supports Grafana Alerting (backend execution in self-contained mode)

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)


# Quick start

Step 1. Add the real target datasource you want to compare, such as Elasticsearch.

Step 2. Create a datasource of type CompareQueries.  
Grafana -> Connections -> Data sources -> Add new data source -> search `compare`.


![Screenshot-create-db](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/create-db.png)

Step 3. Configure CompareQueries datasource settings.

- `Authentication (Optional)` defaults to `No Authentication`
- Switch to `Basic authentication` only when backend/alerting requests fail authentication
- Fill `Service Account` and optional `Grafana URL` only in that case

![Screenshot-datasource-settings](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/datasource-settings.png)

Step 4. Build panel query (Grafana 13+ recommended self-contained flow).

- Use CompareQueries query row
- Add time shift rows (`Amount` like `1d`, `1w`, etc.)
- Pick `Target Datasource` in the CompareQueries editor and build query inline

Step 5. If you use the legacy Mixed flow on Grafana 13+, set panel datasource to `-- Mixed --` first.

In legacy Mixed mode:

- Query A: build normal source query (e.g. Elasticsearch)
- Query B: use CompareQueries with time shift + target datasource query
- Keep panel datasource as `-- Mixed --` for this compatibility path

![Screenshot-plugin-usage-mixed](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/plugin-usage-mixed.png)

# Grafana Alerting (2.1.0+)

Alerting uses backend execution and requires **self-contained mode** (`datasourceUid` + `targetQueryJSON`).

- Default datasource auth mode is `No Authentication`.
- If backend/alerting requests fail authentication, switch to `Basic authentication`.
- In `Basic authentication`, configure `Service Account` token and (optionally) `Grafana URL`.

Reference alert rule setup (query + condition):

![Screenshot-alert-config](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/alert-config.png)

For advanced alert migration and troubleshooting details, see `../developer-guide.md`.
