[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)

# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

[![License](https://img.shields.io/github/license/leoswing/comparequeries-datasource-rc)](LICENSE)
![Drone](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/release.yaml/badge.svg)

Key features:

- Compatible with Grafana 11
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Cache datasource query result and reduce query reduction when query conditions remains the same.
- **Supports Grafana Alerting** via a backend plugin that proxies time-shifted queries to target datasources

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

For the plugin documentation, visit [plugin documentation](https://grafana.com/grafana/plugins/leoswing-comparequeries-datasource/)


# Grafana Alerting

This plugin supports Grafana Alerting in backend mode. When an alert rule is evaluated, the backend plugin proxies time-shifted queries directly to the target datasource and returns the results to the Grafana alerting engine.

## Prerequisites

Before configuring alerts, make sure the following are set up in the datasource settings:

- **Grafana URL**: The URL of your Grafana instance (e.g. `http://localhost:3000`). Used by the backend to proxy queries via `/api/ds/query`.
- **Service Account Token**: A Grafana service account token with at least `Viewer` permissions. Required to authenticate backend proxy requests.

To create a service account token: go to **Administration → Service Accounts → Add service account**, then generate a token and paste it into the datasource config.

## Query Editor Configuration

The Query Editor has two sections relevant to alerting:

### 1. Time Shift Rows (main area)

Each row defines one time-shifted query. All rows are executed by the backend during alert evaluation.

| Field | Description | Example |
|-------|-------------|---------|
| **Query** | A query reference label used in dashboard/panel mode only. **Not required in alerting mode** — the actual query is defined in the *Target Query JSON* field under Alerting Configuration. Leave it empty when configuring alerts. | _(leave empty)_ |
| **Amount** | Time shift offset. Supports units: `y`, `M`, `w`, `d`, `h`, `m`, `s`. Leave empty for the current time window. | `-1w`, `-24h`, `-30d` |
| **alias** | Label suffix/prefix added to the returned series name. Defaults to the Amount value. | `last_week` |
| **alias type** | How the alias is applied to the series name: `suffix`, `prefix`, or `absolute`. | `suffix` |
| **delimiter** | Separator between the original name and alias (only used for suffix/prefix). | `_` |

**Process TimeShift** toggle: when enabled, timestamps of shifted data are moved forward to align with the current time window on the graph.

### 2. Alerting Configuration (Backend Mode)

Expand this section to configure the target datasource for backend/alerting queries. These fields are **required** for Grafana Alerting to work.

| Field | Description | Example |
|-------|-------------|---------|
| **Target Datasource UID** | UID of the datasource to query. Find it in the datasource settings URL or via `GET /api/datasources`. | `elasticsearch-uid` |
| **Datasource Type** | Type identifier of the target datasource. | `elasticsearch`, `prometheus`, `loki`, `influxdb` |
| **Target Query JSON** | The query payload sent to the target datasource, in JSON format. Do **not** include `refId`, `datasource`, `intervalMs`, or `maxDataPoints` — these are injected automatically. | See examples below |

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
