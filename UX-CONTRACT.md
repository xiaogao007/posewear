# PoseWear interaction contract

## Business-context sources
ACCESS-POLICY.md is the accepted permission/session/data policy. README.md records existing gallery, local key/history, and attribution behavior. Server authorization is authoritative; frontend flags only reflect capabilities.

## Design context
DESIGN.md records taste. src/style.css is the canonical runtime token owner. Themes: light/dark. Locale: Chinese controls with the existing Chinese/English description switch.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | src/access.js shared form renderer | ACCESS-POLICY.md | sign-in/setup/invite/password | integration + browser |
| Select/Listbox | existing native select | existing workbench | native OS popup | existing regression |
| Scrollbar | src/style.css root baseline | DESIGN.md | dialog geometry | computed style |
| Toast | src/feedback.js, APP.toast adapter | shared feedback primitive | success/info | gallery + invitation browser checks |
| CRUD | src/access.js account manager | ACCESS-POLICY.md | invite/grant/revoke | auth tests + browser |

## Flow ledger
| Operation | Pending | Success | Failure recovery | Source ref |
|---|---|---|---|---|
| Sign in | disable submit, fixed width | close dialog and refresh capabilities | generic credentials error, preserve email | ACCESS-POLICY.md |
| Bootstrap/accept invitation | disable duplicate submit | sign in and return to preferences | inline errors; password entered only by human in production | ACCESS-POLICY.md |
| Invite | pessimistic POST | one-time copyable code in dialog | retain email; no secret in toast | ACCESS-POLICY.md |
| Grant/revoke | explicit confirmation | refresh list and current capabilities | retain list and retry | ACCESS-POLICY.md |
| Adult mode | explicit age declaration before POST | refresh catalogue | default to ordinary contents on error/offline | ACCESS-POLICY.md |
| Search | local clear, IME-safe | show page 1 | retry retains query | existing gallery |
| Cancel/back | Escape or close | restore trigger focus | n/a | shared dialog |

## Navigation and overlays
More menu has a localized accessible name and keyboard access. One HTML dialog supplies inert background, focus trap, Escape, and focus restoration. Replace its content for confirmations rather than stacking multiple account dialogs. Phone layout respects visual viewport/safe-area and scrolls inside the dialog.

## Forms and async
All new forms use novalidate, associated labels, localized inline error/live region, masked secret inputs with show/hide controls, current/new-password autocomplete, first-invalid focus, abortable requests, and duplicate-submit protection. Failed authentication clears the password. Server error/timeout preserves non-secret input. No native alert/confirm/prompt in the account workflow.

## Permission and data
Capabilities come from /api/me. No permission or session token is persisted in localStorage. Mode/revocation/sign-out refresh other tabs without broadcasting credentials. Unknown or forbidden resources remain hidden. Favourites/recent IDs persist but unavailable items do not render images or text. Existing try-on library selections are cleared when no longer accessible; user uploads and generated history persist.

The entire depth gallery is restricted. The tab and attribution entry are hidden until permitted session mode is on, direct hashes return to ordinary browsing, and no public depth JSON is generated. Mode-off/revocation while viewing depth navigates to the pose gallery.

## WeChat acquisition
The public /invite/ page uses the supplied 404星球的猫 QR image and default keyword 邀请码. It displays actual readiness from the server, not a claim of delivery before integration is configured and verified. Existing codes remain redeemable when new issuance is paused.
Only encrypted, signed WeChat callbacks can issue bearer codes. One hashed sender gets one current code; consumed codes do not produce another registration. Expired unused codes may renew. Codes grant only administrator-configured viewing permission, never permission management.
Registration deep links put the code in the URL fragment, immediately remove it, and prefill only the form. Codes and secrets are not stored in localStorage or exposed by settings read APIs. WeChat settings use the shared form/modal; secret fields are masked and blank means preserve. Callback verification and last received-message state remain visible to the owner. The human supplies platform credentials and enables the server configuration.

## Dataset navigation
Gallery retains its existing local filters and load-more behavior. Admin users: server paging, 20 rows per page, search reset to page 1, no empty stranded page. Invitations and permission mutations invalidate the displayed page.

## Workbench output settings

src/studio.js owns model-specific output capabilities; use the existing native selects and src/style.css tokens. Persist aspect ratio, resolution tier and GPT Image quality locally. Standard size and explicit medium quality are the defaults for GPT Image; higher settings state the cost/time tradeoff. Unsupported saved settings remain visible and block generation until corrected, without silently changing the model or tier. Freeze output settings during a run and preserve size/quality through protocol fallbacks. Gemini uses imageConfig; Seedream uses its own size capability; neither receives OpenAI quality. Unknown models expose conservative capabilities.

Read actual returned dimensions from the image bytes and retain request/actual metadata in history. Flag exact-size mismatches; Gemini dimensions are documented estimates rather than exact pixel requests. Download original bytes for both individual files and ZIPs. Do not label locally resized images as native high resolution. Browser request mocks verify parameters, supported/unsupported states, persistence, history, keyboard, narrow/dark layout, cancellation and byte-exact downloads without paid model calls.

Sunburst/Flare in GPT Image 2.5 and 2.6 use the documented native size capability and include xhigh/max/auto quality. Keep quality capabilities per model; preserve unsupported saved quality values visibly and block generation until corrected, with the quality field marked invalid. Model changes must not silently substitute rendering quality.

## Verification
Required: Node auth integration tests, public/private build audit, source syntax checks, production build, premium static audit, real-browser anonymous/login/preferences/admin/revocation flows, keyboard and narrow viewport. Preserve the existing workbench regression where applicable. Test old public URLs, HEAD/Range, missing cookie, forbidden session, expiry, CSRF, forged flags, cache exclusions, and unavailable auth service.
