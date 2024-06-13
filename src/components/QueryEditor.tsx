import React, { ChangeEvent, useEffect, useState } from 'react';
import _ from 'lodash';
import { InlineField, InlineFieldRow, HorizontalGroup, InlineSwitch } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { MyDataSourceOptions, MyQuery } from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

// TODO: 按照原来的调整-添加初始化支持
export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  // @ts-ignore
  const [errors] = useState<any>({});
  const [target, setTarget] = useState<any>({
    timeShifts: [],
    process: true,
  });

  const aliasTypes = ['suffix', 'prefix', 'absolute'];

  useEffect(() => {
    // custom codes
    if (!target || !target.timeShifts) {
      setTarget({
        timeShifts: [],
      });
    }
    if (target.timeShifts.length === 0) {
      addTimeShifts();
    }
    if (typeof target.process === 'undefined') {
      setTarget({
        process: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // @ts-ignore
  const onQueryInfoChange = (value: any, sourceKey: string) => {
    // set target
    setTarget({
      ...target,
      [sourceKey]: value,
    });

    onChange({ ...query, target });

    // executes the query
    onRunQuery();
  };

  // 统一封装 timeShift 单条内容变更处理
  const onTimeShiftStateChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>, sourceLine: Record<string, any>, sourceKey: string) => {
    const changedTimeShift = target.timeShifts.map((item: any)=> {
      if (item.id === sourceLine.id) {
        return {
          ...item,
          [sourceKey]: event.target.value,
        };
      } else {
        return item;
      }
    });

    setTarget({
      ...target,
      timeShifts: changedTimeShift,
    });
  };

  // timeShift amount change event
  const onTimeShiftChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>, sourceLine: Record<string, any>, sourceKey: string) => {
    onTimeShiftStateChange(event, sourceLine, sourceKey);

    console.log('>>>> origin query', query);
    console.log('>>> current target', target, event.target.value);

    onChange({ ...query, target });

    // executes the query
    onRunQuery();
  };

  // @ts-ignore
  const onChangeInternal = () => {
    onRunQuery();
  };

  const addTimeShifts = () => {
    let id = getTimeShiftId();
    setTarget({
      ...target,
      timeShifts: [
        ...target.timeShifts,
        {id: id},
      ]
    });
  };

  // remove timeShift row
  const removeTimeShift = (timeShift: number) => {
    if (target.timeShifts && target.timeShifts.length <= 1) {
      return;
    }

    const index = _.indexOf(target.timeShifts, timeShift);

    setTarget({
      ...target,
      timeShifts: target.timeShifts.splice(index, 1)
    });

    refreshTimeShifts();
  };

  const refreshTimeShifts = () => {
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
              onBlur={e => onQueryInfoChange(e.target.value, 'query')}
            />

            <InlineField label="Process TimeShift" className='width-12'>
              <InlineSwitch value={target.process} onChange={e => onQueryInfoChange(e.currentTarget.checked, 'process')} />
            </InlineField>

          </div>
        </InlineFieldRow>
      </div>

      <HorizontalGroup>
        <InlineFieldRow>

          {
            target.timeShifts.map((timeShift: any) => {
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
                    onChange={e => onTimeShiftChange(e, timeShift, 'value')}
                    onBlur={e => onTimeShiftChange(e, timeShift, 'value')}
                  />

                  <span className="gf-form-label width-4">alias</span>
                  <input
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="auto"
                    value={timeShift.alias}
                    onChange={e => onTimeShiftChange(e, timeShift, 'alias')}
                    onBlur={e => onTimeShiftChange(e, timeShift, 'alias')}
                  />

                  <span className="gf-form-label width-6">alias type</span>
                  <div className="gf-form-select-wrapper">
                    <select className="gf-form-input" defaultValue={'suffix'} value={timeShift.aliasType || 'suffix'} name={timeShift.aliasType || 'suffix'} onChange={e => onTimeShiftChange(e, timeShift, 'aliasType')} >
                      {aliasTypes.map(val => (<option value={val} key={val}>{val}</option>))}
                    </select>
                  </div>

                  <span className="gf-form-label width-4" title="only valid when alias type is suffix or prefix">delimiter</span>
                  <input disabled={timeShift.aliasType === 'absolute'}
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="default:_"
                    value={timeShift.delimiter}
                    onChange={e => onTimeShiftChange(e, timeShift, 'delimiter')}
                    onBlur={e => onTimeShiftChange(e, timeShift, 'delimiter')}
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
