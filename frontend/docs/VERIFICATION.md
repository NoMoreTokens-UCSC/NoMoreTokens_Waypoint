# Verification record

## Current checks

- Strict TypeScript and the production build pass.
- ESLint and source/browser-test formatting checks pass.
- 17 unit tests pass: domain gates, shared workflows, atomic store changes, fleet identities, publication review invalidation, proof/signature persistence, failed sync, route revisions and prototype conditions.
- 36 Chromium browser tests pass, including entry/account/admin flows, invitations, profile/photo persistence, Store creation/review/confirmation, shared operational handoff, proof recovery and separate Store receipt, failed/revised/accepted queues, production PWA offline reload, responsive variants, keyboard dismissal/focus, form/photo resize retention and normal/reduced-motion behavior.
- Primary routes are checked at 360, 390, 768, 834, 1024, 1280, 1440 and 1920 CSS pixels. Checks cover 600/700px short screens and a 125% zoom-equivalent CSS viewport/display scale.
- All 272 available scenes have native, 360px and 768px geometry reports. Checks detect page overflow, text escaping its box, overlapping flow siblings, clipped flow content, missing assets and rendering errors. Authored counterparts and adapted fallbacks are identified in the coverage checklist.
- 272 product screenshots are captured at source dimensions and compared against original Figma PNG exports. Source screenshots remain the baseline. Live home desktop/tablet/mobile and reported issue captures are in `figma/responsive-captures`.
- Home desktop section boundaries and equal morning-rush columns are asserted against the source. Four horizontal desktop/tablet steps, vertical mobile steps, consistent role-card heights, reachable footer columns and unclipped hero statistics are checked.
- Framer Motion tests verify entrance completion without resting transforms, one-time step reveals, popup input/dismissal through resizing and immediate visibility under reduced-motion preferences.

## Evidence

- `figma/responsive-issues.md`: issue/fix register and before/after links.
- `figma/responsive-coverage.md`: all 273 inventory entries, including the deferred frame.
- `figma/responsive-audit.json`, `responsive-audit-360.json`, `responsive-audit-768.json`: full available-scene geometry results.
- `figma/product-render-audit.json`, `product-pixel-comparisons.json`: source-sized captures, assets and comparison diagnostics.
- `figma/home-motion.md`: alignment, animation timing and accessibility behavior.

Comparison tools use reduced motion and block service workers to capture settled layouts without update banners. The dedicated PWA workflow test enables the service worker and exercises a real offline reload. Source fixtures and live routes are distinct checks: fixtures reproduce deterministic states; routes bind changing local data.

## Limits and open acceptance

Screenshot differences remain marked for review. Matching geometry and passing responsive tests are not claims of exact pixel equality or verification of every individual prototype action. Seven hover/loading/drag component targets are unavailable in the source export. Driver recovery node `438:154` remains deferred at the user's request; the issue register explains how to locate/export it later.

Geometry scans tolerate font leading, intentional ellipsis and contained scroll regions. Intentional artwork/map layering needs visual review. Only Chromium was tested. Actual browser toolbar zoom, other browser engines, real cameras, OS PWA installation and storage eviction remain manual checks.

Authentication, invitations, access recovery and server acceptance are local simulations. The deferred revised-route review uses the existing functional simulation. The production precache is approximately 44 MiB, including bundled references/assets; initial download and storage cost need production measurement. OpenStreetMap tiles are not promised offline.
