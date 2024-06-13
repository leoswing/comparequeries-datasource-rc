import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

enum AliasTypes {
  suffix = 'suffix',
  prefix = 'prefix',
  absolute = 'absolute',
}

export interface MyQuery extends DataQuery {
  queryText?: string;
  errors: any;
  query: any;
  target: any;
  aliasTypes: AliasTypes;
  units?: string[];
  process: boolean;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  aliasTypes: AliasTypes.suffix,
  units: ['y', 'M', 'w', 'd', 'h', 'm', 's'],
  process: true,
};

export interface DataPoint {
  Time: number;
  Value: number;
}

export interface DataSourceResponse {
  datapoints: DataPoint[];
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
  datasourceSrv?: string;
  $q?: string;
  templateSrv?: string;
  meta?: string | any;
  units?: string[];
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
