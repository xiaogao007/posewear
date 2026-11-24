---
version: alpha
colors:
  background: "#ffffff"
  surface: "#f5f5f5"
  text: "#111111"
  secondary: "#555555"
  primary: "#ff2442"
  border: "#e3e3e3"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    lineHeight: "1.6"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "22px"
    lineHeight: "1.35"
rounded:
  card: "14px"
  dialog: "20px"
  button: "999px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  galleryAction:
    backgroundColor: "{colors.primary}"
  divider:
    backgroundColor: "{colors.border}"
    height: "1px"
  accountDialog:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
---

## Overview
PoseWear is a Chinese-first reference library and try-on workbench. Preserve its white/grey gallery, rounded images, quiet utilities, and red creative actions. Account tools belong in a neutral more menu; content classification stays explicit within permission-approved preferences.

API settings use the existing native model select with a nearby refresh action and localized live status. Distinguish models returned by the current connection from unverified presets and a preserved unlisted model. Manual model IDs remain a separate, explicitly selected field. The generated-image preview uses the same surface/text tokens in a large native modal with a contained, scrollable original-size view; avoid changing the gallery lightbox or the workbench comparison layout.

Workbench style choices support youthful, clear, natural everyday outfit photography: daily, commute, weekend street, date, collegiate mood and lookbook. Use six compact two-column choices with a visible one-line explanation, neutral selected fill and the existing focus treatment. Keep original-photo, white-background, film-color and illustration styles in a native disclosure. Existing saved style IDs remain valid. Style describes light, setting and color treatment; the reference identity and outfit remain authoritative.

## Colors
Runtime CSS variables in `src/style.css` are canonical. Documented colors map to --bg, --sf, --tx, --tx2, --ac, --line2. Account surfaces consume these variables and automatically follow the existing dark overrides. No independent account palette.

## Typography
Use the existing Chinese-capable system stack. Labels state the action and errors explain recovery; secrets are masked. External Japanese material remains credited source content, not a Japanese application locale.

## Layout
Preserve the header and gallery. The more menu replaces the public adult switch. Account/preferences/admin share one app-owned HTML dialog, 480px wide on desktop and a safe-area-aware bottom sheet on phones. Admin results use bounded pages and a responsive list.

## Elevation & Depth
Use existing --sh2/--sh3 only for menus and overlays. Native HTML dialog top-layer owns modal isolation. Global scrollbar colors come from --scroll-thumb/--scroll-track.

## Shapes
Reuse pill actions and 14px fields. No new decorative imagery, gradients, or hero treatment.

## Components
`src/access.js` owns account forms, content preferences, invite/grant controls, WeChat integration settings, and the shared modal. `src/feedback.js` owns shared toasts, with APP.toast as the gallery adapter. Auth submit actions use the text/background token pair; brand red remains available for established gallery actions. The invitation acquisition page uses a two-column step list and QR card, stacking on phones; reuse the supplied QR artwork without changing its pixels. Avoid invented scarcity or claims of automatic delivery before callback verification.

## Do's and Don'ts
Make permission changes explicit and reversible. Restore focus after dialogs; support keyboard and reduced motion. Hide unavailable adult controls and render generic unavailable states for forbidden direct links. Preserve API keys, favourites, and personal history during cache migration.
