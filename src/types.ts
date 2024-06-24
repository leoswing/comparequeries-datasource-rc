import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface CompareQueriesQuery extends DataQuery {
  query: string;
  timeShifts: any[];
  aliasTypes: string[];
  units: string[];
  process: boolean;
}

export const defaultQuery: Partial<CompareQueriesQuery> = {
  aliasTypes: ['suffix', 'prefix', 'absolute'],
  units: ['y', 'M', 'w', 'd', 'h', 'm', 's'],
  timeShifts: [{ id: 0 }],
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
 * These are options configured for each DataSource config instance
 */
export interface CompareQueriesOptions extends DataSourceJsonData {
  timeInterval?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface CompareQueriesJsonData {
  apiKey?: string;
}
