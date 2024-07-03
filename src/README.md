[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)


# Overview

This data source plugin provides data comparison ability with other datasource query support, you can use custom time shift to query selected time range data in one graph.

- Suitable for Grafana 11.
- Fix undefined data points issue
- Add timeShift alias support

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)


# Quick start

## Preparation

> Only if you have already the old version plugin.

Disabled the old version if you have already installed this plugin.

Grafana --> Administration --> Plugins and data --> Plugins

Find the old version plugin, and then Uninstall it.


## Grafana config

Installing CompareQueries Grafana datasource [requires](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#allow_loading_unsigned_plugins)
the following secion changes to Grafana's `grafana.ini` config:

``` ini
[plugins]
allow_loading_unsigned_plugins = leoswing-comparequeries-datasource
```


## Datasource plugin usage

Step 1. Create a data source of your type based on your demand, such as Elasticsearch.

Step 2. Create a data source of type CompareQueries. Grafana --> Connections --> Data sources --> Add new data source， then type 'compare' to use CompareQueries plugin.


![Screenshot-create-db](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/create-db.png)


Step 3. Create a basic query using your database, such as Elasticsearch.

Step 4. Create a comparison query based on the base query.

Step 5. Increase the time of comparison query in comparison query, Time shift supports：s(second), m(minute), h(hour), d(day), w(week), M(month), y(year)

![Screenshot-usage-comparequeries](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/usage-comparequeries.png)
