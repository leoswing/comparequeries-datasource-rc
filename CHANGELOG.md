# 1.1.0 (2024-06-20)

### Features and enhancements

- Suit with Grafana 11, remove filterQuery method as it should migrate, see [PR](https://github.com/leoswing/autohome-compareQueries-datasource-rc/pull/1)

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