import { AdHocVariableFilter, ScopedVars } from '@grafana/data';
import { DataSourceSrv, TemplateSrv } from '@grafana/runtime';
import _ from 'lodash';

import {
  createMultiValueFormatter,
  FallbackFormatAdapter,
  resolveFallbackFormatAdapter,
} from './fallback-format-adapters';

const RESERVED_TARGET_QUERY_FIELDS = new Set(['refId', 'datasource', 'key', 'hide']);
export const TARGET_QUERY_INTERPOLATION = Symbol('compareQueriesTargetInterpolation');

export type TargetInterpolationMode = 'delegated' | 'fallback';

export interface TemplateVariableDelegate {
  applyTemplateVariables(
    query: Record<string, unknown>,
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): unknown;
}

export interface TargetInterpolationOptions {
  datasourceUid?: string;
  datasourceType?: string;
  refId?: string;
  delegate?: unknown;
  filters?: AdHocVariableFilter[];
}

export interface TargetInterpolationResult {
  query: Record<string, any>;
  mode: TargetInterpolationMode;
}

export interface TargetInterpolationContext {
  templateSrv: TemplateSrv;
  datasourceSrv: DataSourceSrv;
  targetDsCache: Map<string, TemplateVariableDelegate>;
  resolveDatasourceType: (uid?: string) => string | undefined;
  getLegacyAdHocFilters: () => AdHocVariableFilter[];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function supportsTemplateVariableDelegation(
  value: unknown
): value is TemplateVariableDelegate {
  return isPlainObject(value) && typeof Reflect.get(value, 'applyTemplateVariables') === 'function';
}

function applyTemplateVariablesWithLegacyFilters(
  delegate: TemplateVariableDelegate,
  query: Record<string, unknown>,
  scopedVars: ScopedVars,
  filters: AdHocVariableFilter[]
): unknown {
  const applyTemplateVariables = delegate.applyTemplateVariables;
  const templateSrv = Reflect.get(delegate as object, 'templateSrv');
  if (!isPlainObject(templateSrv) || typeof Reflect.get(templateSrv, 'getAdhocFilters') !== 'function') {
    return applyTemplateVariables.call(delegate, query, scopedVars, filters);
  }

  // Scope the compatibility override to this invocation. Mutating the shared datasource or
  // TemplateSrv would leak CompareQueries filters into concurrent queries and other panels.
  const compatibleTemplateSrv = Object.create(templateSrv);
  Object.defineProperty(compatibleTemplateSrv, 'getAdhocFilters', {
    value: () => filters,
  });

  const compatibleDelegate = Object.create(delegate) as TemplateVariableDelegate;
  Object.defineProperty(compatibleDelegate, 'templateSrv', {
    value: compatibleTemplateSrv,
  });

  return applyTemplateVariables.call(compatibleDelegate, query, scopedVars, filters);
}

export function getLoadedTemplateVariableDelegate(
  datasourceSrv: DataSourceSrv,
  uid: string
): TemplateVariableDelegate | undefined {
  // ExpressionDatasource loads all source datasources before synchronously interpolating them.
  // Grafana's public DataSourceSrv.get() is async, so use its already-loaded instance registry
  // to bridge that synchronous API boundary. Fall back safely if Grafana changes the registry.
  const loadedDatasources = Reflect.get(datasourceSrv, 'datasources');
  if (!isPlainObject(loadedDatasources)) {
    return undefined;
  }

  const datasource = loadedDatasources[uid];
  return supportsTemplateVariableDelegation(datasource) ? datasource : undefined;
}

export function getTargetInterpolationMode(value: unknown): TargetInterpolationMode | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const mode = Reflect.get(value, TARGET_QUERY_INTERPOLATION);
  return mode === 'delegated' || mode === 'fallback' ? mode : undefined;
}

export function markTargetInterpolationMode<T extends object>(
  target: T,
  mode: TargetInterpolationMode
): T {
  Object.defineProperty(target, TARGET_QUERY_INTERPOLATION, {
    value: mode,
    enumerable: true,
  });
  return target;
}

