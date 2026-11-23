# Content access policy

Source: user-approved implementation plan in this chat, 2026-11-17.

- Ordinary pose/costume/portrait galleries stay public. The entire depth gallery (288 groups), its navigation, metadata and image variants require adult permission and enabled session mode. Adult catalogues, all image variants, and originals require an authenticated account with `content.adult.view` and an explicitly enabled session mode.
- Registration is invitation-only. The owner creates the first administrator through a single-use bootstrap form; the human enters their password. Direct invitations are bound to email and expire after 24 hours. WeChat-distributed invitations are single-use bearer codes bound to a hashed sender identity, then bound to the registering email on redemption; only administrator-configured grants are issued. They grant adult viewing only when the administrator explicitly selects it.
- `users.permissions.manage` permits invitations, account permission changes, and the site content switch. Only bootstrap grants this administrative permission in v1.
- Permission checks read current database grants on every protected request. Unknown assets and all old public adult URLs are denied. Auth failures never fall back to a public file.
- Adult mode starts off on page entry. Enabling requires an explicit age declaration, which is not identity or age verification. Disabling, sign-out, expiry, and revocation hide previews and deny subsequent protected requests.
- Sessions have an eight-hour absolute lifetime by default, configurable with `POSEWEAR_SESSION_SECONDS`; no cookie session-data cache is enabled.
- Restricted content is excluded from browser HTTP caches, Service Worker caches, public JSON, public SEO pages, and preload manifests. Existing downloads cannot be recalled. User API keys, favourites, and generated-image history are retained.
- Restricted external depth images are served through an authenticated, manifest-bound relay to the original allowlisted host. The upstream public website remains outside this site's access-control scope. Attribution is preserved.
- SQLite and signing material live in a private persistent systemd StateDirectory, separate from releases. Only administrative changes are audited; passwords, tokens, API keys, and image bodies are not logged.

User extension, 2026-11-17: the whole depth gallery requires 18+ access, and invitation acquisition uses the supplied 404星球的猫 QR artwork with automatic WeChat keyword replies. The owner confirmed no existing server callback to preserve.

- WeChat issuance requires a current timestamp, valid signature, encrypted payload and matching AppID. Plaintext POSTs cannot issue codes. GET URL verification never issues a code.
- A hashed sender identity gets one outstanding invitation. Duplicate delivery/resend returns the same valid code; an unused expired code may renew; a redeemed code cannot produce another registration. Sender OpenID and message text are not persisted.
- Issued codes last 24 hours and are single-use. Registration reserves an email while the account is created, supports authenticated recovery after interruption, and binds that email when redeemed.
- Automatic viewing grants default off. Only the owner-selected setting may add content.adult.view to new WeChat invitations. Management permission is never included. An optional configured recipient quota defaults to unlimited; no fabricated scarcity is shown.
- Callback Token/AES material stays in the private database and is write-only in the admin API. Public readiness requires saved credentials and verified callback. Real platform enablement and credential entry are performed by the human.
