import React, { ChangeEvent, useRef } from 'react';
import _ from 'lodash';
import defaults from 'lodash/defaults';
import { InlineField, InlineFieldRow, HorizontalGroup, InlineSwitch } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { CompareQueriesOptions, CompareQueriesQuery, defaultQuery } from '../types';

type Props = QueryEditorProps<DataSource, CompareQueriesQuery, CompareQueriesOptions>;

interface TimeShiftLineOptions {
  jsonData: {
    id: number | string,
  } & Record<string, any>;
}

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const lastRunValueRef = useRef<Record<string, any> | null>(null);

  const aliasTypes = ['suffix', 'prefix', 'absolute'];
  let target: Record<string, any> = defaults(query, defaultQuery);

  // Query refId change event
  const onQueryRefChange = (event: ChangeEvent<HTMLInputElement>) => {
    target.query = event.target.value;
  };

  /**
   * Event handler for process status change
   *
   * @param {ChangeEvent<any>} event
   */
  const onProcessChange = (event: ChangeEvent<any>) => {
    target.process = event.target.checked;

    onChange({ ...query, ...target });
    onRunQuery();
  };

  /**
   * TimeShift line field change event handler
   * 
   * @param {string} key timeShift line input field
   * @param {TimeShiftLineOptions} timeShiftLine 对应的timeShift line 编辑查询配置
   */
  const onChangeHandler = (key: string, timeShiftLine: TimeShiftLineOptions) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { jsonData: { id: sourceLineId = '' } = {} } = timeShiftLine || {};
    const changedTimeShift = target.timeShifts.map((item: any)=> {
      if (item.id === sourceLineId) {
        return {
          ...item,
          [key]: event.target.value,
        };
      } else {
        return item;
      }
    });

    target.timeShifts = changedTimeShift;

    onChange({ ...query, ...target });
  };

  /**
   * Handle runQuery event
   */
  const handleRunQuery = () => {
    lastRunValueRef.current = target;

    onChange({ ...query, ...target });
    onRunQuery();
  };

  /**
   * Run query when onBlur event triggered, while with object equality check
   */
  const handleBlur = () => {
    if (!_.isEqual(target, lastRunValueRef.current)) {
      handleRunQuery();
    }
  };

  /**
   * Add timeShift line
   */
  const addTimeShifts = () => {
    let id = getTimeShiftId();
    target.timeShifts.push({ id });

    onChange({ ...query, ...target });
  };

  /**
   * Remove timeShift row, test ok
   * @param timeShift 
   * @returns 
   */
  const removeTimeShift = (timeShift: Record<string, any>) => {
    if (target.timeShifts && target.timeShifts.length <= 1) {
      return;
    }

    const timeShiftsUpdated = target.timeShifts.filter((item: any) =>
      item.id !== timeShift.id
    );

    target.timeShifts = timeShiftsUpdated;

    onChange({ ...query, ...target });
    onRunQuery();
  };

  const getTimeShiftId = () => {
    let id = 0;

    while (true) {
      let notExits = _.every(target.timeShifts, (timeShift) => {
        return timeShift.id !== id;
      });

      if (notExits) {
        return id;
      } else {
        id++;
      }
    }
  };

  return (
    <div>
      <div className="gf-form-inline">
        <InlineFieldRow>
          <div className="gf-form">
            <label className='gf-form-label query-keyword width-4'>
              Query
            </label>
            <input
              type="text"
              className="gf-form-input"
              spellCheck="false"
              value={target.query}
              placeholder="query"
              onChange={onQueryRefChange}
              onBlur={handleBlur}
            />

            <InlineField label="Process TimeShift" className='width-12'>
              <InlineSwitch value={target.process} onChange={onProcessChange}/>
            </InlineField>

          </div>
        </InlineFieldRow>
      </div>

      <HorizontalGroup>
        <InlineFieldRow>
          {
            target.timeShifts?.map((timeShift: any) => {
              return (
                <div className="gf-form" key={timeShift}>
                  <span className="gf-form-label">
                    <i className="fa fa-clock-o"></i>
                  </span>
                  <span className="gf-form-label width-6">Time shift</span>
                  <span className="gf-form-label width-4">Amount</span>

                  <input
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="1h"
                    value={timeShift.value}
                    onChange={onChangeHandler('value', { jsonData: timeShift })}
                    onBlur={handleBlur}
                  />

                  <span className="gf-form-label width-4">alias</span>
                  <input
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="auto"
                    value={timeShift.alias}
                    onChange={onChangeHandler('alias', { jsonData: timeShift })}
                    onBlur={handleBlur}
                  />

                  <span className="gf-form-label width-6">alias type</span>
                  <div className="gf-form-select-wrapper">
                    <select 
                    className="gf-form-input"
                    defaultValue={'suffix'}
                    value={timeShift.aliasType || 'suffix'}
                    onChange={onChangeHandler('aliasType', { jsonData: timeShift })}
                    onBlur={handleBlur}
                  >
                      {aliasTypes.map(val => (<option value={val} key={val}>{val}</option>))}
                    </select>
                  </div>

                  <span className="gf-form-label width-4" title="only valid when alias type is suffix or prefix">delimiter</span>
                  <input disabled={timeShift.aliasType === 'absolute'}
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="default:_"
                    value={timeShift.delimiter}
                    onChange={onChangeHandler('delimiter', { jsonData: timeShift })}
                    onBlur={handleBlur}
                  />

                  {
                    target.timeShifts.length > 1 && (<label className="gf-form-label">
                      <a className="pointer" onClick={() => removeTimeShift(timeShift)}>
                        <i className="fa fa-trash"></i>
                      </a>
                    </label>)
                  }
                </div>)
            })
          }
        </InlineFieldRow>

      </HorizontalGroup>

      <button
        className="btn btn-secondary gf-form-btn"
        onClick={addTimeShifts}
      >
        Add time shift
      </button>

    </div>
  );
}
