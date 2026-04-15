import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface CompareQueriesQuery extends DataQuery {
  query: string;
  timeShifts: any[];
  aliasTypes: string[];
  units: string[];
  process: boolean;

  /** Target datasource UID — required for backend/alerting mode */
  datasourceUid?: string;
  /** Target datasource type (e.g. "prometheus") — used by backend proxy */
  datasourceType?: string;
  /** Full query JSON to send to the target datasource in backend mode */
  targetQueryJSON?: Record<string, any>;
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
  /** Grafana instance URL for backend proxy queries (e.g. http://localhost:3000) */
  grafanaUrl?: string;
}

/**
 * Secure values stored encrypted by Grafana, never sent to the frontend in plain text
 */
export interface CompareQueriesJsonData {
  apiKey?: string;
  /** Service account token for authenticating backend proxy requests to Grafana API */
  serviceAccountToken?: string;
}
