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

1. Open a terminal and run `git clone https://github.com/leoswing/autohome-compareQueries-datasource-rc.git`. This command downloads Grafana plugin to a new `autohome-compareQueries-datasource-rc` directory in your current directory.
1. Open the `autohome-compareQueries-datasource-rc` directory in your favorite code editor.

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
