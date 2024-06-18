# CompareQueries datasource plugin for Grafana

This datasource plugin allows you to query source with compare ability support，with React upgrade support.

# Overview

Compare to the plugin [CompareQueries-datasource](https://github.com/AutohomeCorp/autohome-compareQueries-datasource/), we have improments as below:

- Restructure codebase with React-based, which could refer to the [tutorial](https://grafana.com/developers/plugin-tools/tutorials/build-a-data-source-plugin)
- Solve data point undefined issue when no database is selected.
- Add alias name as displayName support.

![Screenshot-conf](./img/conf-datasource.png)

![Screenshot-func](./img/func-snapshot.png)


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

## Datasource plugin usage

- Create a data source of type CompareQueries.
- Create a basic query
- Create a comparison query based on the base query.
- Increase the time of comparison query in comparison query.


# Development
> For Grafana plugin developer only

For Grafana developers, follow the instructions as below.

1. Install dependencies

   ```bash
   npm install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   npm run dev
   ```

3. Build plugin in production mode

   ```bash
   npm run build
   ```

4. Run the tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   npm run test

   # Exits after running all the tests
   npm run test:ci
   ```

5. Spin up a Grafana instance and run the plugin inside it (using Docker)

   ```bash
   npm run server
   ```

6. Run the E2E tests (using Cypress)

   ```bash
   # Spins up a Grafana instance first that we tests against
   npm run server

   # Starts the tests
   npm run e2e
   ```

7. Run the linter

   ```bash
   npm run lint

   # or

   npm run lint:fix
   ```


## Learn more

Below you can find source code for existing app plugins and other related documentation.

- [Basic data source plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/datasource-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-json)
- [How to sign a plugin?](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)


## Q & A

Run the following commands to get started:

```bash
    * cd ./autohome-compareQueries-datasource-rc
    * npm install to install frontend dependencies.
    * npm exec playwright install chromium to install e2e test dependencies.
    * npm run dev to build (and watch) the plugin frontend code.
    * docker-compose up to start a grafana development server.
    * Open http://localhost:3000 in your browser to create a dashboard to begin developing your plugin.
```

Note: We strongly recommend creating a new Git repository by running git init in ./autohome-compareQueries-datasource-rc before continuing.

    * Learn more about Grafana Plugin Development at https://grafana.com/developers/plugin-tools
