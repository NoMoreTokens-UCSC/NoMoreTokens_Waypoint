# Figma correction status

This is a progress and verification record. Exact visual and interaction acceptance remains open.

## Source and assets

- The copy REST export supplies 273 active UI frames after excluding the original desktop reference group. That group remains reference material.
- 272 original frame references are available. The user deferred node `438:154` (Driver / Recovery: Review updated route).
- Original logos, photographs, supplied SVGs and static vector crops are used. Whole screen images are never application UI.
- Empty or off-viewport nodes with null Figma render bounds are recorded in `unresolved-asset-classification.json`; no replacement artwork is invented.
- Actual layer geometry, copy, paints, typography, shadows and borders drive native React elements.
- The variable DM Sans font is bundled with its SIL licence. Optical sizing improved measured heading alignment against the original exports.

## Corrected product sections

Store, Dispatcher, Loader, Driver, Entry & Account, Administration and recovery now use the source layer renderer with domain-backed controllers. Shared profile/settings/notifications are source overlays. Driver profile editing is separate. Demo controls are available only at `/demo`; Leaflet integration is at `/demo/map`.

Publication review, capacity/temperature/trip limits, reconciled loading, safety checks, loading photo, departure, local proof persistence, acceptance and separate store receipt gates remain enforced. Original proof images become the actual saved photograph during live workflows. Receiver signatures, when drawn, are stored in the same evidence transaction.

Live recovery metadata now uses the retained evidence, including receiver, case count, original photo size and save time after reload. Empty recovery no longer shows three sample accepted records. Loading/departure/driver load totals share the current manifest; manual allocation honors the selected vehicle and trip. Driver exception radios and required Other notes are functional.

Source identities supply six named users, aggregate team/audit totals, 24 orders and 60 vehicles. Capacities, coordinates and non-featured telemetry are demo assumptions where not specified by the source. The featured operational handoff is VEH055 Trip 1.

## Remaining acceptance work

- Seven component-state targets are outside the supplied page JSON: `6:7`, `6:19`, `6:31`, `70:32`, `70:43`, `2079:22806`, `2079:22818`. Their hover/drag variant appearance cannot be verified without further exports. Figma MCP inspection now also returns a Starter-plan limit.
- Screenshot differences remain and must be reviewed; the comparison report is not a pixel-perfect sign-off.
- Hover component changes, drag interactions and loading pulse/skeleton variants are not fully implemented: the seven source component states are missing. Source route-loading delay is implemented; delivery acceptance follows the retained queue outcome rather than an unconditional timer. Overlay placement and transition animation still need source-by-source review.
- Every exported prototype action has not been individually exercised. The primary workflow browser tests cover key sequences, persistence, keyboard dismissal and responsive sizes.
- Product screens now reflow without whole-page scaling. Missing counterparts use adapted source patterns; see `responsive-issues.md` and `responsive-coverage.md`. Exact pixel acceptance remains separate from responsive geometry checks.
- Some fleet/tracking/analytics scene values and illustrative secondary states remain source fixtures rather than live telemetry.
- Node `438:154` is deliberately deferred. `/recovery/review` retains the existing functional route-review simulation.

Do not describe this correction as complete or every interaction as verified.
