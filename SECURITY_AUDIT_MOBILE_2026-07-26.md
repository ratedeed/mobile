# Ratedeed Mobile — Security & Bug Audit Report

**Date:** 2026-07-26
**Scope:** Full mobile codebase — Expo/React Native app (`src`, `App.js`, `index.js`), API client & token handling, auth flows (Firebase + Apple), Stripe payment flow, navigation/deep-linking, build config (`app.json`, `eas.json`, babel), and git history.
**Companion report:** `SECURITY_AUDIT_2026-07-26.md` (web/backend repo)

---

## CRITICAL

### 1. Production Stripe publishable key appears to be a hand-edited test key
`eas.json` production env:
```
"EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_51TFxmH2K3vS58g5IdspNfgGbJGLkpqxlVSPpBQa2cp2nRWaAPz3RxPfgl4ozCOxsfj4xLc9oshL0xnSeNGduOXNT00Lv4ycEhh"
```
The development/preview key is:
```
"EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_51TFxmH2K3vS58g5IdspNfgGbJGLkpqxlVSPpBQa2cp2nRWaAPz3RxPfgl4ozCOxsfj4xLc9oshL0xnSeNGduOXNT00Lv4ycEhh"
```
**The key bodies are byte-for-byte identical** — only the `test`/`live` prefix differs. Stripe never issues test/live keys with the same random body, so the production key was almost certainly created by editing the prefix of the test key. A fabricated `pk_live_` fails Stripe authentication, which means **every payment in production builds will fail at Stripe SDK initialization** (and `App.js:72` deliberately throws at startup if the key is missing/invalid in production).

**Fix:** Copy the real `pk_live_` key from the Stripe dashboard (Developers → API keys) into `eas.json` production env, and verify a production build can open the PaymentSheet before submission.

### 2. The app calls six backend endpoints that do not exist (features silently broken)
Cross-checked every `src/utils/apiClient.ts` call against the backend that hosts both web and mobile — `Ratedeed/api/backend` (the single Express app behind `api.ratedeed.com`; `api/server.js` is just a compat wrapper for `api/backend/server.js`). These routes exist nowhere in that codebase:

| Mobile call (apiClient.ts) | Endpoint | Backend status |
|---|---|---|
| `getTopRatedContractors` | `GET /api/contractors/top-rated` | **404 — does not exist** |
| `getNearbyTopRatedContractors` | `GET /api/contractors/nearby` | **404 — does not exist** |
| `updateProfilePicture` | `PUT /api/users/profile-picture` | **404 — does not exist** (backend: `PUT /users/profile`) |
| `updateBannerImage` | `PUT /api/users/banner-image` | **404 — does not exist** (backend: `PUT /users/profile`) |
| `getPlatformStats` | `GET /api/admin/stats` | **404 — does not exist** (backend: `/admin/dashboard-stats`) |
| `verifyEmailBackend` | `POST /api/users/verify-email` | **404 — does not exist** |

**Fix:** since the backend lives in the Ratedeed repo (`api/backend/routes/`), the cleanest fix is to add these six routes there (the mobile UX already expects them) — or fall back to updating the client paths. Add a shared API contract test to prevent drift.

---

## HIGH

