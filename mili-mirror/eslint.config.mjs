// ESLint flat config — nt-site-mirror (Node.js ESM).
// Decisions documented in docs/adr/ADR-001-lint-and-code-quality.md
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      // generated pipeline outputs and runtime artifacts
      'tests/fixture/project/capture/**',
      'tests/fixture/project/mirror/**',
      'tests/fixture/project/experience-blueprint/**',
      'tests/fixture/project/*.log',
      '**/output/**',
      // binary fixtures are not lintable; text fixtures below are intentionally hand-written
      'tests/fixture/site/assets/*.png',
      'tests/fixture/site/assets/*.mp4',
      'tests/fixture/site/assets/fonts/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.js', 'server/**/*.js', 'browser/**/*.js', 'validators/**/*.js', 'tests/**/*.js', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        // page.evaluate callbacks execute in the browser (Playwright)
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': 'off', // CLI project: console output is the product interface
      'no-control-regex': 'off', // sanitize regexps intentionally strip control chars
      'no-useless-escape': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-prototype-builtins': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-undef': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
