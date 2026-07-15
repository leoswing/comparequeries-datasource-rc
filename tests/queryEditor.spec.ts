import { test, expect } from '@grafana/plugin-e2e';

test('data query should return a value', async ({ panelEditPage, readProvisionedDataSource }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');
  await panelEditPage.getQueryEditorRow('A').getByRole('textbox', { name: 'Query Text' }).fill('test query');
  await panelEditPage.getQueryEditorRow('A').getByRole('spinbutton').fill('10');
  await expect(panelEditPage.panel.fieldNames).toContainText(['Time', 'Value']);
  await expect(panelEditPage.panel.data).toContainText(['10']);
});

test('expression requests expand multi-value variables before backend QueryData', async ({
  page,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({
    fileName: 'variable-expression.json',
  });
  const queryRequest = page.waitForRequest((request) => {
    if (!request.url().includes('/api/ds/query')) {
      return false;
    }
    return request.postData()?.includes('comparequeries-e2e') ?? false;
  });

  await page.goto(`/d/${dashboard.uid}`, { waitUntil: 'domcontentloaded' });

  const request = await queryRequest;
  const body = request.postDataJSON();
  const compareQuery = body.queries.find(
    (query: { datasource?: { uid?: string } }) => query.datasource?.uid === 'comparequeries-e2e'
  );
  const targetQuery = compareQuery?.targetQueryJSON?.query;

  expect(targetQuery).toBe('type:log AND moduleName: ("action" OR "default" OR "charge")');
  expect(targetQuery).not.toContain('$moduleName');
});