export function normalizeTargetQueryJSON(payload: unknown): Record<string, any> | null {
  if (payload === undefined || payload === null) {
    return null;
  }
  if (typeof payload === 'object') {
    return _.cloneDeep(payload);
  }
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed === '') {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

export function stripReservedTargetQueryFields(payload: Record<string, unknown>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(payload)) {
    if (!RESERVED_TARGET_QUERY_FIELDS.has(key)) {
      out[key] = payload[key];
    }
  }
  return out;
}

function applyTargetTemplateVariables(
  delegate: TemplateVariableDelegate,
  query: Record<string, unknown>,
  scopedVars: ScopedVars,
  filters: AdHocVariableFilter[] | undefined,
  getLegacyAdHocFilters: () => AdHocVariableFilter[]
): unknown {
  // A defined value, including [], is authoritative under Grafana's modern request contract.
  if (filters !== undefined) {
    return delegate.applyTemplateVariables(query, scopedVars, filters);
  }

  const legacyFilters = getLegacyAdHocFilters();
  return legacyFilters.length > 0
    ? applyTemplateVariablesWithLegacyFilters(delegate, query, scopedVars, legacyFilters)
    : delegate.applyTemplateVariables(query, scopedVars);
}

export function deepReplaceTemplateVars(
  value: unknown,
  scopedVars: ScopedVars,
  templateSrv: TemplateSrv,
  adapter?: FallbackFormatAdapter,
  path: string[] = []
): unknown {
  if (typeof value === 'string') {
    if (!value.includes('$')) {
      return value;
    }
    const defaultFormat = adapter?.formatForPath(path);
    return templateSrv.replace(
      value,
      scopedVars,
      defaultFormat ? createMultiValueFormatter(defaultFormat, scopedVars) : undefined
    );
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      deepReplaceTemplateVars(item, scopedVars, templateSrv, adapter, [...path, String(index)])
    );
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        deepReplaceTemplateVars(nested, scopedVars, templateSrv, adapter, [...path, key]),
      ])
    );
  }

  return value;
}

export function prepareTargetQueryJSON(
  payload: Record<string, any> | string | undefined | null,
  scopedVars: ScopedVars,
  options: TargetInterpolationOptions,
  context: TargetInterpolationContext
): TargetInterpolationResult | null {
  const normalized = normalizeTargetQueryJSON(payload);
  if (normalized === null) {
    return null;
  }

  const delegate = supportsTemplateVariableDelegation(options.delegate)
    ? options.delegate
    : options.datasourceUid
      ? context.targetDsCache.get(options.datasourceUid) ??
        getLoadedTemplateVariableDelegate(context.datasourceSrv, options.datasourceUid)
      : undefined;

  if (delegate && options.datasourceUid) {
    context.targetDsCache.set(options.datasourceUid, delegate);
  }

  if (delegate) {
    try {
      const fullQuery = {
        ...normalized,
        refId: options.refId || 'A',
        datasource: options.datasourceUid ? { uid: options.datasourceUid } : undefined,
      };
      const result = applyTargetTemplateVariables(
        delegate,
        fullQuery,
        scopedVars,
        options.filters,
        context.getLegacyAdHocFilters
      );
      if (isPlainObject(result)) {
        return {
          query: stripReservedTargetQueryFields(result),
          mode: 'delegated',
        };
      }
    } catch (err) {
      console.warn('CompareQueries: target applyTemplateVariables failed, using fallback', err);
    }
  }

  const datasourceType = options.datasourceType ?? context.resolveDatasourceType(options.datasourceUid);
  const adapter = resolveFallbackFormatAdapter(datasourceType);
  const interpolated = deepReplaceTemplateVars(normalized, scopedVars, context.templateSrv, adapter);
  return isPlainObject(interpolated)
    ? {
        query: stripReservedTargetQueryFields(interpolated),
        mode: 'fallback',
      }
    : null;
}

export function interpolateTargetQueryJSON(
  payload: Record<string, any> | string | undefined | null,
  scopedVars: ScopedVars,
  options: TargetInterpolationOptions,
  context: TargetInterpolationContext
): Record<string, any> | null {
  return prepareTargetQueryJSON(payload, scopedVars, options, context)?.query ?? null;
}
