[![CodeQL](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml/badge.svg)](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/pr-codeql-analysis-typescript.yml) ![](https://img.shields.io/github/v/release/leoswing/comparequeries-datasource-rc?style=plastic%253Flabel=repo)

# Overview

This data source plugin enables data comparison capabilities by supporting queries from multiple data sources. It allows you to use custom time shifts to display data from different time ranges within a single graph.

[![License](https://img.shields.io/github/license/leoswing/comparequeries-datasource-rc)](LICENSE)
![Drone](https://github.com/leoswing/comparequeries-datasource-rc/actions/workflows/release.yaml/badge.svg)

Key features:

- Compatible with Grafana 11
- Resolves issues with undefined data points
- Introduces support for timeShift aliases
- Cache datasource query result and reduce query reduction when query condtions remains the same.

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


# Contributing

If you're interested in contributing to the project:

- Start by reading the [Contributing guide](./CONTRIBUTING.md).
- Learn how to set up your local environment, in our [Developer guide](./developer-guide.md).


# License

This plugin is distributed under Apache-2.0 License..
