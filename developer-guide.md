# Developer guide

> For Grafana plugin developer only

For Grafana developers who like to debug with the plugin, follow the instructions as below.

## Dependencies

Make sure you have the following dependencies installed before setting up your developer environment:

- [Git](https://git-scm.com/)
- [Node.js (Long Term Support)](https://nodejs.org), with [corepack enabled](https://nodejs.org/api/corepack.html#enabling-the-feature). See [.nvmrc](../.nvmrc) for supported version. We recommend that you use a version manager such as [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), or similar.
- [docker-compose](https://github.com/docker/compose) needs docker and docker-compose installed.

### macOS

We recommend using [Homebrew](https://brew.sh/) for installing any missing dependencies:

```
brew install git
brew install go
brew install node@20
corepack enable
```

### Windows

If you are running Grafana on Windows 10, we recommend installing the Windows Subsystem for Linux (WSL). For installation instructions, refer to our [Grafana setup guide for Windows environment](https://grafana.com/blog/2021/03/03/how-to-set-up-a-grafana-development-environment-on-a-windows-pc-using-wsl/).


## Download Grafana

We recommend using the Git command-line interface to download the source code for the Grafana plugin:

1. Open a terminal and run `git clone https://github.com/leoswing/comparequeries-datasource-rc.git`. This command downloads Grafana plugin to a new `comparequeries-datasource-rc` directory in your current directory.
1. Open the `comparequeries-datasource-rc` directory in your favorite code editor.

For alternative ways of cloning the Grafana repository, refer to [GitHub's documentation](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository).


## Development

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

### Multi-version verification (parallel) + persistent data

Use the matrix helper to validate the same plugin build against multiple Grafana versions in parallel.
Each version gets its own project name, port, and persistent Docker named volume for Grafana state.

```bash
# Default versions: 11.6.5,12.0.0 on ports 3100+
npm run server:matrix:up

# Show status per version
npm run server:matrix:status

# Stop all versions (keeps data in .data/)
npm run server:matrix:down
```

Optional environment variables:

- `GRAFANA_MATRIX_VERSIONS` (comma-separated), e.g. `11.6.5,12.0.0,13.1.0`
- `GRAFANA_MATRIX_BASE_PORT` (default `3100`)
- `GRAFANA_MATRIX_PROJECT_PREFIX` (default `comparequeries-grafana`)

Example:

```bash
GRAFANA_MATRIX_VERSIONS=11.6.5,12.0.0 GRAFANA_MATRIX_BASE_PORT=3200 npm run server:matrix:up
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

## Advanced migration (2.0.x to 2.1.0)

Use this section only for bulk or scripted migrations. For most users, prefer the in-editor migrate flow documented in `README.md`.

### Manual cloning helper (per panel)

When migrating a legacy Mixed/refId query to self-contained mode, you may need to copy the original target payload:

1. Before clicking **Migrate**, open browser DevTools -> **Network**.
2. Refresh the panel and filter requests by `/api/ds/query`.
3. In `queries[]`, find the entry whose `refId` matches the legacy reference (for example `A`), then copy its body.
4. Remove Grafana-injected fields before pasting: `refId`, `datasource`, `intervalMs`, `maxDataPoints`, `hide`, `key`.
5. In CompareQueries embedded editor, use **Edit as raw JSON** and paste the cleaned payload.

### Bulk migration via Dashboard JSON API

For large estates, you can rewrite dashboard JSON programmatically:

```bash
# Set your Grafana base URL first.
# Local dev default: http://localhost:3000
GRAFANA_BASE_URL=<grafana-base-url>

# 1) Pull dashboard JSON
curl -s -u admin:<pwd> "$GRAFANA_BASE_URL/api/dashboards/uid/<dashboard-uid>" > dash.json

# 2) For each CompareQueries target with `query: "A"`:
#    - find sibling target with refId == "A" in the same panel
#    - copy sibling datasource.uid -> CompareQueries.datasourceUid
#    - copy sibling query payload (minus refId/datasource/intervalMs/maxDataPoints/hide/key)
#      -> CompareQueries.targetQueryJSON
#    - remove legacy `query` field
#    - optionally remove orphan sibling target

# 3) Push patched dashboard
curl -s -u admin:<pwd> -X POST -H 'Content-Type: application/json' \
  -d '{"dashboard": <patched>, "overwrite": true}' \
  "$GRAFANA_BASE_URL/api/dashboards/db"
```

Runtime auto-detection note: when `datasourceUid` and non-empty `targetQueryJSON` are present, the plugin routes to self-contained execution automatically.


## Learn more

Below you can find source code for existing app plugins and other related documentation.

- [Basic data source plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/datasource-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-json)
- [How to sign a plugin?](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)


## Q & A

Run the following commands to get started:

```bash
    * cd ./comparequeries-datasource-rc
    * npm install to install frontend dependencies.
    * npm exec playwright install chromium to install e2e test dependencies.
    * npm run dev to build (and watch) the plugin frontend code.
    * docker-compose up to start a grafana development server.
    * Open your Grafana URL in browser to create a dashboard and begin developing your plugin
      (local dev default: http://localhost:3000).
```

Note: We strongly recommend creating a new Git repository by running git init in ./comparequeries-datasource-rc before continuing.

    * Learn more about Grafana Plugin Development at https://grafana.com/developers/plugin-tools
