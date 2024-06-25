# 2.0.0 (2024-06-25)

### Breaking change

- Refactor the plugin id with `leoswing-comparequeries-datasource`, and signed with public signature level in Grafana.
- Repo name refactor to `comparequeries-datasource-rc`
- Package.json name refactor to `leoswing-comparequeries-datasource`
- Release workflow publish the zip name to formate `${{ env.NAME }}-${{ env.TAG }}.zip`

# 1.2.0 (2024-06-24)

### Features and enhancements

- Upgrade QueryEditor data binding logics from query property

### Bug fixes

- Fix QueryEditor data model timeShifts lost when refresh issue [#2](https://github.com/leoswing/comparequeries-datasource-rc/issues/2)

# 1.1.0 (2024-06-20)

### Features and enhancements

- Suit with Grafana 11, remove filterQuery method as it should migrate, see [PR](https://github.com/leoswing/comparequeries-datasource-rc/pull/1)

# 1.0.0 (2024-06-18)

Restructure repo with React based framework support.

### Features and enhancements

- Restructure codebase with React-based, which could refer to the [tutorial](https://grafana.com/developers/plugin-tools/tutorials/build-a-data-source-plugin)
- Add alias name as displayName support.
- `QueryEditor` with React jsx and models supprt.
- Use `getDataSourceSrv()` and `getTemplateSrv()` import from `'@grafana/runtime'` to fetch dataSourceSrv and templateSrv
- Remove `MutableField` 和 `ArrayVector` from datasource, and refactor with `Field` and `Array` support.

### Bug fixes

- Solve data point undefined issue when no database is selected.