import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  getFieldDisplayName,
  DataFrame,
  FieldType,
  Field,
} from '@grafana/data';
import { getDataSourceSrv, DataSourceSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { CompareQueriesQuery, CompareQueriesOptions } from './types';
import _ from 'lodash';
// eslint-disable-next-line no-restricted-imports
import moment from 'moment';
import { TIMESHIFT_FORMAT_REG } from './config';

export class DataSource extends DataSourceApi<CompareQueriesQuery, CompareQueriesOptions> {
  id: number;
  datasourceSrv: DataSourceSrv;
  templateSrv: TemplateSrv;
  meta: any;
  units = ['y', 'M', 'w', 'd', 'h', 'm', 's'];

  constructor(instanceSettings: DataSourceInstanceSettings<CompareQueriesOptions>) {
    super(instanceSettings);

    this.id = instanceSettings.id;
    this.meta = instanceSettings.meta;
    this.datasourceSrv = getDataSourceSrv();
    this.templateSrv = getTemplateSrv();
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

    const baseQuery = this._normalizeTargetQueryJSON(target.targetQueryJSON);
    if (baseQuery === null) {
      console.warn('CompareQueries: targetQueryJSON is not valid JSON', target.targetQueryJSON);
      return { data: [] };
    }

    const shifts: any[] = Array.isArray(target.timeShifts) && target.timeShifts.length > 0
      ? target.timeShifts
      : [{ id: 0 }];

    const shiftPromises = shifts.map((ts: any, idx: number) =>
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

    if (isShifted) {
      const alias = this.templateSrv.replace(ts.alias, options.scopedVars) || shiftValue;
      const aliasType = ts.aliasType || 'suffix';
      const delimiter = ts.delimiter || '_';
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
    } else if (line.fields) {
      // New data frame format
      line.fields.forEach((field: Record<string, any>) => {
        if (field.name) {
          const valueFieldName = this.getValueFieldName(line);
          const inputName = field.type === FieldType.number && valueFieldName ? valueFieldName : field.name;
          if (field.type === FieldType.number) {
            field.name = this.generalAlias(inputName, alias, aliasType, delimiter);
          }
        }
        if (field.config && field.config.displayName) {
          field.config.displayName = this.generalAlias(field.config.displayName, alias, aliasType, delimiter);
        }
        if (field.config && field.config.displayNameFromDS) {
          field.config.displayNameFromDS = this.generalAlias(field.config.displayNameFromDS, alias, aliasType, delimiter);
        }
      });
    } else if (line.columns) {
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
      const unshiftedTimeField = line.fields.find((field: Record<string, any>) => field.type === 'time');
      if (unshiftedTimeField) {
        const timeField: Field = {
          name: unshiftedTimeField.name,
          type: unshiftedTimeField.type,
          config: unshiftedTimeField.config || {},
          labels: unshiftedTimeField.labels,
          values: [],
        };
        for (let i = 0; i < line.length; i++) {
          const v: any = typeof unshiftedTimeField.values?.get === 'function'
            ? unshiftedTimeField.values.get(i)
            : unshiftedTimeField.values?.[i];
          timeField.values[i] = v + shiftMs;
        }
        line.fields[0] = timeField;
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
            let delimiter = timeShift.delimiter || '_';

            let comparePromise = _this.datasourceSrv
              .get(compareDsName)
              .then((compareDs: any) => {
                if (compareDs.meta.id === _this.meta.id) {
                  return { data: [] };
                }

                timeShiftValue = _this.templateSrv.replace(timeShift.value, options.scopedVars);
                timeShiftAlias = _this.templateSrv.replace(timeShift.alias, options.scopedVars) || timeShiftValue;

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

  addTimeShift(time: any, timeShift: number) {
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

  async testDatasource() {
    return {
      status: 'success',
      message: 'Compare Query Source is working correctly',
    };
  }
}
