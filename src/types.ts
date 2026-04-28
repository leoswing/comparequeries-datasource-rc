import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface CompareQueriesQuery extends DataQuery {
  /**
   * @deprecated since 2.1.0 — Legacy refId reference (Mixed panel datasource only).
   * When set together with a Mixed panel, the plugin looks up the sibling query with this refId
   * and runs IT for each timeShift entry. Kept for backward compatibility with pre-Grafana 13
   * dashboards. New queries should use `datasourceUid` + `targetQueryJSON` instead — see below.
   */
  query: string;
  timeShifts: any[];
  aliasTypes: string[];
  units: string[];
  process: boolean;

  /**
   * UID of the real datasource this CompareQueries row should proxy to.
   * Required for the self-contained flow (Grafana 13+ panels + alerting). When set together with
   * `targetQueryJSON`, the frontend `_runSelfContained` and the backend `QueryData` both run the
   * payload against this datasource for every entry in `timeShifts` (empty value = base series).
   */
  datasourceUid?: string;
  /** Target datasource type (e.g. "prometheus"). Optional — Grafana resolves it from the UID. */
  datasourceType?: string;
  /**
   * Query payload sent to the target datasource. Maintained by the embedded native QueryEditor
   * inside our QueryEditor (PromQL builder, ES bucket aggs, LogQL, SQL, etc.) — Grafana-injected
   * fields (`refId`, `datasource`, `key`, `hide`) are stripped on save and re-injected on dispatch.
   */
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
