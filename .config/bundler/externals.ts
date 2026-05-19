import type { Configuration, ExternalItemFunctionData } from 'webpack';

type ExternalsType = Configuration['externals'];

export const externals: ExternalsType = [
  'lodash',
  'jquery',
  'moment',
  'slate',
  'emotion',
  '@emotion/react',
  '@emotion/css',
  'prismjs',
  'slate-plain-serializer',
  '@grafana/slate-react',
  'react',
  'react-dom',
  'react-redux',
  'redux',
  'rxjs',
  'react-router',
  'react-router-dom',
  'd3',
  'angular',
  '@grafana/ui',
  '@grafana/runtime',
  '@grafana/data',

  // Mark legacy SDK imports as external if their name starts with the "grafana/" prefix
  ({ request }: ExternalItemFunctionData, callback: (error?: Error, result?: string) => void) => {
    const prefix = 'grafana/';
    const hasPrefix = (request: string) => request.indexOf(prefix) === 0;
    const stripPrefix = (request: string) => request.slice(prefix.length);

    if (request && hasPrefix(request)) {
      return callback(undefined, stripPrefix(request));
    }

    callback();
  },
];
