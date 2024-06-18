# CompareQueries datasource plugin for Grafana

This datasource plugin allows you to query source with compare ability support, and with React upgrade support.


# Overview

This plugin is based on [autohome-compareQueries-datasource](https://github.com/AutohomeCorp/autohome-compareQueries-datasource), while with React based framework support.

- Construct with React framework
- Fix undefined data points issue
- Add timeShift alias support


# Installation

## Plugin download

First of all, Clone this project into the grafana plugins directory (default is `/var/lib/grafana/plugins` if you installed grafana using a package). 

And then Restart grafana.

## Grafana container config

Installing CompareQueries Grafana datasource [requires](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#allow_loading_unsigned_plugins)
the following changes to Grafana's `grafana.ini` config:

``` ini
[plugins]
allow_loading_unsigned_plugins = autohome-comparequeries-datasource
```

For `grafana-operator` users, please adjust `config:` section in your `kind=Grafana` resource as below

```
  config:
    plugins:
      allow_loading_unsigned_plugins: "autohome-comparequeries-datasource"
```

## Frontend datasource plugin usage

- Create a data source of type CompareQueries.
- Create a basic query
- Create a comparison query based on the base query.
- Increase the time of comparison query in comparison query.

# Contributing

Thanks to the contributors as below:

- [grafana](https://github.com/grafana/grafana)
- [simple-json-datasource](https://github.com/grafana/simple-json-datasource)
- [grafana-meta-queries](https://github.com/GoshPosh/grafana-meta-queries)
