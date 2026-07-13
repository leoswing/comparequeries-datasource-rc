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

    it('interpolates a JSON-string target query payload', () => {
      mockGetTemplateSrv.mockReturnValue({
        replace: (value: string) => value.replace(/\$moduleName/g, 'basic-product'),
      });

      const ds = new DataSource({
        id: 1,
        meta: { id: 'leoswing-comparequeries-datasource' },
        jsonData: {},
      } as any);

      const result = ds._interpolateTargetQueryJSON(
        '{"query":"moduleName:$moduleName"}',
        { moduleName: { value: 'basic-product', text: 'basic-product' } }
      );

      expect(result).toEqual({ query: 'moduleName:basic-product' });
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
});
