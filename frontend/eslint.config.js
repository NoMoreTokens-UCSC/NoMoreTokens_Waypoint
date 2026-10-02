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
  {
    // The Figma renderer is dead code (docs/FIGMA_DEAD_CODE.md); live code must not depend on it.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/presentation/design/**', 'src/**/Figma*Page.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/design/*', '!**/design/DemoPage', '!**/design/DemoMapPage'],
              message: 'The Figma renderer is dead code. See docs/FIGMA_DEAD_CODE.md.',
            },
            {
              group: ['**/Figma*Page'],
              message: 'Figma pages are dead code. Route a native page instead.',
            },
          ],
        },
      ],
    },
  },
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
  { files: ['tools/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
)
