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
    let context = this;

    let sets = _.groupBy(options.targets, (ds: any) => {
      // Trying to maintain compatibility with grafana lower then 8.3.x
      if (ds.datasource.uid === undefined) {
        return ds.datasource;
      }

      return ds.datasource.uid;
    });

    let querys = _.groupBy(options.targets, 'refId');
    let promises: any[] = [];

    _.forEach(sets, (targets, dsName) => {
      let opt = _.cloneDeep(options);

      let promise = context.datasourceSrv.get(dsName).then((ds: any) => {
        if (ds.meta.id === context.meta.id) {
          return context._compareQuery(options, targets, querys, context);
        } else {
          opt.targets = targets;
          let result = ds.query(opt);

          return typeof result.toPromise === 'function' ? result.toPromise() : result;
        }
      });
      promises.push(promise);
    });

    let result = Promise.all(promises).then((results: any) => {
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

    return result;
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
                  if (line.target) {
                    // if old time series format
                    line.target = _this.generalAlias(line.target, timeShiftAlias, aliasType, delimiter);
                    typeof line.title !== 'undefined' &&
                      line.title !== null &&
                      (line.title = _this.generalAlias(line.title, timeShiftAlias, aliasType, delimiter));
                  } else if (line.fields) {
                    //else if new data frames format with multiple series
                    line.fields.forEach((field: Record<string, any>) => {
                      if (field.name) {
                        const valueFieldName = _this.getValueFieldName(line);
                        const inputName = field.type === FieldType.number && valueFieldName ? valueFieldName : field.name;
                        field.type === FieldType.number && (field.name = _this.generalAlias(inputName, timeShiftAlias, aliasType, delimiter));
                      }

                      if (field.config && field.config.displayName) {
                        field.config.displayName = _this.generalAlias(
                          field.config.displayName,
                          timeShiftAlias,
                          aliasType,
                          delimiter
                        );
                      }

                      if (field.config && field.config.displayNameFromDS) {
                        field.config.displayNameFromDS = _this.generalAlias(
                          field.config.displayNameFromDS,
                          timeShiftAlias,
                          aliasType,
                          delimiter
                        );
                      }
                    });
                  } else if (line.columns) {
                    // else if table. always skip first column for joins
                    for (let i = 1; i < line.columns.length; i++) {
                      let column = line.columns[i];
                      if (column.text) {
                        column.text = _this.generalAlias(column.text, timeShiftAlias, aliasType, delimiter);
                      }
                    }
                  }

                  if (target.process) {
                    let timeShift_ms = _this.parseShiftToMs(timeShiftValue);

                    if (line.type === 'table') {
                      if (line.rows) {
                        line.rows.forEach((row: any[]) => {
                          row[0] = row[0] + timeShift_ms;
                        });
                      }
                    } else {
                      if (line.datapoints) {
                        // if old time series format
                        line.datapoints.forEach((datapoint: any[]) => {
                          datapoint[1] = datapoint[1] + timeShift_ms;
                        });
                      } else if (line.fields && line.fields.length > 0) {
                        //else if new data frames format
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
                            timeField.values[i] = unshiftedTimeField.values.get(i) + timeShift_ms;
                          }
                          line.fields[0] = timeField;
                        }
                      }
                    }
                  }

                  line.hide = target.hide;
                });
                return {
                  data,
                };
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
