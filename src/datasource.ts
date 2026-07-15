import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  getFieldDisplayName,
  DataFrame,
  FieldType,
  Field,
  ScopedVars,
  AdHocVariableFilter,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  MetricFindValue,
} from '@grafana/data';
import { getDataSourceSrv, DataSourceSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { CompareQueriesQuery, CompareQueriesOptions } from './types';
import _ from 'lodash';
// eslint-disable-next-line no-restricted-imports
import moment from 'moment';
import { TIMESHIFT_FORMAT_REG } from './config';

const RESERVED_TARGET_QUERY_FIELDS = new Set(['refId', 'datasource', 'key', 'hide']);
const TARGET_QUERY_INTERPOLATION = Symbol('compareQueriesTargetInterpolation');

type TargetInterpolationMode = 'delegated' | 'fallback';

interface TemplateVariableDelegate {
  applyTemplateVariables(
    query: Record<string, unknown>,
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): unknown;
}

interface TargetInterpolationOptions {
  datasourceUid?: string;
  refId?: string;
  delegate?: unknown;
  filters?: AdHocVariableFilter[];
}

interface TargetInterpolationResult {
  query: Record<string, any>;
  mode: TargetInterpolationMode;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function supportsTemplateVariableDelegation(value: unknown): value is TemplateVariableDelegate {
  return isPlainObject(value) && typeof Reflect.get(value, 'applyTemplateVariables') === 'function';
}

function getLoadedTemplateVariableDelegate(
  datasourceSrv: DataSourceSrv,
  uid: string
): TemplateVariableDelegate | undefined {
  // ExpressionDatasource loads all source datasources before synchronously interpolating them.
  // Grafana's public DataSourceSrv.get() is async, so use its already-loaded instance registry
  // to bridge that synchronous API boundary. Fall back safely if Grafana changes the registry.
  const loadedDatasources = Reflect.get(datasourceSrv, 'datasources');
  if (!isPlainObject(loadedDatasources)) {
    return undefined;
  }

  const datasource = loadedDatasources[uid];
  return supportsTemplateVariableDelegation(datasource) ? datasource : undefined;
}

function getTargetInterpolationMode(value: unknown): TargetInterpolationMode | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const mode = Reflect.get(value, TARGET_QUERY_INTERPOLATION);
  return mode === 'delegated' || mode === 'fallback' ? mode : undefined;
}

export class DataSource extends DataSourceApi<CompareQueriesQuery, CompareQueriesOptions> {
  id: number;
  datasourceSrv: DataSourceSrv;
  templateSrv: TemplateSrv;
  meta: any;
  units = ['y', 'M', 'w', 'd', 'h', 'm', 's'];

  // QueryEditor and query execution both resolve target datasource instances. Keep only the
  // interpolation capability here so synchronous backend/expression preparation can delegate.
  private _targetDsCache = new Map<string, TemplateVariableDelegate>();

  constructor(instanceSettings: DataSourceInstanceSettings<CompareQueriesOptions>) {
    super(instanceSettings);

    this.id = instanceSettings.id;
    this.meta = instanceSettings.meta;
    this.datasourceSrv = getDataSourceSrv();
    this.templateSrv = getTemplateSrv();
  }

  registerTargetDatasource(uid: string, datasource: unknown): void {
    if (supportsTemplateVariableDelegation(datasource)) {
      this._targetDsCache.set(uid, datasource);
    }
  }

  // Grafana calls this before backend QueryData (expressions / alerting). Delegate target query
  // interpolation when the native datasource instance is available; otherwise use Grafana's
  // default glob formatting without maintaining datasource-specific rules in this plugin.
  applyTemplateVariables(
    query: CompareQueriesQuery,
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): CompareQueriesQuery {
    return this._applyTemplateVariables(query, scopedVars, filters);
  }

  interpolateVariablesInQueries(
    queries: CompareQueriesQuery[],
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): CompareQueriesQuery[] {
    // Grafana expressions call this method before forwarding queries to backend QueryData.
    // Therefore an unavailable delegate must still use the default glob fallback.
    return queries.map((query) => this._applyTemplateVariables(query, scopedVars, filters));
  }

  private _applyTemplateVariables(
    query: CompareQueriesQuery,
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): CompareQueriesQuery {
    const next: CompareQueriesQuery = { ...query };

    if (query.targetQueryJSON !== undefined) {
      const interpolation = this._prepareTargetQueryJSON(
        query.targetQueryJSON,
        scopedVars,
        {
          datasourceUid: query.datasourceUid,
          refId: query.refId,
          filters,
        }
      );
      if (interpolation !== null) {
        next.targetQueryJSON = interpolation.query;
        Object.defineProperty(next, TARGET_QUERY_INTERPOLATION, {
          value: interpolation.mode,
          enumerable: true,
        });
      }
    }

    if (Array.isArray(query.timeShifts)) {
      next.timeShifts = query.timeShifts.map((ts) => ({
        ...ts,
        value: this.templateSrv.replace(ts?.value ?? '', scopedVars),
        alias: this.templateSrv.replace(ts?.alias ?? '', scopedVars),
        delimiter: this.templateSrv.replace(ts?.delimiter ?? '', scopedVars),
      }));
    }

    return next;
  }

  getValueFieldName(line: DataFrame) {
    try {
      const valueField = line.fields?.find((field: any) => field.type === FieldType.number);
      const valueFieldName = valueField && getFieldDisplayName(valueField, line);
  
      return valueFieldName;
    } catch (error) {
      console.warn('Failed to execute getValueFieldName:', error);

      return '';
    }
  }

  // Called once per panel (graph)
  async query(options: DataQueryRequest<CompareQueriesQuery>): Promise<DataQueryResponse> {
    // Split targets into two flows:
    //   - self-contained (Grafana 13+): target carries its own datasourceUid + targetQueryJSON.
    //     Each target produces N frames where N = len(timeShifts), no cross-target refId reference.
    //   - legacy (Grafana <=12 / Mixed panels): target.datasource per-row routing with refId-based
    //     compare lookup. Preserved for backward compatibility.
    const selfContainedTargets: any[] = [];
    const legacyTargets: any[] = [];

    for (const target of options.targets as any[]) {
      if (target.hide) {
        continue;
      }
      if (this._isSelfContained(target)) {
        selfContainedTargets.push(target);
      } else {
        legacyTargets.push(target);
      }
    }

    const promises: Array<Promise<any>> = [];

    for (const target of selfContainedTargets) {
      promises.push(this._runSelfContained(options, target));
    }

    if (legacyTargets.length > 0) {
      promises.push(this._runLegacy({ ...options, targets: legacyTargets }));
    }

    const results = await Promise.all(promises);

    return {
      data: _.flatten(
        _.filter(
          _.map(results, (result: any) => {
            let data = result?.data;
            if (data) {
              data = _.filter(data, (datum: any) => datum.hide !== true);
            }
            return data;
          }),
          (data) => data !== undefined && data !== null
        )
      ),
    };
  }

  // A target is self-contained when it has a target datasource + payload, so it doesn't need
  // a sibling refId-referenced target to know what to query.
  _isSelfContained(target: any): boolean {
    if (!target?.datasourceUid) {
      return false;
    }
    const payload = target.targetQueryJSON;
    if (payload === undefined || payload === null) {
      return false;
    }
    if (typeof payload === 'string') {
      return payload.trim() !== '';
    }
    if (typeof payload === 'object') {
      return Object.keys(payload).length > 0;
    }
    return false;
  }

  // Legacy flow (pre-Grafana 13 / Mixed panels): groups targets by per-row datasource and either
  // dispatches directly to that datasource or runs the cross-target compare lookup.
  async _runLegacy(options: DataQueryRequest<any>): Promise<any> {
    const context = this;

    const sets = _.groupBy(options.targets, (ds: any) => {
      // Trying to maintain compatibility with grafana lower then 8.3.x
      if (ds.datasource?.uid === undefined) {
        return ds.datasource;
      }
      return ds.datasource.uid;
    });

    const querys = _.groupBy(options.targets, 'refId');
    const promises: any[] = [];

    _.forEach(sets, (targets, dsName) => {
      const opt = _.cloneDeep(options);

      const promise = context.datasourceSrv.get(dsName).then((ds: any) => {
        if (ds.meta.id === context.meta.id) {
          return context._compareQuery(options, targets, querys, context);
        } else {
          opt.targets = targets;
          const result = ds.query(opt);
          return typeof result.toPromise === 'function' ? result.toPromise() : result;
        }
      });
      promises.push(promise);
    });

    const results = await Promise.all(promises);
    return {
      data: _.flatten(
        _.filter(
          _.map(results, (result: any) => {
            let data = result?.data;
            if (data) {
              data = _.filter(data, (datum: any) => datum.hide !== true);
            }
            return data;
          }),
          (data) => data !== undefined && data !== null
        )
      ),
    };
  }

  // Self-contained flow (Grafana 13+ compatible): each target carries its own datasourceUid +
  // targetQueryJSON, plus a list of timeShifts. We run one query per timeShift entry against the
  // target datasource, applying alias/process per shift. An empty timeShift value means "no shift"
  // (run the original time window) so a single target can produce both base and compare series.
  async _runSelfContained(options: DataQueryRequest<any>, target: any): Promise<any> {
    let ds: any;
    try {
      ds = await this.datasourceSrv.get({ uid: target.datasourceUid });
    } catch (err) {
      console.warn('CompareQueries: failed to resolve target datasource', target.datasourceUid, err);
      return { data: [] };
    }

    if (!ds || ds.meta?.id === this.meta.id) {
      return { data: [] };
    }

    this.registerTargetDatasource(target.datasourceUid, ds);

    const previousInterpolation = getTargetInterpolationMode(target);
    const baseQuery = previousInterpolation === 'delegated'
      ? this._normalizeTargetQueryJSON(target.targetQueryJSON)
      : this._prepareTargetQueryJSON(
          target.targetQueryJSON,
          options.scopedVars,
          {
            datasourceUid: target.datasourceUid,
            refId: target.refId,
            delegate: ds,
            filters: options.filters,
          }
        )?.query ?? null;
    if (baseQuery === null) {
      console.warn('CompareQueries: targetQueryJSON is not valid JSON', target.targetQueryJSON);
      return { data: [] };
    }

    const shifts: any[] = Array.isArray(target.timeShifts) && target.timeShifts.length > 0
      ? target.timeShifts
      : [{ id: 0 }];
    const hasValidShift = shifts.some((ts: any) => {
      const resolved = this.templateSrv.replace(ts?.value ?? '', options.scopedVars).trim();
      return !!resolved && TIMESHIFT_FORMAT_REG.test(resolved);
    });
    const effectiveShifts = hasValidShift
      ? shifts.filter((ts: any) => {
          const resolved = this.templateSrv.replace(ts?.value ?? '', options.scopedVars).trim();
          return TIMESHIFT_FORMAT_REG.test(resolved);
        })
      : shifts;

    const shiftPromises = effectiveShifts.map((ts: any, idx: number) =>
      this._runOneShift(ds, options, target, baseQuery, ts, idx)
    );

    const shiftResults = await Promise.all(shiftPromises);

    return {
      data: _.flatten(
        _.map(shiftResults, (r: any) => (r && r.data ? r.data : []))
      ),
    };
  }

  _normalizeTargetQueryJSON(payload: any): Record<string, any> | null {
    if (payload === undefined || payload === null) {
      return null;
    }
    if (typeof payload === 'object') {
      return _.cloneDeep(payload);
    }
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      if (trimmed === '') {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    return null;
  }

  _stripReservedTargetQueryFields(payload: Record<string, unknown>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of Object.keys(payload)) {
      if (!RESERVED_TARGET_QUERY_FIELDS.has(key)) {
        out[key] = payload[key];
      }
    }
    return out;
  }

  // Interpolate targetQueryJSON by delegating to the target datasource when possible.
  // If no delegate exists, fallback uses TemplateSrv without a format so Grafana applies glob.
  _interpolateTargetQueryJSON(
    payload: Record<string, any> | string | undefined | null,
    scopedVars: ScopedVars,
    options: TargetInterpolationOptions = {}
  ): Record<string, any> | null {
    return this._prepareTargetQueryJSON(payload, scopedVars, options)?.query ?? null;
  }

  private _prepareTargetQueryJSON(
    payload: Record<string, any> | string | undefined | null,
    scopedVars: ScopedVars,
    options: TargetInterpolationOptions
  ): TargetInterpolationResult | null {
    const normalized = this._normalizeTargetQueryJSON(payload);
    if (normalized === null) {
      return null;
    }

    const delegate = supportsTemplateVariableDelegation(options.delegate)
      ? options.delegate
      : options.datasourceUid
        ? this._targetDsCache.get(options.datasourceUid) ??
          getLoadedTemplateVariableDelegate(this.datasourceSrv, options.datasourceUid)
        : undefined;

    if (delegate && options.datasourceUid) {
      this._targetDsCache.set(options.datasourceUid, delegate);
    }

    if (delegate) {
      try {
        const fullQuery = {
          ...normalized,
          refId: options.refId || 'A',
          datasource: options.datasourceUid ? { uid: options.datasourceUid } : undefined,
        };
        const result = delegate.applyTemplateVariables(fullQuery, scopedVars, options.filters);
        if (isPlainObject(result)) {
          return {
            query: this._stripReservedTargetQueryFields(result),
            mode: 'delegated',
          };
        }
      } catch (err) {
        console.warn('CompareQueries: target applyTemplateVariables failed, using fallback', err);
      }
    }

    const interpolated = this._deepReplaceTemplateVars(normalized, scopedVars);
    return isPlainObject(interpolated)
      ? {
          query: this._stripReservedTargetQueryFields(interpolated),
          mode: 'fallback',
        }
      : null;
  }

  _deepReplaceTemplateVars(value: unknown, scopedVars: ScopedVars): unknown {
    if (typeof value === 'string') {
      if (!value.includes('$')) {
        return value;
      }
      return this.templateSrv.replace(value, scopedVars);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this._deepReplaceTemplateVars(item, scopedVars));
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          this._deepReplaceTemplateVars(nested, scopedVars),
        ])
      );
    }

    return value;
  }

  async _runOneShift(
    ds: any,
    options: DataQueryRequest<any>,
    target: any,
    baseQuery: Record<string, any>,
    ts: any,
    idx: number
  ): Promise<any> {
    const rawShiftValue: string = ts?.value ?? '';
    const shiftValue = this.templateSrv.replace(rawShiftValue, options.scopedVars);
    const isShifted = !!shiftValue && TIMESHIFT_FORMAT_REG.test(shiftValue);

    const queryRange = isShifted
      ? this._buildShiftedRange(options.range, shiftValue)
      : options.range;

    if (isShifted && !queryRange) {
      return { data: [] };
    }

    const shiftSuffix = isShifted ? `_${shiftValue}` : '';
    const queryRefId = `${target.refId}${shiftSuffix}`;
    const requestId = `${options.requestId}_sc_${idx}${shiftSuffix || '_orig'}`;

    const queryPayload = {
      ..._.cloneDeep(baseQuery),
      refId: queryRefId,
      datasource: { uid: target.datasourceUid },
    };

    const queryOptions: any = {
      ..._.cloneDeep(options),
      range: queryRange,
      rangeRaw: queryRange.raw,
      targets: [queryPayload],
      requestId,
    };

    let result: any;
    try {
      const r = ds.query(queryOptions);
      result = await (typeof r.toPromise === 'function' ? r.toPromise() : r);
    } catch (err) {
      console.warn('CompareQueries: target datasource query failed', { shift: shiftValue, err });
      return { data: [] };
    }

    if (!result?.data) {
      return { data: [] };
    }

    // Some datasources (for example CSV) can ignore query range and return full history.
    // Enforce range filtering here so legend/reduce calcs are based on the intended shifted window.
    if (queryRange?.from && queryRange?.to) {
      result.data.forEach((line: any) => {
        this._filterLineByRange(line, queryRange.from, queryRange.to);
      });
    }

    if (isShifted) {
      const alias = this.templateSrv.replace(ts.alias, options.scopedVars) || shiftValue;
      const aliasType = ts.aliasType || 'suffix';
      const delimiter = this.templateSrv.replace(ts.delimiter ?? '', options.scopedVars) || '_';
      const shiftMs = target.process ? this.parseShiftToMs(shiftValue) : undefined;

      result.data.forEach((line: any) => {
        this._applyAliasToFrame(line, alias, aliasType, delimiter);
        if (target.process && shiftMs !== undefined) {
          this._shiftFrameTimestampsBack(line, shiftMs);
        }
        line.hide = target.hide;
      });
    } else {
      result.data.forEach((line: any) => {
        line.hide = target.hide;
      });
    }

    return result;
  }

  _filterLineByRange(line: any, from: any, to: any): void {
    const fromMs = this._toEpochMs(from);
    const toMs = this._toEpochMs(to);
    if (fromMs === undefined || toMs === undefined) {
      return;
    }

    if (line.datapoints && Array.isArray(line.datapoints)) {
      line.datapoints = line.datapoints.filter((datapoint: any[]) => {
        const ts = this._toEpochMs(datapoint?.[1]);
        return ts !== undefined && ts >= fromMs && ts <= toMs;
      });
      return;
    }

    if (line.fields && Array.isArray(line.fields) && line.fields.length > 0) {
      const timeField = line.fields.find((field: Record<string, any>) => field.type === FieldType.time);
      if (!timeField) {
        return;
      }

      const len = this._getFieldValuesLength(timeField, line.length, line.fields);
      const keepIndexes: number[] = [];

      for (let i = 0; i < len; i++) {
        const value = this._getFieldValueAt(timeField, i);
        const ts = this._toEpochMs(value);
        if (ts !== undefined && ts >= fromMs && ts <= toMs) {
          keepIndexes.push(i);
        }
      }

      if (keepIndexes.length === len) {
        return;
      }

      line.fields = line.fields.map((field: Record<string, any>) => {
        const nextValues = keepIndexes.map((idx) => this._getFieldValueAt(field, idx));
        return {
          ...field,
          values: nextValues,
        };
      });
      line.length = keepIndexes.length;
      return;
    }

    if (line.type === 'table' && Array.isArray(line.rows)) {
      line.rows = line.rows.filter((row: any[]) => {
        const ts = this._toEpochMs(row?.[0]);
        return ts !== undefined && ts >= fromMs && ts <= toMs;
      });
    }
  }

  _getFieldValuesLength(field: any, fallbackLength?: number, allFields?: any[]): number {
    if (typeof field?.values?.length === 'number') {
      return field.values.length;
    }
    if (Array.isArray(field?.values)) {
      return field.values.length;
    }
    if (typeof field?.values?.toArray === 'function') {
      const arr = field.values.toArray();
      if (Array.isArray(arr)) {
        return arr.length;
      }
    }
    if (Array.isArray(field?.values?.buffer)) {
      return field.values.buffer.length;
    }
    if (Array.isArray(allFields) && allFields.length > 0) {
      for (const candidate of allFields) {
        if (typeof candidate?.values?.length === 'number') {
          return candidate.values.length;
        }
        if (Array.isArray(candidate?.values)) {
          return candidate.values.length;
        }
        if (typeof candidate?.values?.toArray === 'function') {
          const arr = candidate.values.toArray();
          if (Array.isArray(arr)) {
            return arr.length;
          }
        }
        if (Array.isArray(candidate?.values?.buffer)) {
          return candidate.values.buffer.length;
        }
      }
    }
    if (typeof fallbackLength === 'number') {
      return fallbackLength;
    }
    return 0;
  }

  _getFieldValueAt(field: any, index: number): any {
    return typeof field?.values?.get === 'function'
      ? field.values.get(index)
      : field?.values?.[index];
  }

  _toEpochMs(value: any): number | undefined {
    if (value === null || typeof value === 'undefined') {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    if (typeof value?.valueOf === 'function') {
      const ms = value.valueOf();
      if (typeof ms === 'number' && Number.isFinite(ms)) {
        return ms;
      }
    }

    return undefined;
  }

  _buildShiftedRange(range: any, shiftValue: string): any {
    const from = this.addTimeShift(range.from, shiftValue);
    const to = this.addTimeShift(range.to, shiftValue);
    if (from === undefined || to === undefined) {
      return undefined as any;
    }
    return {
      from,
      to,
      raw: { from, to },
    };
  }

  _applyAliasToFrame(line: any, alias: string, aliasType: string, delimiter: string): void {
    if (line.target) {
      // Old time series format
      line.target = this.generalAlias(line.target, alias, aliasType, delimiter);
      if (typeof line.title !== 'undefined' && line.title !== null) {
        line.title = this.generalAlias(line.title, alias, aliasType, delimiter);
      }
      return;
    }

    if (line.fields) {
      // Match backend applyAlias: keep frame.name, rename numeric field.name from the raw
      // field name (Value → Value_1d), and set displayNameFromDS to the final legend name.
      // Using getFieldDisplayName() as the rename input would bake frame.name into field.name
      // (test22_1d) and then Grafana Mixed panels concatenate again → "test22 test22_1d".
      line.fields.forEach((field: Record<string, any>) => {
        if (field.type === FieldType.time) {
          return;
        }

        if (field.name) {
          field.name = this.generalAlias(field.name, alias, aliasType, delimiter);
        }

        field.config = field.config || {};
        if (field.config.displayName) {
          field.config.displayName = this.generalAlias(field.config.displayName, alias, aliasType, delimiter);
        }

        if (line.name) {
          field.config.displayNameFromDS = this.generalAlias(line.name, alias, aliasType, delimiter);
        } else if (field.config.displayNameFromDS) {
          field.config.displayNameFromDS = this.generalAlias(
            field.config.displayNameFromDS,
            alias,
            aliasType,
            delimiter
          );
        } else if (field.name) {
          field.config.displayNameFromDS = field.name;
        }

        field.labels = { ...(field.labels || {}), timeshift: alias };
      });
      return;
    }

    if (line.columns) {
      // Table format — skip first column for joins
      for (let i = 1; i < line.columns.length; i++) {
        const column = line.columns[i];
        if (column.text) {
          column.text = this.generalAlias(column.text, alias, aliasType, delimiter);
        }
      }
    }
  }

  _shiftFrameTimestampsBack(line: any, shiftMs: number | undefined): void {
    if (shiftMs === undefined) {
      return;
    }
    if (line.type === 'table') {
      if (line.rows) {
        line.rows.forEach((row: any[]) => {
          row[0] = row[0] + shiftMs;
        });
      }
    } else if (line.datapoints) {
      // Old time series format
      line.datapoints.forEach((datapoint: any[]) => {
        datapoint[1] = datapoint[1] + shiftMs;
      });
    } else if (line.fields && line.fields.length > 0) {
      // New data frame format
      const timeFieldIndex = line.fields.findIndex((field: Record<string, any>) => field.type === 'time');
      if (timeFieldIndex >= 0) {
        const unshiftedTimeField = line.fields[timeFieldIndex];
        const timeField: Field = {
          name: unshiftedTimeField.name,
          type: unshiftedTimeField.type,
          config: unshiftedTimeField.config || {},
          labels: unshiftedTimeField.labels,
          values: [],
        };

        const valuesLength = this._getFieldValuesLength(unshiftedTimeField, line.length, line.fields);

        for (let i = 0; i < valuesLength; i++) {
          const v: any = typeof unshiftedTimeField.values?.get === 'function'
            ? unshiftedTimeField.values.get(i)
            : unshiftedTimeField.values?.[i];
          if (typeof v === 'number') {
            timeField.values[i] = v + shiftMs;
          } else {
            timeField.values[i] = v;
          }
        }
        line.fields[timeFieldIndex] = timeField;
      }
    }
  }

  _compareQuery(options: Record<string, any>, targets: any, querys: any, _this: DataSource) {
    let comparePromises: any[] = [];

    _.forEach(targets, (target) => {
      let query = target.query;

      if (query === null || query === '' || querys[query] === null || !query || !querys[query]) {
        return;
      }

      let queryObj = _.cloneDeep(querys[query][0]);
      queryObj.hide = false;

      if (queryObj) {
        let compareDsName = queryObj.datasource;

        if (target.timeShifts && target.timeShifts.length > 0) {
          _.forEach(target.timeShifts, (timeShift) => {
            let timeShiftValue: any;
            let timeShiftAlias: any;
            let aliasType = timeShift.aliasType || 'suffix';
            let delimiter = '_';

            let comparePromise = _this.datasourceSrv
              .get(compareDsName)
              .then((compareDs: any) => {
                if (compareDs.meta.id === _this.meta.id) {
                  return { data: [] };
                }
                timeShiftValue = _this.templateSrv.replace(timeShift.value, options.scopedVars);
                timeShiftAlias = _this.templateSrv.replace(timeShift.alias, options.scopedVars) || timeShiftValue;
                delimiter = _this.templateSrv.replace(timeShift.delimiter ?? '', options.scopedVars) || '_';

                if (timeShiftValue === null || timeShiftValue === '' || typeof timeShiftValue === 'undefined' || !TIMESHIFT_FORMAT_REG.test(timeShiftValue)) {
                  return { data: [] };
                }

                let compareOptions = _.cloneDeep(options);
                compareOptions.range.from = _this.addTimeShift(compareOptions.range.from, timeShiftValue);
                compareOptions.range.to = _this.addTimeShift(compareOptions.range.to, timeShiftValue);
                compareOptions.range.raw = {
                  from: compareOptions.range.from,
                  to: compareOptions.range.to,
                };
                compareOptions.rangeRaw = compareOptions.range.raw;

                queryObj.refId = queryObj.refId + '_' + timeShiftValue;
                compareOptions.targets = [queryObj];
                compareOptions.requestId = compareOptions.requestId + '_' + timeShiftValue;

                let compareResult = compareDs.query(compareOptions);
                return typeof compareResult.toPromise === 'function' ? compareResult.toPromise() : compareResult;
              })
              .then((compareResult: any) => {
                let data = compareResult.data;
                data.forEach((line: any) => {
                  _this._applyAliasToFrame(line, timeShiftAlias, aliasType, delimiter);
                  if (target.process) {
                    _this._shiftFrameTimestampsBack(line, _this.parseShiftToMs(timeShiftValue));
                  }
                  line.hide = target.hide;
                });
                return { data };
              });

            comparePromises.push(comparePromise);
          });
        }
      }
    });

    return Promise.all(comparePromises).then((results: any[]) => {
      return {
        data: _.flatten(
          _.filter(
            _.map(results, (result) => {
              let data = result.data;

              if (data) {
                data = _.filter(result.data, (datum) => {
                  return datum.hide !== true;
                });
              }

              return data;
            }),
            (result) => {
              return result !== undefined && result !== null;
            }
          )
        ),
      };
    });
  }

  generalAlias(original: string, alias: string, aliasType: string, delimiter: string | number) {
    switch (aliasType) {
      case 'prefix':
        return alias + delimiter + original;
      case 'absolute':
        return alias;
      case 'suffix':
      default:
        return original + delimiter + alias;
    }
  }

  parseShiftToMs(timeShift: any) {
    let timeShiftObj = this.parseTimeShift(timeShift);

    if (!timeShiftObj) {
      return;
    }

    let num = 0 - timeShiftObj.num;
    let unit = timeShiftObj.unit;

    if (!_.includes(this.units, unit)) {
      return undefined;
    } else {
      let curTime = moment();
      let shiftTime = curTime.clone().add(num, unit);

      return curTime.valueOf() - shiftTime.valueOf();
    }
  }
  parseTimeShift(timeShift: any) {
    let dateTime = timeShift;
    let len = timeShift.length;
    let i = 0;

    while (i < len && !isNaN(dateTime.charAt(i))) {
      i++;

      if (i > 10) {
        return undefined;
      }
    }
    let num = parseInt(dateTime.substring(0, i), 10);
    let unit = dateTime.charAt(i);

    return {
      num: num,
      unit: unit,
    };
  }

  addTimeShift(time: any, timeShift: string) {
    let timeShiftObj = this.parseTimeShift(timeShift);

    if (!timeShiftObj) {
      return;
    }

    let num = 0 - timeShiftObj.num;
    let unit = timeShiftObj.unit;

    if (!_.includes(this.units, unit)) {
      return undefined;
    } else {
      let curTime = time;
      let shiftTime = curTime.clone().add(num, unit);

      return shiftTime;
    }
  }

  // Grafana checks ds.getTagKeys to decide whether a datasource can back Ad hoc variables.
  // CompareQueries does not discover fields itself; use static key dimensions on the variable
  // and forward filters to the target datasource during query execution.
  async getTagKeys(_options?: DataSourceGetTagKeysOptions): Promise<MetricFindValue[]> {
    return [];
  }

  async getTagValues(_options: DataSourceGetTagValuesOptions): Promise<MetricFindValue[]> {
    return [];
  }

  async testDatasource() {
    return {
      status: 'success',
      message: 'Compare Query Source is working correctly',
    };
  }
}
