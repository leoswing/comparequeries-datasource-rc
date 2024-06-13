import React, { ChangeEvent, useEffect, useState, useCallback } from 'react';
import _ from 'lodash';
import { InlineField, Stack, InlineFormLabel, InlineFieldRow, HorizontalGroup, InlineSwitch } from '@grafana/ui';
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
  const [checked, setChecked] = useState(target.process);

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
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryText: event.target.value });
    // executes the query
    onRunQuery();
  };

  const onProcessChange = (e: ChangeEvent<HTMLInputElement>) => {
    setChecked(e.currentTarget.checked);

    targetBlur(e);
  };

  const targetBlur = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    console.log('>>> value', value);

    onChange({ ...query, queryText: event.target.value });

    onRunQuery();
  };

  // @ts-ignore
  const onChangeInternal = () => {
    onRunQuery();
  };

  // TODO： 更新使用对应id 的设置值， 使用filter 查找对应行
  const onChangeAliasType = (event: ChangeEvent<HTMLSelectElement>, sourceLine: any) => {
    const changedTimeShift = target.timeShifts.map((item: any)=> {
      if (item.id === sourceLine.id) {
        return {
          ...item,
          aliasType: event.target.value,
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
              value={target.query}
              placeholder="query"
              onBlur={targetBlur}
            />

            <InlineField label="Process TimeShift" className='width-12'>
              <InlineSwitch value={checked} onChange={onProcessChange} />
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
                    onChange={targetBlur}
                    onBlur={targetBlur}
                  />

                  <span className="gf-form-label width-4">alias</span>
                  <input
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="auto"
                    value={timeShift.alias}
                    onChange={targetBlur}
                    onBlur={targetBlur}
                  />

                  <span className="gf-form-label width-6">alias type</span>
                  <div className="gf-form-select-wrapper">
                    <select className="gf-form-input" defaultValue={'suffix'} value={timeShift.aliasType || 'suffix'} name={timeShift.aliasType || 'suffix'} onChange={e => onChangeAliasType(e, timeShift)} >
                      {aliasTypes.map(val => (<option value={val} key={val}>{val}</option>))}
                    </select>
                  </div>

                  <span className="gf-form-label width-4" title="only valid when alias type is suffix or prefix">delimiter</span>
                  <input disabled={timeShift.aliasType === 'absolute'}
                    type="text"
                    className="gf-form-input max-width-8"
                    placeholder="default:_"
                    value={timeShift.delimiter}
                    onChange={targetBlur}
                    onBlur={targetBlur}
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