### 3. Change orders are dead end-to-end (backend bug hits mobile)
`ChangeOrderScreen.tsx` correctly posts `{title, description, amount}` (cents) to `POST /api/jobs/:id/change-order`, but the backend handler (`jobController.js:771`) never reads `req.body` and **always returns 400**. Contractors cannot create change orders from any client. Additionally, accepted *negative* change orders (scope reductions) never refund the homeowner because the backend requires a non-existent module (`../utils/stripe`). Mobile users are directly affected by both backend bugs (see web audit #2/#3).

### 4. Contractor "Dispute Inquiry" flow always fails
`DisputeScreen.tsx` renders a full dispute-filing UI for contractors (`isContractor ? 'Dispute Inquiry'`), but the backend `raiseDispute` (`jobController.js:696`) hard-rejects anyone who isn't the homeowner with 403 "Only the user can raise a dispute". Contractors fill out the form, upload evidence photos to Cloudinary, and then get an error. Either implement a contractor-side dispute endpoint or remove/replace the contractor UI with a "contact support" path.

### 5. Payment/dispute/quote chat confirmation messages are dead code
Three screens attempt to post a system message after a key event:
- `PaymentFlowScreen.tsx:113-118` (payment confirmed)
- `DisputeScreen.tsx:156-165` (dispute raised)
- `QuoteReviewScreen.tsx:153-162` (quote declined)

All three call `sendMessage(conversationId, '', ...)` with an **empty recipientId**, which fails backend validation (`body('recipientId').isMongoId()` → 400), and read `quote.conversationId` / `job.conversationId`, which **are not fields the backend returns**. The errors are swallowed by bare `catch {}` blocks, so the messages silently never send. Fix: have the backend return `conversationId` on quote/job payloads and pass the real recipient, or create these system messages server-side (better — clients shouldn't fabricate them anyway).

---

## MEDIUM

### 6. Deep-link domain mismatch — email links won't open the app
- `App.js:77` linking prefixes: `['ratedeed://', 'https://ratedeed.com']` — **missing `https://www.ratedeed.com`**
- `app.json` iOS `associatedDomains`: only `applinks:ratedeed.com`
- `app.json` Android intent filter: only host `ratedeed.com`
- Backend emails (password reset, email-change verification) link to **`https://www.ratedeed.com/...`**

Result: `ResetPassword` and `VerifyEmailChange` deep-link screens exist but users tapping emailed links land on the website, not the app. Fix: add `www.ratedeed.com` to all three places (prefixes, associatedDomains, intentFilters).

### 7. `postinstall` Stripe patch silently skipped on EAS builds
`package.json:10`:
```json
"postinstall": "sed -i '' 's/.../.../' node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h || true"
```
`sed -i ''` is macOS/BSD syntax. EAS builders run Linux (GNU sed), where this errors — and `|| true` swallows it, so the patch is **silently not applied** on EAS builds. If that header patch is required for iOS compilation, production iOS builds will break (or worse, already silently differ from local builds). Fix: use a cross-platform patch (e.g. `patch-package`, or `node -e` script).

### 8. Password policy mismatch between mobile and backend
`ResetPasswordScreen.tsx:44-66` enforces uppercase + number + special character; the backend `reset-password` route only enforces min-8. Users get contradictory rules depending on platform. Align both sides with one policy (signup backend already requires a special char — mobile reset is stricter than both).

### 9. Token storage falls back to plain AsyncStorage on web builds
`secureStore.ts:6-8` — on `Platform.OS === 'web'`, `auth_token`/`refresh_token` are stored in AsyncStorage (= localStorage), where any XSS reads them. Native builds use Secure Enclave/Keystore correctly. If you ever ship the Expo web build, gate it or accept the risk explicitly.

---

## LOW / NOTES

- **Firebase/Stripe publishable keys committed** (`eas.json`, `google-services.json`, `GoogleService-Info.plist`) — these are public-by-design client keys, not leaks, but they only stay safe if Firebase security rules and App Check are enforced server-side (not verifiable from this repo).
- **Sentry DSN hardcoded in `app.json:138`** — DSNs are public; fine. `beforeSend` PII scrubbing (emails, JWTs) is implemented — good.
- **`ios/sentry.properties` / `android/sentry.properties` are tracked but clean** — they reference the `SENTRY_AUTH_TOKEN` env var; the actual token lives only in gitignored `.env.local`. Verified `.env`/`.env.local` are gitignored and never committed. Good.
- **`EarningsScreen.tsx:145`** calls `requestPayout()` with no amount → pays out the *full available balance*. Verify there's a confirmation dialog before this fires (backend is safe — Stripe enforces balance — but UX-wise a one-tap full withdrawal deserves a confirm).
- **`expo-tracking-transparency`** is wired with `NSUserTrackingUsageDescription` — good for App Store review; make sure ATT is requested before any IDFA access (currently fired on app mount, acceptable).
- **`index.js` background FCM handler** dedupes notification banners correctly; console logs are stripped in production via `babel-plugin-transform-remove-console` (verified in `babel.config.js`). Good.
- **`getContractorLeads`/`updateLeadStatus`** are stubbed to return empty/success — dead features; remove or implement to avoid confusing future maintainers.

### Verified healthy
- Tokens in `expo-secure-store` (native), refresh-token rotation with invalidation handling, single-flight refresh dedupe
- Payment flow: server-created PaymentIntents, client never sets amounts (server recomputes), polling verification against backend state, double-tap guards (`payingRef`)
- Socket.IO: JWT auth, token refresh on reconnect, app-state/network-aware reconnect logic
- Cloudinary: signed uploads with server-side folder allowlist
- Apple Sign-In: identity-token flow matches the (fixed) backend verification; no raw-email account linking
- Error boundaries on all sensitive screens; optimistic message UI with failure marking/retry
- No hardcoded secrets in source; no WebViews; no insecure HTTP endpoints in app code

---

## Suggested priority order
1. **Fix the production `pk_live_` key (#1)** — payments are dead in production builds until this is right. Test with a real production build, not Expo Go.
2. Reconcile the six 404 endpoints (#2) — decide per-endpoint: implement server-side or fix the client path.
3. Fix the backend change-order + refund bugs (web audit #2/#3/#6) — unblocks #3 here.
4. Resolve the contractor dispute flow (#4) and the dead chat-message code (#5).
5. Deep-link domain fixes (#6), cross-platform postinstall patch (#7) — both are pre-submission items for the next store release.
