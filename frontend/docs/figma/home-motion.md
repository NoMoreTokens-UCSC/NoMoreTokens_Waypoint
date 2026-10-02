# Home alignment and animation

The live `/welcome` page uses original Figma layers and assets from `7:2` and `7:3`. Desktop/tablet have four horizontal workflow steps and two columns of role cards. Mobile uses the authored vertical steps and role cards. The morning-rush desktop composition has equal copy/image columns and clips the original photo at its source crop.

At the 1440px source width, section boundaries match the reference: Hero 0, Network 775, How it works 1019, Roles 1396, Morning rush 2033 and CTA 2453px. Content remains able to grow at other widths; no whole-page scaling is used. Full-width section surfaces expand through 1920px.

## Animation behavior

| Target                  | Entrance                                    | Timing                    |
| ----------------------- | ------------------------------------------- | ------------------------- |
| Hero copy               | Fade and 20px upward slide                  | 550ms                     |
| Hero preview            | Fade, 24px horizontal and 20px upward slide | 550ms                     |
| Section text and groups | Fade and 20px upward slide on entering view | 550ms, once               |
| Four workflow steps     | Fade and 24px slide from the left           | 550ms, 80ms stagger, once |
| Popups and menus        | Fade and 10px upward slide                  | 220ms                     |
| Drawers                 | Fade and 24px slide from the right          | 220ms                     |

Framer Motion changes opacity and transforms only. Resting geometry and source styles are unchanged. Popup positioning, focus trapping, Escape/outside dismissal and scroll constraints are managed independently. Resizing retains form values and current workflow state. The native access-recovery dialog and shared Radix forms also use Framer Motion.

Reduced-motion preferences remove the slides and delays and show content immediately. Comparison fixtures keep home motion disabled; capture tools request reduced motion so screenshots represent final geometry. Four dedicated browser tests cover eight-width home alignment, normal-motion reveal/settling, animated popup input/dismissal and reduced-motion behavior.

## Captures

- [Desktop](responsive-captures/home-desktop-after.png)
- [Tablet](responsive-captures/home-tablet-after.png)
- [Mobile](responsive-captures/home-mobile-after.png)

The underlying Figma PNG exports remain the comparison baseline. Pixel differences are tracked in `product-pixel-comparisons.json`; matching section geometry does not mean all remaining raster/text differences have been approved.
