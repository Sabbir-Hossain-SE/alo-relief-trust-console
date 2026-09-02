import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/server/corpus/pools.generated.ts',
  ]),

  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // eslint-config-next already registers the jsx-a11y plugin, so take the
      // recommended rules without redefining it.
      ...jsxA11y.flatConfigs.recommended.rules,

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },

  // Presentational components stay small. Logic belongs in hooks, domain/ or lib/.
  {
    files: ['src/components/**/*.tsx', 'src/features/**/components/**/*.tsx'],
    rules: {
      'max-lines': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },

  // The mock backend and benchmarks legitimately log to the console.
  {
    files: ['src/server/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
]);

export default eslintConfig;
