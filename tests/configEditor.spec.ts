import { test, expect } from '@grafana/plugin-e2e';

test('"Save & test" should be successful when configuration is valid', async ({
  createDataSource,
  readProvisionedDataSource,
  selectors,
  page,
  request,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const created = await createDataSource({ type: ds.type });
  await page.goto(selectors.pages.EditDataSource.url(created.uid), { waitUntil: 'domcontentloaded' });

  const healthPath = selectors.apis.DataSource.health(created.uid, created.id.toString());
  await page.route(healthPath, async (route) => {
    await route.fulfill({ status: 200, body: 'OK' });
  });

  await page.getByRole('button', { name: 'Save & test' }).click();
  await expect(page.getByText(/working correctly/i)).toBeVisible();

  await request.delete(selectors.apis.DataSource.datasourceByUID(created.uid));
});

test('Config editor should render auth controls correctly', async ({
  createDataSource,
  readProvisionedDataSource,
  selectors,
  page,
  request,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const created = await createDataSource({ type: ds.type });
  await page.goto(selectors.pages.EditDataSource.url(created.uid), { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Authentication (Optional)')).toBeVisible();
  await expect(page.getByText('No Authentication')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save & test' })).toBeVisible();

  await request.delete(selectors.apis.DataSource.datasourceByUID(created.uid));
});
