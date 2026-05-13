import React, { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { InlineField, Input, SecretInput, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { CompareQueriesOptions, CompareQueriesJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<CompareQueriesOptions, CompareQueriesJsonData> {}

type AuthMode = 'none' | 'basic';

const AUTH_MODE_OPTIONS: Array<SelectableValue<AuthMode>> = [
  { label: 'No Authentication', value: 'none' },
  { label: 'Basic authentication', value: 'basic' },
];

const getStyles = (theme: GrafanaTheme2) => ({
  sectionDivider: css`
    margin: ${theme.spacing(2, 0)};
    border: 0;
    border-top: 1px solid ${theme.colors.border.weak};
  `,
  sectionTitle: css`
    margin: ${theme.spacing(0, 0, 0.75, 0)};
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    color: ${theme.colors.text.primary};
  `,
  sectionSubtitle: css`
    margin: ${theme.spacing(0, 0, 2, 0)};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData, secureJsonFields, secureJsonData } = options;
  const styles = useStyles2(getStyles);
  const hasStoredAuthConfig = !!jsonData.grafanaUrl || !!secureJsonFields?.serviceAccountToken;
  const authMode: AuthMode = (jsonData.authMode as AuthMode) || (hasStoredAuthConfig ? 'basic' : 'none');

  const onGrafanaUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        grafanaUrl: event.target.value,
      },
    });
  };

  const onServiceAccountTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        serviceAccountToken: event.target.value,
      },
    });
  };

  const onResetServiceAccountToken = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        serviceAccountToken: false,
      },
      secureJsonData: {
        ...secureJsonData,
        serviceAccountToken: '',
      },
    });
  };

  const onAuthModeChange = (option: SelectableValue<AuthMode>) => {
    const nextMode = option.value ?? 'none';
    if (nextMode === 'none') {
      onOptionsChange({
        ...options,
        jsonData: {
          ...jsonData,
          authMode: 'none',
          grafanaUrl: '',
        },
        secureJsonFields: {
          ...secureJsonFields,
          serviceAccountToken: false,
        },
        secureJsonData: {
          ...secureJsonData,
          serviceAccountToken: '',
        },
      });
      return;
    }

    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        authMode: 'basic',
      },
    });
  };

  return (
    <>
      <div className={styles.sectionDivider} />
      <h4 className={styles.sectionTitle}>Authentication (Optional)</h4>
      <p className={styles.sectionSubtitle}>
        Leave empty by default. Switch to Basic authentication only when requests fail authentication.
      </p>

      <InlineField
        label="Authentication"
        labelWidth={18}
        tooltip="No Authentication is the default. Use Basic authentication only when backend requests fail due to auth."
      >
        <Select
          width={40}
          options={AUTH_MODE_OPTIONS}
          value={AUTH_MODE_OPTIONS.find((o) => o.value === authMode)}
          onChange={onAuthModeChange}
        />
      </InlineField>

      {authMode === 'basic' && (
        <>
          <InlineField
            label="Service Account"
            labelWidth={18}
            tooltip="Grafana service account token used for backend proxy authentication."
          >
            <SecretInput
              width={40}
              placeholder="glsa_xxxxxxxxxxxx"
              isConfigured={secureJsonFields?.serviceAccountToken ?? false}
              value={secureJsonData?.serviceAccountToken || ''}
              onChange={onServiceAccountTokenChange}
              onReset={onResetServiceAccountToken}
            />
          </InlineField>

          <InlineField
            label="Grafana URL"
            labelWidth={18}
            tooltip="Optional. URL of this Grafana instance (e.g. http://localhost:3000). Leave empty to auto-detect."
          >
            <Input
              width={40}
              placeholder="http://localhost:3000"
              value={jsonData.grafanaUrl || ''}
              onChange={onGrafanaUrlChange}
            />
          </InlineField>
        </>
      )}
    </>
  );
}
