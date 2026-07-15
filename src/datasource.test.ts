import type { AdHocVariableFilter } from '@grafana/data';

import { DataSource } from './datasource';

const mockGetDataSourceSrv = jest.fn();
const mockGetTemplateSrv = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => mockGetDataSourceSrv(),
  getTemplateSrv: () => mockGetTemplateSrv(),
}));

describe('DataSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplateSrv.mockReturnValue({
      replace: (value: string) => value,
    });
    mockGetDataSourceSrv.mockReturnValue({
      get: jest.fn(),
    });
  });

  describe('query flow', () => {
    it('fails the whole query when one branch fails', async () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      jest.spyOn(ds as any, '_runSelfContained').mockResolvedValue({
        data: [{ refId: 'A', hide: false }, { refId: 'B', hide: true }],
      });
      jest.spyOn(ds as any, '_runLegacy').mockRejectedValue(new Error('legacy failed'));

      await expect(
        ds.query({
          requestId: 'req-1',
          targets: [
            {
              refId: 'A',
              datasourceUid: 'prom-uid',
              targetQueryJSON: { expr: 'up' },
              timeShifts: [{ id: 0, value: '1h' }],
            },
            {
              refId: 'B',
              query: 'A',
            },
          ],
          scopedVars: {},
        } as any)
      ).rejects.toThrow('legacy failed');
    });
  });

  describe('self-contained flow', () => {
    it('still dispatches query when targetQueryJSON is an empty object', async () => {
      const queryMock = jest.fn();
      const datasourceSrv = {
        get: jest.fn().mockResolvedValue({
          meta: { id: 'prometheus' },
          query: queryMock,
        }),
      };

      mockGetDataSourceSrv.mockReturnValue(datasourceSrv);
      queryMock.mockResolvedValue({
        data: [{ target: 'metric' }],
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const result = await (ds as any)._runSelfContained(
        {
          requestId: 'req-2',
          range: {
            from: { clone: () => ({ add: () => new Date() }) },
            to: { clone: () => ({ add: () => new Date() }) },
            raw: {},
          },
          scopedVars: {},
        },
        {
          refId: 'A',
          datasourceUid: 'prom-uid',
          targetQueryJSON: {},
          timeShifts: [{ id: 0, value: '1h' }],
        }
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].target).toBe('metric_1h');
      expect(datasourceSrv.get).toHaveBeenCalledWith({ uid: 'prom-uid' });
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it('ignores empty shift when at least one valid shift exists', async () => {
      const queryMock = jest.fn().mockResolvedValue({
        data: [{ target: 'error' }],
      });
      const datasourceSrv = {
        get: jest.fn().mockResolvedValue({
          meta: { id: 'prometheus' },
          query: queryMock,
        }),
      };

      mockGetDataSourceSrv.mockReturnValue(datasourceSrv);

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const result = await (ds as any)._runSelfContained(
        {
          requestId: 'req-3',
          range: {
            from: { clone: () => ({ add: () => new Date() }) },
            to: { clone: () => ({ add: () => new Date() }) },
            raw: {},
          },
          scopedVars: {},
        },
        {
          refId: 'A',
          datasourceUid: 'prom-uid',
          targetQueryJSON: { expr: 'sum(rate(err_total[5m]))' },
          timeShifts: [{ id: 0, value: '' }, { id: 1, value: '1d' }],
        }
      );

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].target).toBe('error_1d');
    });

    it('delegates variable interpolation on the first frontend query', async () => {
      const queryMock = jest.fn().mockResolvedValue({
        data: [{ target: 'metric' }],
      });
      const applyTemplateVariables = jest.fn((query: Record<string, unknown>) => ({
        ...query,
        expr: 'up{job=~"(api|worker)"}',
      }));
      mockGetDataSourceSrv.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          meta: { id: 'prometheus' },
          query: queryMock,
          applyTemplateVariables,
        }),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      await (ds as any)._runSelfContained(
        {
          requestId: 'req-first-run',
          range: {
            from: new Date(0),
            to: new Date(1),
            raw: {},
          },
          scopedVars: {
            job: { value: ['api', 'worker'], text: 'api + worker' },
          },
        },
        {
          refId: 'A',
          datasourceUid: 'prom-uid',
          targetQueryJSON: { expr: 'up{job=~"$job"}' },
          timeShifts: [{ id: 0, value: '' }],
        }
      );

      expect(applyTemplateVariables).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0][0].targets[0].expr).toBe('up{job=~"(api|worker)"}');
    });

    it('does not delegate twice after expression preparation', async () => {
      const queryMock = jest.fn().mockResolvedValue({
        data: [{ target: 'metric' }],
      });
      const applyTemplateVariables = jest.fn((query: Record<string, unknown>) => ({
        ...query,
        expr: 'up{job=~"(api|worker)"}',
      }));
      const targetDs = {
        meta: { id: 'prometheus' },
        query: queryMock,
        applyTemplateVariables,
      };
      mockGetDataSourceSrv.mockReturnValue({
        get: jest.fn().mockResolvedValue(targetDs),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      ds.registerTargetDatasource('prom-uid', targetDs);

      const filters = [{ key: 'cluster', operator: '=', value: 'prod' }];
      const [prepared] = ds.interpolateVariablesInQueries(
        [{
          refId: 'A',
          query: '',
          timeShifts: [{ id: 0, value: '' }],
          aliasTypes: [],
          units: [],
          process: true,
          datasourceUid: 'prom-uid',
          targetQueryJSON: { expr: 'up{job=~"$job"}' },
        }],
        { job: { value: ['api', 'worker'], text: 'api + worker' } },
        filters
      );

      await (ds as any)._runSelfContained(
        {
          requestId: 'req-prepared',
          range: {
            from: new Date(0),
            to: new Date(1),
            raw: {},
          },
          scopedVars: {
            job: { value: ['api', 'worker'], text: 'api + worker' },
          },
          filters,
        },
        prepared
      );

      expect(applyTemplateVariables).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0][0].targets[0].expr).toBe('up{job=~"(api|worker)"}');
    });

    it('applyTemplateVariables expands nested targetQueryJSON for backend queries', () => {
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) =>
          value.replace(/\$moduleName/g, 'basic-product').replace(/\$environment/g, 'production'),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const query = {
        refId: 'B',
        query: '',
        timeShifts: [{ id: 0, value: '1d' }],
        aliasTypes: [],
        units: [],
        process: true,
        targetQueryJSON: {
          query: 'type:log AND moduleName: $moduleName',
          nested: {
            environment: '$environment',
            values: ['$moduleName', 1, true],
          },
        },
      };
      const scopedVars = {
        moduleName: { value: 'basic-product', text: 'basic-product' },
        environment: { value: 'production', text: 'production' },
      };
      const result = ds.applyTemplateVariables(query, scopedVars);

      expect(result.targetQueryJSON).toEqual({
        query: 'type:log AND moduleName: basic-product',
        nested: {
          environment: 'production',
          values: ['basic-product', 1, true],
        },
      });
      expect(query.targetQueryJSON).toEqual({
        query: 'type:log AND moduleName: $moduleName',
        nested: {
          environment: '$environment',
          values: ['$moduleName', 1, true],
        },
      });
    });

    it('bridges legacy Ad Hoc filters without mutating the target datasource', () => {
      const legacyFilters = [{ key: 'moduleName', operator: '=', value: 'basic-product' }];
      const getAdhocFilters = jest.fn().mockReturnValue(legacyFilters);
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) => value,
        getAdhocFilters,
      });
      const targetGetAdhocFilters = jest.fn().mockReturnValue([]);
      const targetTemplateSrv = {
        getAdhocFilters: targetGetAdhocFilters,
      };
      const legacyTargetDs = {
        name: 'Elasticsearch',
        templateSrv: targetTemplateSrv,
        applyTemplateVariables(query: Record<string, unknown>, _scopedVars: unknown) {
          const filters = this.templateSrv.getAdhocFilters(this.name);
          const filterQuery = filters.map((filter: AdHocVariableFilter) => `${filter.key}:\"${filter.value}\"`).join(' AND ');
          return {
            ...query,
            query: [query.query, filterQuery].filter(Boolean).join(' AND '),
          };
        },
      };
      const ds = new DataSource({
        id: 1,
        uid: 'comparequeries-uid',
        name: 'CompareQueries',
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      ds.registerTargetDatasource('es-uid', legacyTargetDs);

      const result = ds.applyTemplateVariables(
        {
          refId: 'B',
          datasourceUid: 'es-uid',
          targetQueryJSON: { query: 'type: log' },
        } as any,
        {}
      );

      expect(result.targetQueryJSON).toEqual({
        query: 'type: log AND moduleName:"basic-product"',
      });
      expect(getAdhocFilters).toHaveBeenCalledWith('CompareQueries');
      expect(targetGetAdhocFilters).not.toHaveBeenCalled();
      expect(legacyTargetDs.templateSrv).toBe(targetTemplateSrv);
    });

    it('keeps an explicitly empty modern filter list authoritative', () => {
      const getAdhocFilters = jest.fn().mockReturnValue([
        { key: 'moduleName', operator: '=', value: 'stale-value' },
      ]);
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) => value,
        getAdhocFilters,
      });
      const applyTemplateVariables = jest.fn(
        (query: Record<string, unknown>, _scopedVars?: unknown, _filters?: unknown) => query
      );
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      ds.registerTargetDatasource('es-uid', { applyTemplateVariables });

      ds.applyTemplateVariables(
        {
          refId: 'B',
          datasourceUid: 'es-uid',
          targetQueryJSON: { query: 'type: log' },
        } as any,
        {},
        []
      );

      expect(getAdhocFilters).not.toHaveBeenCalled();
      expect(applyTemplateVariables.mock.calls[0][2]).toEqual([]);
    });

    it('delegates interpolation to target datasource when cached', () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      // Simulate a cached target datasource that formats lucene-style
      const applyTemplateVariables = jest.fn(
        (query: Record<string, unknown>, _scopedVars?: unknown, _filters?: unknown) => ({
          ...query,
          query: 'moduleName: ("action" OR "default" OR "charge")',
        })
      );
      const fakeTargetDs = {
        applyTemplateVariables,
      };
      ds.registerTargetDatasource('es-uid', fakeTargetDs);
      const filters = [{ key: 'environment', operator: '=', value: 'production' }];

      const result = ds._interpolateTargetQueryJSON(
        '{"query":"moduleName: $moduleName"}',
        { moduleName: { value: ['action', 'default', 'charge'], text: 'action + default + charge' } },
        { datasourceUid: 'es-uid', refId: 'B', filters }
      );

      expect(result).toEqual({
        query: 'moduleName: ("action" OR "default" OR "charge")',
      });
      expect(applyTemplateVariables.mock.calls[0][2]).toBe(filters);
    });

    it('delegates interpolation to a datasource already loaded by Grafana on cold start', () => {
      const applyTemplateVariables = jest.fn((query: Record<string, unknown>) => ({
        ...query,
        query: 'type:log AND moduleName: ("action" OR "default" OR "charge")',
      }));
      mockGetDataSourceSrv.mockReturnValue({
        get: jest.fn(),
        datasources: {
          'es-uid': {
            applyTemplateVariables,
          },
        },
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      const result = ds._interpolateTargetQueryJSON(
        '{"query":"type:log AND moduleName: $moduleName"}',
        { moduleName: { value: ['action', 'default', 'charge'], text: 'action + default + charge' } },
        { datasourceUid: 'es-uid', refId: 'B' }
      );

      expect(result).toEqual({
        query: 'type:log AND moduleName: ("action" OR "default" OR "charge")',
      });
      expect(applyTemplateVariables).toHaveBeenCalledTimes(1);
    });

    it('uses Grafana default formatting when target datasource is unavailable', () => {
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string, _scopedVars?: unknown, format?: string) =>
          value.replace(/\$moduleName/g, format === undefined ? '{action,default,charge}' : 'unexpected'),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const result = ds._interpolateTargetQueryJSON(
        '{"query":"type:log AND moduleName: $moduleName"}',
        { moduleName: { value: ['action', 'default', 'charge'], text: 'action + default + charge' } },
        { datasourceUid: 'unknown-uid', refId: 'B' }
      );

      expect(result).toEqual({
        query: 'type:log AND moduleName: {action,default,charge}',
      });
    });

    it('uses default fallback when expressions prepare queries without a delegate', () => {
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) => value.replace(/\$moduleName/g, '{action,default,charge}'),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const [result] = ds.interpolateVariablesInQueries(
        [{
          refId: 'B',
          query: '',
          timeShifts: [],
          aliasTypes: [],
          units: [],
          process: true,
          datasourceUid: 'target-uid',
          targetQueryJSON: { query: 'moduleName: $moduleName' },
        }],
        { moduleName: { value: ['action', 'default', 'charge'], text: 'action + default + charge' } }
      );

      expect(result.targetQueryJSON).toEqual({ query: 'moduleName: {action,default,charge}' });
    });

    it('applyTemplateVariables expands timeShift value, alias, and delimiter', () => {
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) =>
          value
            .replace(/\$shiftAlias/g, 'last_week')
            .replace(/\$delimiter/g, ' / ')
            .replace(/\$shift/g, '7d'),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const query = {
        refId: 'B',
        query: '',
        timeShifts: [
          { id: 0, value: '', alias: '' },
          { id: 1, value: '$shift', alias: '$shiftAlias', aliasType: 'suffix', delimiter: '$delimiter' },
        ],
        aliasTypes: [],
        units: [],
        process: true,
      };
      const scopedVars = {
        shift: { value: '7d', text: '7d' },
        shiftAlias: { value: 'last_week', text: 'last_week' },
        delimiter: { value: ' / ', text: ' / ' },
      };
      const result = ds.applyTemplateVariables(query as any, scopedVars);

      expect(result.timeShifts).toEqual([
        { id: 0, value: '', alias: '', delimiter: '' },
        { id: 1, value: '7d', alias: 'last_week', aliasType: 'suffix', delimiter: ' / ' },
      ]);
      expect(query.timeShifts[1]).toEqual({
        id: 1,
        value: '$shift',
        alias: '$shiftAlias',
        aliasType: 'suffix',
        delimiter: '$delimiter',
      });
    });

    it('filters invalid non-empty shifts when at least one valid shift exists', async () => {
      const queryMock = jest.fn().mockResolvedValue({
        data: [{ target: 'error' }],
      });
      const datasourceSrv = {
        get: jest.fn().mockResolvedValue({
          meta: { id: 'prometheus' },
          query: queryMock,
        }),
      };

      mockGetDataSourceSrv.mockReturnValue(datasourceSrv);

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const result = await (ds as any)._runSelfContained(
        {
          requestId: 'req-4',
          range: {
            from: { clone: () => ({ add: () => new Date() }) },
            to: { clone: () => ({ add: () => new Date() }) },
            raw: {},
          },
          scopedVars: {},
        },
        {
          refId: 'A',
          datasourceUid: 'prom-uid',
          targetQueryJSON: { expr: 'sum(rate(err_total[5m]))' },
          timeShifts: [{ id: 0, value: 'abc' }, { id: 1, value: '1d' }, { id: 2, value: '   ' }],
        }
      );

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].target).toBe('error_1d');
    });
  });

  describe('time-shift alias naming', () => {
    it('keeps frame name separate from the aliased field name', () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const frame: any = {
        name: 'test22',
        fields: [
          { name: 'Time', type: 'time', config: {} },
          { name: 'Value', type: 'number', config: {} },
        ],
      };

      (ds as any)._applyAliasToFrame(frame, '1d', 'suffix', '_');

      expect(frame.name).toBe('test22');
      expect(frame.fields[1].name).toBe('Value_1d');
      expect(frame.fields[1].config.displayNameFromDS).toBe('test22_1d');
      expect(frame.fields[1].labels).toEqual({ timeshift: '1d' });
    });

    it('keeps wide-frame field display names distinct', () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      const frame: any = {
        name: 'orders',
        fields: [
          { name: 'Time', type: 'time', config: {} },
          { name: 'success', type: 'number', config: {} },
          { name: 'failure', type: 'number', config: {} },
        ],
      };

      (ds as any)._applyAliasToFrame(frame, '1d', 'suffix', '_');

      expect(frame.fields[1].name).toBe('success_1d');
      expect(frame.fields[2].name).toBe('failure_1d');
      expect(frame.fields[1].config.displayNameFromDS).toBe('success_1d');
      expect(frame.fields[2].config.displayNameFromDS).toBe('failure_1d');
    });

    it('keeps mixed-frame field display names distinct', () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);
      const frame: any = {
        name: 'orders',
        fields: [
          { name: 'Time', type: 'time', config: {} },
          { name: 'status', type: 'string', config: {} },
          { name: 'count', type: 'number', config: {} },
        ],
      };

      (ds as any)._applyAliasToFrame(frame, '1d', 'suffix', '_');

      expect(frame.fields[1].name).toBe('status_1d');
      expect(frame.fields[1].config.displayNameFromDS).toBe('status_1d');
      expect(frame.fields[2].name).toBe('count_1d');
      expect(frame.fields[2].config.displayNameFromDS).toBe('count_1d');
    });
  });

  describe('legacy compare flow', () => {
    it('fails when any compare shift fails', async () => {
      const compareQueryMock = jest.fn().mockImplementation((opt: any) => {
        if (opt.requestId.includes('_2h')) {
          return Promise.reject(new Error('shift failed'));
        }
        return Promise.resolve({
          data: [{ target: 'metric' }],
        });
      });
      const datasourceSrv = {
        get: jest.fn().mockResolvedValue({
          meta: { id: 'prometheus' },
          query: compareQueryMock,
        }),
      };
      mockGetDataSourceSrv.mockReturnValue(datasourceSrv);

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const baseTime = {
        clone: () => ({
          add: () => new Date(0),
        }),
      };

      await expect(
        (ds as any)._compareQuery(
          {
            requestId: 'req-legacy',
            scopedVars: {},
            range: {
              from: baseTime,
              to: baseTime,
              raw: {},
            },
          },
          [
            {
              refId: 'B',
              query: 'A',
              process: false,
              hide: false,
              timeShifts: [
                { id: 0, value: '1h' },
                { id: 1, value: '2h' },
              ],
            },
          ],
          {
            A: [
              {
                refId: 'A',
                datasource: 'prometheus-uid',
                hide: false,
              },
            ],
          },
          ds
        )
      ).rejects.toThrow('shift failed');

      expect(datasourceSrv.get).toHaveBeenCalledWith('prometheus-uid');
      expect(compareQueryMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('ad hoc variable support', () => {
    it('exposes getTagKeys/getTagValues so Grafana can bind Ad hoc variables', async () => {
      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      expect(typeof ds.getTagKeys).toBe('function');
      expect(typeof ds.getTagValues).toBe('function');
      await expect(ds.getTagKeys()).resolves.toEqual([]);
      await expect(ds.getTagValues({ key: 'moduleName' } as any)).resolves.toEqual([]);
    });
  });
});
