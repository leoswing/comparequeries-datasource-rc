import React, { ChangeEvent, useRef, FormEventHandler } from 'react';
import _ from 'lodash';
import defaults from 'lodash/defaults';
import { InlineField, InlineSwitch, Input, Select, Button, Icon, useStyles2 } from '@grafana/ui';
import { QueryEditorProps, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { DataSource } from '../datasource';
import { TIMESHIFT_FORMAT_REG, TIMESHIFT_VAR_FORMAT_REG } from '../config';
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

  const getStyles = (theme: GrafanaTheme2) => ({
    root: css({
      display: 'flex',
    }),
    addButton: css({
      padding: '0px 10px',
    }),
  });

  // Query refId change event
  const onQueryRefChange = (event: ChangeEvent<HTMLInputElement>) => {
    target.query = event.target.value;

    // fix input query ref change
    onChange({ ...query, ...target });
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
  const onChangeHandler = (key: string, timeShiftLine: TimeShiftLineOptions): FormEventHandler<any> | any => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const onAliasTypeChange = (value: string, timeShiftLine: TimeShiftLineOptions): FormEventHandler<any> | any => {
    const { jsonData: { id: sourceLineId = '' } = {} } = timeShiftLine || {};

    const changedTimeShift = target.timeShifts.map((item: any)=> {
      if (item.id === sourceLineId) {
        return {
          ...item,
          aliasType: value,
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

  const isInvalidAmount = (amountValue: string) => {
    return !TIMESHIFT_FORMAT_REG.test(amountValue) && !TIMESHIFT_VAR_FORMAT_REG.test(amountValue)
  };

  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.root}>
        <InlineField
          label='Query'
          className='query-keyword'
          labelWidth={8}
        >
          <Input
            spellCheck={false}
            placeholder='query'
            value={target.query}
            onChange={onQueryRefChange}
            onBlur={handleBlur}
          />
        </InlineField>

        <InlineField label="Process TimeShift" className='width-12'>
          <InlineSwitch value={target.process} onChange={onProcessChange}/>
        </InlineField>
      </div>

      <div>
        {
          target.timeShifts?.map((timeShift: any) => {
            return (
              <div className={styles.root} key={timeShift}>
                <span className="gf-form-label width-6"><Icon name='history' size='sm'/>Time shift</span>

                <InlineField
                  labelWidth={8}
                  label='Amount'
                  invalid={timeShift.value && isInvalidAmount(timeShift.value)}
                  error={timeShift.value && isInvalidAmount(timeShift.value) ? 'Amount format is invalid' : ''}
                >
                  <Input
                    className='width-8'
                    placeholder='1h'
                    value={timeShift.value}
                    required
                    onChange={onChangeHandler('value', { jsonData: timeShift })} onBlur={handleBlur}
                  />
                </InlineField>

                <InlineField
                  label="alias"
                  labelWidth={8}
                >
                  <Input
                    className='width-8'
                    placeholder='auto'
                    value={timeShift.alias}
                    onChange={onChangeHandler('alias', { jsonData: timeShift })}
                    onBlur={handleBlur}
                  />
                </InlineField>

                <InlineField
                  label='alias type'
                  labelWidth={12}
                >
                  <Select
                    className='width-7'
                    defaultValue={'suffix'}
                    value={timeShift.aliasType || 'suffix'}
                    onChange={({ value }) => onAliasTypeChange(value, { jsonData: timeShift })}
                    onBlur={handleBlur}
                    options={aliasTypes.map(val => ({value: val, label: val}))}
                  />
                </InlineField>

                <span className="gf-form-label width-4" title="only valid when alias type is suffix or prefix">delimiter</span>
                <Input
                    disabled={timeShift.aliasType === 'absolute'}
                    className='width-8'
                    placeholder='default:_'
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
      </div>

      <Button variant='secondary' icon='plus' className={styles.addButton} onClick={addTimeShifts}>Add time shift</Button>
    </div>
  );
}
