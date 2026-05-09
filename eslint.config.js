const js = require('@eslint/js')

const commonGlobals = {
  Buffer: 'readonly',
  AbortController: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  global: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  URL: 'readonly'
}

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'helpers/tdlib/data/**',
      'coverage/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: commonGlobals
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  }
]
