[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)


# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

Key features:

• Compatible with Grafana 11
• Resolves issues with undefined data points
• Introduces support for timeShift aliases

![Plugin-snapshot](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/src/img/compare-func.png)


# Quick start

Step 1. Create a data source with your type based on your demand, such as Elasticsearch.

Step 2. Create a data source with type CompareQueries. Grafana --> Connections --> Data sources --> Add new data source， then type 'compare' to use CompareQueries plugin.


![Screenshot-create-db](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/create-db.png)


Step 3. Create a basic query using your database, such as Elasticsearch.

Step 4. Create a comparison query based on the basic query. To create multi-line time series, the query requires at least 2 fields in the following order:

- field `Query`: `Query` field which refer to the basic query name
- field `Amount`: `Amount` field with time range, time shift supports：s(second), m(minute), h(hour), d(day), w(week), M(month), y(year)

![Screenshot-usage-comparequeries](https://raw.githubusercontent.com/leoswing/comparequeries-datasource-rc/main/img/usage-comparequeries.png)
