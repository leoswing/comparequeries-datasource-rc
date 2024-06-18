import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface CompareQueriesQuery extends DataQuery {
  query: any;
  target: any;
  aliasTypes: string[];
  units: string[];
}

export const DEFAULT_QUERY: Partial<CompareQueriesQuery> = {
  aliasTypes: ['suffix', 'prefix', 'absolute'],
  units: ['y', 'M', 'w', 'd', 'h', 'm', 's'],
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
export interface CompareQueriesOptions extends DataSourceJsonData {
  meta?: string | any;
  units?: string[];
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface CompareQueriesJsonData {
  apiKey?: string;
}
