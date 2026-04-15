import React, { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineField, Input, SecretInput, Alert } from '@grafana/ui';
import { CompareQueriesOptions, CompareQueriesJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<CompareQueriesOptions, CompareQueriesJsonData> {}

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData, secureJsonFields, secureJsonData } = options;

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

  return (
    <>
      <Alert title="Alerting Configuration" severity="info">
        To enable Grafana Alerting support, configure the Grafana API connection below.
        The backend component uses this to proxy queries to target datasources when evaluating alert rules.
        For dashboard panels, the existing frontend-based compare query flow is used — these settings are optional for non-alerting usage.
      </Alert>

      <InlineField
        label="Grafana URL"
        labelWidth={20}
        tooltip="URL of this Grafana instance (e.g. http://localhost:3000). Used by the backend to proxy queries. Leave empty to auto-detect."
      >
        <Input
          width={40}
          placeholder="http://localhost:3000"
          value={jsonData.grafanaUrl || ''}
          onChange={onGrafanaUrlChange}
        />
      </InlineField>

      <InlineField
        label="Service Account Token"
        labelWidth={20}
        tooltip="A Grafana service account token with permissions to query datasources. Required for alerting to work."
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
    </>
  );
}
