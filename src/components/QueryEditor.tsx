import React, { ChangeEvent, useEffect, useMemo, useRef, useState, FormEventHandler } from 'react';
import _ from 'lodash';
import defaults from 'lodash/defaults';
import {
  Alert,
  Button,
  Icon,
  InlineField,
  InlineSwitch,
  Input,
  LoadingPlaceholder,
  Select,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import {
  DataSourceApi,
  GrafanaTheme2,
  QueryEditorProps,
  SelectableValue,
} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { getDataSourceSrv } from '@grafana/runtime';
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

// Fields injected by Grafana on every DataQuery — we strip these out before persisting the
// embedded native editor's payload into our `targetQueryJSON`, so the wire format stays minimal
// and Grafana re-injects them on dispatch.
const RESERVED_QUERY_FIELDS = new Set(['refId', 'datasource', 'key', 'hide']);

// Editor mode — derived from the query data shape, with a small user-driven escape hatch.
//   self-contained: target carries datasourceUid (+ targetQueryJSON via embedded editor).
//                   Works on any panel datasource (Grafana 13+ compatible) and Alerting.
//   legacy:         target.query holds a sibling refId (Mixed panel datasource only).
//                   Kept for backward compatibility with pre-Grafana 13 dashboards.
//   empty:          brand-new query, neither set yet — guide the user to pick a Target DS.
type EditorMode = 'self-contained' | 'legacy' | 'empty';

function parseJsonSafe(val: any): Record<string, any> {
  if (!val) {
    return {};
  }
  if (typeof val === 'object') {
    return val;
  }
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

function stripReservedFields(payload: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(payload)) {
    if (!RESERVED_QUERY_FIELDS.has(k)) {
      out[k] = payload[k];
    }
  }
  return out;
}

export function QueryEditor({ query, onChange, onRunQuery, data }: Props) {
  const lastRunValueRef = useRef<Record<string, any> | null>(null);

  const aliasTypes = ['suffix', 'prefix', 'absolute'];
  let target: Record<string, any> = defaults(query, defaultQuery);

  // Legacy-mode opt-in: when an empty query wants to drop into refId-reference mode, we set this
  // flag (rather than seeding `target.query`) so the user controls when the field appears.
  const [legacyOptIn, setLegacyOptIn] = useState(false);

  // Migrate flow (legacy → self-contained): inline picker + payload reset.
  const [showMigratePicker, setShowMigratePicker] = useState(false);
  const [migrateTargetUid, setMigrateTargetUid] = useState<string | null>(null);

  const hasTargetDatasource = !!target.datasourceUid;
  const hasLegacyRefIdRef = !!target.query;

  const mode: EditorMode = hasTargetDatasource
    ? 'self-contained'
    : (hasLegacyRefIdRef || legacyOptIn)
      ? 'legacy'
      : 'empty';

  const getStyles = (theme: GrafanaTheme2) => ({
    root: css({ display: 'flex' }),
    addButton: css({ padding: theme.spacing(0, 1.25) }),
    rawToggle: css({
      marginTop: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      textDecoration: 'underline',
    }),
    section: css({
      marginTop: theme.spacing(1.5),
      paddingTop: theme.spacing(1.5),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    sectionTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sectionHint: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(1),
      lineHeight: 1.4,
    }),
    embeddedEditor: css({
      marginTop: theme.spacing(1),
      padding: theme.spacing(1),
      borderLeft: `2px solid ${theme.colors.border.medium}`,
    }),
    modeToggle: css({
      marginTop: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      textDecoration: 'underline',
      display: 'inline-block',
    }),
    migrateRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
      flexWrap: 'wrap',
    }),
    legacyDescription: css({
      marginBottom: theme.spacing(1),
    }),
    migrationNote: css({
      flexBasis: '100%',
      marginTop: theme.spacing(0.5),
      marginBottom: 0,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    statusTag: css({
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1,
      padding: theme.spacing(0.5, 0.75),
      // Grafana 9 theme may not expose `shape.radius.default`.
      borderRadius: theme.shape?.radius?.default ?? 4,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      background: theme.colors.background.secondary,
      whiteSpace: 'nowrap',
    }),
  });

  const onQueryRefChange = (event: ChangeEvent<HTMLInputElement>) => {
    target.query = event.target.value;
    onChange({ ...query, ...target });
  };

  const onProcessChange = (event: ChangeEvent<any>) => {
    target.process = event.target.checked;
    onChange({ ...query, ...target });
    onRunQuery();
  };

  const onChangeHandler = (key: string, timeShiftLine: TimeShiftLineOptions): FormEventHandler<any> | any => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { jsonData: { id: sourceLineId = '' } = {} } = timeShiftLine || {};
    const changedTimeShift = target.timeShifts.map((item: any) => {
      if (item.id === sourceLineId) {
        return { ...item, [key]: event.target.value };
      }
      return item;
    });
    target.timeShifts = changedTimeShift;
    onChange({ ...query, ...target });
  };

  const onAliasTypeChange = (value: string, timeShiftLine: TimeShiftLineOptions): FormEventHandler<any> | any => {
    const { jsonData: { id: sourceLineId = '' } = {} } = timeShiftLine || {};
    const changedTimeShift = target.timeShifts.map((item: any) => {
      if (item.id === sourceLineId) {
        return { ...item, aliasType: value };
      }
      return item;
    });
    target.timeShifts = changedTimeShift;
    onChange({ ...query, ...target });
  };

  const handleRunQuery = () => {
    lastRunValueRef.current = target;
    onChange({ ...query, ...target });
    onRunQuery();
  };

  const handleBlur = () => {
    if (!_.isEqual(target, lastRunValueRef.current)) {
      handleRunQuery();
    }
  };

  const addTimeShifts = () => {
    const id = getTimeShiftId();
    target.timeShifts.push({ id });
    onChange({ ...query, ...target });
  };

  const removeTimeShift = (timeShift: Record<string, any>) => {
    if (target.timeShifts && target.timeShifts.length <= 1) {
      return;
    }
    target.timeShifts = target.timeShifts.filter((item: any) => item.id !== timeShift.id);
    onChange({ ...query, ...target });
    onRunQuery();
  };

  const getTimeShiftId = () => {
    let id = 0;
    while (true) {
      if (_.every(target.timeShifts, (ts) => ts.id !== id)) {
        return id;
      }
      id++;
    }
  };

  const isInvalidAmount = (amountValue: string) =>
    !TIMESHIFT_FORMAT_REG.test(amountValue) && !TIMESHIFT_VAR_FORMAT_REG.test(amountValue);

  // ── Target datasource & embedded query editor ──────────────────────────────

  const [showRawJson, setShowRawJson] = useState(false);

  // Build datasource options from registry, excluding self (CompareQueries)
  const datasourceOptions = useMemo<Array<SelectableValue<string>>>(() => {
    return getDataSourceSrv()
      .getList()
      .filter((ds) => ds.type !== 'leoswing-comparequeries-datasource')
      .map((ds) => ({
        value: ds.uid,
        label: ds.name,
        description: ds.type,
      }));
  }, []);

  const selectedDatasource = datasourceOptions.find((o) => o.value === target.datasourceUid) ?? null;

  // Async-load the target datasource instance so we can render its native QueryEditor.
  const [targetDs, setTargetDs] = useState<DataSourceApi | null>(null);
  const [targetDsLoading, setTargetDsLoading] = useState(false);
  const [targetDsError, setTargetDsError] = useState<string | null>(null);

  useEffect(() => {
    if (!target.datasourceUid) {
      setTargetDs(null);
      setTargetDsError(null);
      setTargetDsLoading(false);
      return;
    }

    let cancelled = false;
    setTargetDsLoading(true);
    setTargetDsError(null);

    getDataSourceSrv()
      .get({ uid: target.datasourceUid })
      .then((ds) => {
        if (cancelled) {
          return;
        }
        setTargetDs(ds as unknown as DataSourceApi);
        setTargetDsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) {
          return;
        }
        console.warn('CompareQueries: failed to load target datasource', err);
        setTargetDs(null);
        setTargetDsError(err?.message ?? String(err));
        setTargetDsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target.datasourceUid]);

  // Resolve the embedded editor component contributed by the target datasource plugin.
  // Every standard Grafana datasource plugin exposes this (Prometheus, Elasticsearch, Loki, SQL,
  // CloudWatch, etc.). When unavailable, we fall back to a raw JSON textarea.
  const EmbeddedQueryEditor = (targetDs as any)?.components?.QueryEditor as
    | React.ComponentType<any>
    | undefined;

  // Compose the `query` prop for the embedded editor: it expects a full DataQuery shape
  // (refId + datasource + payload). We hydrate from `targetQueryJSON` and re-inject the
  // metadata each render — they are NOT persisted into targetQueryJSON.
  const embeddedQuery = useMemo<DataQuery>(() => {
    const payload = parseJsonSafe(target.targetQueryJSON);
    return {
      ...payload,
      refId: target.refId || 'A',
      datasource: target.datasourceUid ? { uid: target.datasourceUid } : undefined,
    } as DataQuery;
  }, [target.targetQueryJSON, target.refId, target.datasourceUid]);

  const onEmbeddedChange = (next: DataQuery) => {
    target.targetQueryJSON = stripReservedFields((next as unknown) as Record<string, any>);
    onChange({ ...query, ...target });
  };

  const onDatasourceSelect = (option: SelectableValue<string>) => {
    const uid = option?.value ?? '';
    target.datasourceUid = uid || undefined;
    // Reset payload when switching datasource — the embedded native editor will populate it on
    // the user's first interaction. Seed an empty object (NOT undefined) so `_isSelfContained`
    // engages and the `_runSelfContained` path lights up immediately, even before the user types.
    target.targetQueryJSON = uid ? {} : undefined;
    setShowRawJson(false);
    onChange({ ...query, ...target });
  };

  const onTargetQueryJSONChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    try {
      target.targetQueryJSON = JSON.parse(event.target.value);
    } catch {
      target.targetQueryJSON = event.target.value as any;
    }
    onChange({ ...query, ...target });
  };

  // ── Mode switching ─────────────────────────────────────────────────────────

  const switchToLegacy = () => {
    target.datasourceUid = undefined;
    target.datasourceType = undefined;
    target.targetQueryJSON = undefined;
    setLegacyOptIn(true);
    setShowMigratePicker(false);
    setMigrateTargetUid(null);
    onChange({ ...query, ...target });
  };

  const switchToSelfContainedFromLegacy = () => {
    target.query = '';
    setLegacyOptIn(false);
    onChange({ ...query, ...target });
  };

  // Migrate (legacy → self-contained) — A scheme:
  //   keep timeShifts / alias / process untouched, swap refId ref for a Target Datasource +
  //   empty payload. The user re-enters the actual query in the embedded native editor; this
  //   trade-off is intentional: QueryEditor props don't expose sibling targets, so we can't
  //   auto-clone the referenced query's payload safely across Grafana versions.
  const confirmMigrate = () => {
    if (!migrateTargetUid) {
      return;
    }
    target.datasourceUid = migrateTargetUid;
    target.targetQueryJSON = {};
    target.query = '';
    setLegacyOptIn(false);
    setShowMigratePicker(false);
    setMigrateTargetUid(null);
    onChange({ ...query, ...target });
  };

  const styles = useStyles2(getStyles);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderRawJson = () => (
    <InlineField
      label="Target Query JSON"
      labelWidth={22}
      tooltip="Full query payload for the target datasource. refId, datasource, intervalMs and maxDataPoints are injected automatically."
    >
      <TextArea
        cols={60}
        rows={6}
        placeholder='{"expr": "rate(http_requests_total[5m])"}'
        value={
          target.targetQueryJSON
            ? typeof target.targetQueryJSON === 'string'
              ? target.targetQueryJSON
              : JSON.stringify(target.targetQueryJSON, null, 2)
            : ''
        }
        onChange={onTargetQueryJSONChange}
        onBlur={handleBlur}
      />
    </InlineField>
  );

  const renderEmbeddedEditor = () => {
    if (targetDsLoading) {
      return <LoadingPlaceholder text="Loading target datasource editor…" />;
    }
    if (targetDsError) {
      return (
        <Alert severity="error" title="Failed to load target datasource">
          {targetDsError}
        </Alert>
      );
    }
    if (!targetDs) {
      return null;
    }
    if (showRawJson || !EmbeddedQueryEditor) {
      return renderRawJson();
    }

    return (
      <div className={styles.embeddedEditor}>
        <EmbeddedQueryEditor
          datasource={targetDs}
          query={embeddedQuery}
          onChange={onEmbeddedChange}
          onRunQuery={onRunQuery}
          data={data}
          range={data?.timeRange}
        />
      </div>
    );
  };

  const renderTimeShiftRows = () => (
    <>
      <div className={styles.root}>
        <InlineField label="Process TimeShift" className='width-12'>
          <InlineSwitch value={target.process} onChange={onProcessChange} />
        </InlineField>
      </div>

      <div>
        {target.timeShifts?.map((timeShift: any) => (
          <div className={styles.root} key={timeShift.id}>
            <span className="gf-form-label width-6"><Icon name='history' size='sm' />Time shift</span>

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
                onChange={onChangeHandler('value', { jsonData: timeShift })}
                onBlur={handleBlur}
              />
            </InlineField>

            <InlineField label="alias" labelWidth={8}>
              <Input
                className='width-8'
                placeholder='auto'
                value={timeShift.alias}
                onChange={onChangeHandler('alias', { jsonData: timeShift })}
                onBlur={handleBlur}
              />
            </InlineField>

            <InlineField label='alias type' labelWidth={12}>
              <Select
                className='width-7'
                defaultValue={'suffix'}
                value={timeShift.aliasType || 'suffix'}
                onChange={({ value }) => onAliasTypeChange(value, { jsonData: timeShift })}
                onBlur={handleBlur}
                options={aliasTypes.map((val) => ({ value: val, label: val }))}
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

            {target.timeShifts.length > 1 && (
              <label className="gf-form-label">
                <a className="pointer" onClick={() => removeTimeShift(timeShift)}>
                  <i className="fa fa-trash"></i>
                </a>
              </label>
            )}
          </div>
        ))}
      </div>

      <Button variant='secondary' icon='plus' className={styles.addButton} onClick={addTimeShifts}>
        Add time shift
      </Button>
    </>
  );

  const renderTargetDatasourceSection = () => (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {selectedDatasource ? 'Configure query' : 'Select datasource'}
        <span className={styles.statusTag}>
          {selectedDatasource ? selectedDatasource.label : 'Required'}
        </span>
      </div>

      <InlineField
        label="Target Datasource"
        labelWidth={22}
        tooltip="Pick any datasource installed in this Grafana — its native query editor will be embedded below."
      >
        <Select
          width={30}
          placeholder="Select datasource…"
          options={datasourceOptions}
          value={selectedDatasource}
          onChange={onDatasourceSelect}
          isClearable
        />
      </InlineField>

      {target.datasourceUid && (
        <>
          {renderEmbeddedEditor()}

          {targetDs && (
            <div className={styles.rawToggle} onClick={() => setShowRawJson((v) => !v)}>
              {showRawJson
                ? '← Use native editor'
                : EmbeddedQueryEditor
                  ? 'Edit as raw JSON →'
                  : 'No native editor available — using raw JSON'}
            </div>
          )}
        </>
      )}

      <div>
        <a className={styles.modeToggle} onClick={switchToLegacy}>
          Switch to legacy refId reference (Mixed panel only) →
        </a>
      </div>
    </div>
  );

  const renderLegacySection = () => (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Legacy refId Reference</div>
      <Alert title="Legacy refId reference mode (Mixed datasource panel only)" severity="warning">
        <p className={styles.legacyDescription}>
          This row references the result of a sibling query by its <strong>refId</strong>. It only
          works when the panel datasource is set to <code>-- Mixed --</code> and the referenced
          query lives in the same panel. Since Grafana 13, non-Mixed panels force every target to
          inherit the panel datasource, which breaks this flow — recommended to migrate to the
          Target Datasource model.
        </p>

        {!showMigratePicker ? (
          <Button
            size="sm"
            variant="primary"
            icon="arrow-right"
            onClick={() => setShowMigratePicker(true)}
          >
            Migrate to Target Datasource
          </Button>
        ) : (
          <div className={styles.migrateRow}>
            <Select
              width={30}
              placeholder="Pick target datasource…"
              options={datasourceOptions}
              value={datasourceOptions.find((o) => o.value === migrateTargetUid) ?? null}
              onChange={(o) => setMigrateTargetUid(o?.value ?? null)}
              isClearable
            />
            <Button size="sm" variant="primary" disabled={!migrateTargetUid} onClick={confirmMigrate}>
              Migrate
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowMigratePicker(false);
                setMigrateTargetUid(null);
              }}
            >
              Cancel
            </Button>
            <p className={styles.migrationNote}>
              <strong>Note:</strong> time-shift rows, alias settings and Process TimeShift are kept
              as-is. The actual query payload will be empty after migration — re-build it in the
              embedded native editor (we can&apos;t auto-clone the referenced query because the
              QueryEditor API doesn&apos;t expose sibling targets).
            </p>
          </div>
        )}
      </Alert>

      <InlineField
        label='Reference Query refId'
        className='query-keyword'
        labelWidth={22}
        tooltip='refId of a sibling query in the same panel. The plugin reads that query and runs it for each time shift.'
      >
        <Input
          spellCheck={false}
          placeholder='refId, e.g. A'
          value={target.query}
          onChange={onQueryRefChange}
          onBlur={handleBlur}
        />
      </InlineField>

      <div>
        <a className={styles.modeToggle} onClick={switchToSelfContainedFromLegacy}>
          Switch to Target Datasource (recommended) →
        </a>
      </div>
    </div>
  );

  return (
    <div>
      {renderTimeShiftRows()}

      {mode !== 'legacy' && renderTargetDatasourceSection()}

      {mode === 'legacy' && renderLegacySection()}
    </div>
  );
}
