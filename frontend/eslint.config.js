import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '.npm-cache',
      '.playwright',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': hooks },
    rules: { ...hooks.configs.recommended.rules },
  },
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
  { files: ['tools/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
)
