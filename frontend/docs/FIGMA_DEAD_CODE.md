# Figma renderer: dead code

The app used to draw every screen from exported Figma JSON. All routes now point to native React pages
(see `src/presentation/sections/*/index.ts`). The Figma layer is kept unchanged for reference but nothing
live imports it. Lint enforces this (`no-restricted-imports` in `eslint.config.js`).

## What is dead

| Kind              | Path                                                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer          | `src/presentation/design/*` except `DemoPage.tsx` and `DemoMapPage.tsx` (live, not Figma)                                                                                                                                                                                                                     |
| Figma pages       | `src/presentation/sections/*/pages/Figma*Page.tsx`                                                                                                                                                                                                                                                            |
| Exported frames   | `public/figma/` (~46 MB, excluded from the PWA precache in `vite.config.ts`)                                                                                                                                                                                                                                  |
| Design references | `docs/figma/`                                                                                                                                                                                                                                                                                                 |
| Tools             | `tools/figma_export.py`, `refresh_design.py`, `import_design_exports.py`, `build_design_reference.py`, `capture_design_references.mjs`, `capture_product_references.mjs`, `capture_responsive_examples.mjs`, `compare_design_references.py`, `compare-fonts.mjs`, `audit_responsive.mjs`, `inspect-admin.mjs` |
| e2e specs         | the files listed in `testIgnore` in `playwright.config.ts`                                                                                                                                                                                                                                                    |

Routes `/design`, `/design/:frameId` and `/demo/responsive/:frameId` were removed with the renderer.
`/login` and `/how-it-works` redirect to `/welcome` until native pages exist.

## Deleting it

1. Confirm nothing live imports it: `npm run lint` passes and no `src` file outside the list above imports
   `presentation/design/` (other than the two demo pages) or a `Figma*Page`.
2. Delete everything in the table.
3. Remove `globIgnores` from `vite.config.ts` and the `testIgnore` list from `playwright.config.ts`.
4. Remove the Figma import restriction from `eslint.config.js`.
5. Update `README.md` and `docs/ARCHITECTURE.md` sections that describe the renderer.
6. Run `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`.
