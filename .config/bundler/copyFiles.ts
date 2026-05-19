import { hasReadme } from './utils';

export const copyFilePatterns = [
  // If src/README.md exists use it; otherwise the root README
  // To `compiler.options.output`
  { from: hasReadme() ? 'README.md' : '../README.md', to: '.', force: true },
  { from: 'plugin.json', to: '.' },
  { from: '../LICENSE', to: '.' },
  { from: '../CHANGELOG.md', to: '.', force: true },
  { from: '**/*.json', to: '.' }, // TODO<Add an error for checking the basic structure of the repo>
  { from: '**/*.svg', to: '.', noErrorOnMissing: true }, // Optional
  { from: '**/*.png', to: '.', noErrorOnMissing: true }, // Optional
  { from: '**/*.html', to: '.', noErrorOnMissing: true }, // Optional
  { from: 'img/**/*', to: '.', noErrorOnMissing: true }, // Optional
  { from: 'libs/**/*', to: '.', noErrorOnMissing: true }, // Optional
  { from: 'static/**/*', to: '.', noErrorOnMissing: true }, // Optional
  { from: '**/query_help.md', to: '.', noErrorOnMissing: true }, // Optional
];
