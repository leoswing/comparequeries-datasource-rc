import React, { ChangeEvent, useState } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineField, Input, SecretInput, Alert, Collapse } from '@grafana/ui';
import { CompareQueriesOptions, CompareQueriesJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<CompareQueriesOptions, CompareQueriesJsonData> {}

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData, secureJsonFields, secureJsonData } = options;
  const [alertingOpen, setAlertingOpen] = useState<boolean>(
    !!jsonData.grafanaUrl || !!secureJsonFields?.serviceAccountToken
  );

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
      <Alert title="Alerting Settings (Optional)" severity="info">
        Dashboard-only usage: leave this section empty.
        Alerting / backend execution: <strong>Service Account Token is required</strong>; Grafana URL is optional
        (only when auto-detection is incorrect).
      </Alert>

      <Collapse
        label="Alerting Settings (Optional)"
        isOpen={alertingOpen}
        onToggle={() => setAlertingOpen(!alertingOpen)}
        collapsible
      >
        <InlineField
          label="Service Account"
          labelWidth={18}
          tooltip="Grafana service account token. Required for backend alerting queries; optional for dashboard-only usage."
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
      </Collapse>
    </>
  );
}
