import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { CompareQueriesQuery, CompareQueriesOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, CompareQueriesQuery, CompareQueriesOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
