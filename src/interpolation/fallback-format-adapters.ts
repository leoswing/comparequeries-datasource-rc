import { ScopedVars } from '@grafana/data';
import _ from 'lodash';

export type VariableFormat = 'csv' | 'lucene' | 'pipe' | 'regex' | 'sqlstring';

export interface FallbackFormatAdapter {
  formatForPath(path: string[]): VariableFormat | undefined;
}

const LUCENE_QUERY_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (path[path.length - 1] === 'query' ? 'lucene' : undefined),
};

const REGEX_EXPRESSION_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (path[path.length - 1] === 'expr' ? 'regex' : undefined),
};

// InfluxQL multi-value tags use =~ with a regex. InfluxDB SQL mode still prefers warm
// delegate or an explicit ${var:sqlstring}; this fallback only covers the query field.
const INFLUXQL_QUERY_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (path[path.length - 1] === 'query' ? 'regex' : undefined),
};

const SQL_QUERY_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (path[path.length - 1] === 'rawSql' ? 'sqlstring' : undefined),
};

const CSV_QUERY_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (['query', 'rawQuery'].includes(path[path.length - 1]) ? 'csv' : undefined),
};

// OpenTSDB literal_or filters expect pipe-separated values in the filter field.
const OPENTSDB_PIPE_ADAPTER: FallbackFormatAdapter = {
  formatForPath: (path) => (path[path.length - 1] === 'filter' ? 'pipe' : undefined),
};

const DATASOURCE_TYPE_FORMAT_ADAPTERS = new Map<string, FallbackFormatAdapter>([
  ['elasticsearch', LUCENE_QUERY_ADAPTER],
  ['grafana-opensearch-datasource', LUCENE_QUERY_ADAPTER],
  ['prometheus', REGEX_EXPRESSION_ADAPTER],
  ['loki', REGEX_EXPRESSION_ADAPTER],
  ['mysql', SQL_QUERY_ADAPTER],
  // Grafana 9 uses the legacy core ID; Grafana 10–13 use the plugin ID.
  ['postgres', SQL_QUERY_ADAPTER],
  ['grafana-postgresql-datasource', SQL_QUERY_ADAPTER],
  ['mssql', SQL_QUERY_ADAPTER],
  ['marcusolsson-csv-datasource', CSV_QUERY_ADAPTER],
  ['influxdb', INFLUXQL_QUERY_ADAPTER],
  ['opentsdb', OPENTSDB_PIPE_ADAPTER],
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveFallbackFormatAdapter(
  datasourceType: string | undefined
): FallbackFormatAdapter | undefined {
  if (!datasourceType) {
    return undefined;
  }
  return DATASOURCE_TYPE_FORMAT_ADAPTERS.get(datasourceType.toLowerCase());
}

function stringifyVariableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function formatMultiValueFallback(value: unknown[], format: VariableFormat): string {
  const values = value.map(stringifyVariableValue);
  switch (format) {
    case 'csv':
      return values.join(',');
    case 'pipe':
      return values.join('|');
    case 'lucene':
      return `(${values
        .map((item) => `"${item.replace(/([+\-=&|><!(){}[\]^"~*?:\\/])/g, '\\$1')}"`)
        .join(' OR ')})`;
    case 'regex':
      return `(${values.map((item) => _.escapeRegExp(item)).join('|')})`;
    case 'sqlstring':
      return values.map((item) => `'${item.replace(/'/g, "''")}'`).join(',');
  }
}

export function createMultiValueFormatter(format: VariableFormat, scopedVars: ScopedVars) {
  return (value: unknown, variable: unknown): string => {
    const variableName = isPlainObject(variable) ? Reflect.get(variable, 'name') : undefined;
    const scopedVar = typeof variableName === 'string' ? scopedVars[variableName] : undefined;
    const scopedValue = isPlainObject(scopedVar) ? Reflect.get(scopedVar, 'value') : undefined;
    const effectiveValue = Array.isArray(scopedValue) ? scopedValue : value;

    return Array.isArray(effectiveValue) && effectiveValue.length > 1
      ? formatMultiValueFallback(effectiveValue, format)
      : stringifyVariableValue(Array.isArray(effectiveValue) ? effectiveValue[0] : effectiveValue);
  };
}
