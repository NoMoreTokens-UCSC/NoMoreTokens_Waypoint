import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Import boundaries. See docs/ROLE_MODULES.md. Each block lists every pattern for its files,
// because a later flat-config block replaces (not merges) a rule's options.
const figmaDeadCode = ['src/presentation/design/**', 'src/**/Figma*Page.tsx']
const figma = [
  {
    group: ['**/design/*', '!**/design/DemoPage', '!**/design/DemoMapPage'],
    message: 'The Figma renderer is dead code. See docs/FIGMA_DEAD_CODE.md.',
  },
  {
    group: ['**/Figma*Page'],
    message: 'Figma pages are dead code. Route a native page instead.',
  },
]
const noInfrastructure = {
  group: ['**/infrastructure/**'],
  message: 'Screens get data through useApis() (src/domain/api), never storage adapters.',
}
const modules = [
  'dispatcher',
  'store-manager',
  'loader',
  'driver',
  'administration',
  'entry-account',
  'recovery',
]
const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns: [...figma, ...patterns] }],
})
const boundaries = [
  ...modules.map((module) => ({
    files: [`src/presentation/sections/${module}/**/*.{ts,tsx}`],
    ignores: figmaDeadCode,
    rules: restrict(noInfrastructure, {
      group: modules.filter((other) => other !== module).map((other) => `**/${other}/**`),
      message: 'Modules are owned separately. Move shared code to presentation/shared.',
    }),
  })),
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    ignores: [...figmaDeadCode, 'src/presentation/sections/**'],
    rules: restrict(noInfrastructure),
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: restrict({
      group: [
        'react',
        'react-*',
        'dexie',
        '**/presentation/**',
        '**/infrastructure/**',
        '**/app/**',
      ],
      message: 'Domain and application code stays framework- and storage-free.',
    }),
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/infrastructure/**/*.ts'],
    rules: restrict(),
  },
]

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
  ...boundaries,
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
  { files: ['tools/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
)
