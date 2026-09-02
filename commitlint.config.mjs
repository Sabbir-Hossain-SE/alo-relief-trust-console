/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'setup',
        'design-system',
        'domain',
        'data-layer',
        'upload',
        'documents',
        'batches',
        'review',
        'a11y',
        'testing',
        'docs',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
