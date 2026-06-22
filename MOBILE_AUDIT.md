# Ratedeed Mobile App — Production Audit

**Date:** Jun 21 2026
**Scope:** Full audit of the Expo/React Native app at `/Users/tamim/Desktop/ratedeedmobile` — 87 source files, entry/navigation/auth/API, all 22 screens, all utils/hooks/context, all common components, build config, secrets, git history.
**Stack:** Expo 54, React Native 0.81.5, React 19, NativeWind 4, TypeScript 5.9, Firebase (web SDK), Stripe React Native 0.50, Socket.IO, Sentry, @react-navigation v7.
**Verdict:** **NOT production-ready.** **2 critical launch blockers** (Stripe test key in prod, secrets in git history) and **~12 App Store rejection risks** including a real crash, fake data, non-functional UI, hardcoded test amounts in a money flow, and a misleading payment button. Plus ~30 high-priority correctness/UX bugs. Estimate: **1–2 weeks of focused work** to clear rejection risks, plus a security rotation pass.

---

## Scorecard

| Area | Readiness | Notes |
|---|---|---|
| Secrets / git hygiene | 20% | Live Stripe test key shipped to prod; MongoDB/JWT/Cloudinary in git history |
| Auth | 55% | Firebase+JWT works; reset deep-link broken, weak reset policy, Apple Sign-In returning-user edge case |
| API client | 50% | 1200-line monolith, no idempotency on money mutations, no timeouts, two-client import inconsistency |
| Payments / escrow | 35% | Stripe test key, $0 payment path reachable, no webhook ack, milestone button shows wrong amount, hardcoded quote defaults |
| Money display | 30% | AnalyticsTab shows $0 (wrong status enum), EarningsScreen shows $0 on error, ProfileScreen stats hardcoded to '0' |
| Screens — home/search/detail | 60% | Functional but 500-record fetch, client-side filtering, claim modal not auth-gated |
| Screens — contractor | 50% | Onboarding dead-code stub, dashboard wrong-data fetch on profile failure, license payload mismatch |
| Screens — messages/notifications | 55% | Hardcoded Unsplash URL in quote cards, fragile deep-link parsing, no real-time read receipts |
| Common components | 60% | BottomSheet drag broken (moveY vs dy), dark mode not supported, two toast systems, below-min touch targets |
| Hooks / utils | 55% | Memory leaks (avatar cache, animations), no reduced-motion, two image-picker libs, Nominatim ToS risk |
| Accessibility | 25% | No a11y roles/labels, no focus trap in modals, no reduced-motion, no screen-reader announcements |
| App Store config | 45% | Unused `NSMicrophoneUsageDescription`/`RECORD_AUDIO`, vague tracking description, dark mode suppressed by app.json |
| Tests | 0% | Zero automated tests on a payments/escrow app |
| Code quality | 50% | Pervasive `any`, dead code, mixed JS/TS in auth-critical files, 30 identical "prdocutiont" commits |

**Overall: ~45%.** The app runs and most screens render, but it is not safe to ship to the App Store in its current state.

---

## CRITICAL — fix before any submission

### C1. Stripe TEST publishable key shipped to production
`eas.json:53` — the `production` build profile embeds:
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_51TFxmH2K3vS58g5IdspNfgGbJGLkpqxlVSPpBQa2cp2nRWaAPz3RxPfgl4ozCOxsfj4xLc9oshL0xnSeNGduOXNT00Lv4ycEhh"
```
All three profiles (`development:20`, `preview:37`, `production:53`) use the same `pk_test_...` key. Every TestFlight/App Store build will route Stripe checkout to Stripe's **test** environment. Apple Pay and card payments will not capture real funds. `.env:8` locally has `pk_live_...` — but EAS doesn't read `.env`, it reads `eas.json`. **No production payment can ever succeed.**
**Action:** Replace the production profile's key with `pk_live_...`. Re-verify Apple Pay merchant ID `merchant.com.ratedeed.app` (`app.json:121`) is registered in App Store Connect.

### C2. Live backend secrets committed in git history
`backend/.env` was committed at `9c2df27` ("Initial commit"), `588d700`, `1d1afc6`. Leaked:
- `MONGO_URI=mongodb+srv://deedrate:4Sy6sW7NpjhSyaQZ@cluster0.axqyk1y.mongodb.net/...` — live DB user + password
- `JWT_SECRET=9f74e7c6...` — signs every auth token; anyone with this can forge any JWT, including admin
- `CLOUDINARY_URL=cloudinary://253655363346568:L2Nja0rvb96WSkm0SZ0-JxLZ2eQ@dh8ibqixr...` — Cloudinary API key + secret

Even though `.env` is no longer in HEAD and is gitignored, the secrets remain recoverable from history. **The repo must be treated as fully compromised.**
**Action:** Rotate MongoDB password, JWT_SECRET, and Cloudinary API secret **immediately**. Run `git filter-repo --invert-paths --path backend/.env` and force-push, OR start a fresh repo. Revoke and reissue the Firebase web API key `AIzaSyCN-guWJ0r2lqk0kVB8Mjj0eESNVKZ5c7c` (`eas.json:13,30,46`) and restrict the new one in Google Cloud Console to your iOS bundle ID + Android SHA-1.

### C3. Hardcoded $2800/$3200 default line items in quote creation
`src/components/contractor/QuoteCreationSheet.tsx:76-78` and `:264-265`:
```ts
{ description: 'Labor', amount: '2800' },
{ description: 'Materials & fixtures', amount: '3200' },
```
A contractor can open the quote sheet and tap "Send Quote" without entering anything → sends a **$6,000 quote** with default values. This is hardcoded test data in a production money flow. Apple reviewers testing the contractor side will hit this.
**Action:** Default to empty line items (or a single empty row). Disable "Send" until the contractor enters at least one real amount.

### C4. React Hooks violation → crash in JobDetailScreen
`src/screens/JobDetailScreen.tsx:76-103` — early `return` for missing `jobId` happens **before** `useSafeAreaInsets` (line 104), `useAuth` (line 105), and all `useState` (line 107+). If `jobId` is ever undefined on first render and then becomes defined, the number of hooks called changes between renders → React throws **"Rendered fewer hooks than expected"** crash. Reachable via deep link without a `jobId`, or any navigation race.
**Action:** Move all hooks above any conditional return. Render the "invalid job" state inside the main JSX, not as an early return.

### C5. "Accept & Pay" button shows wrong amount for milestone quotes
`src/screens/QuoteReviewScreen.tsx:430` displays `totalInDollars` (full quote total) on the accept button, but `:121` only charges `amountToPay` (the first milestone amount). For a $10,000 milestone quote, the button says **"Accept & Pay $10,000.00"** while Stripe charges ~$3,000. **Misleading pricing in a payment flow** — Apple Guideline 3.1.5 / 2.1 rejection.
**Action:** For milestone quotes, the button must show the first-milestone amount (e.g., "Pay $3,000.00 now · $10,000.00 total") and the screen must display the milestone schedule.

### C6. Password-reset deep links land with no token
`App.js:79` maps the `reset-password` deep-link path without a `:token` segment, but `ResetPasswordScreen.tsx:21` reads `route.params.token || route.params.oobCode`. Firebase password-reset emails link to `reset-password?oobCode=...`, and `apiClient.ts:1087` POSTs to the **backend** `/users/reset-password` which expects a **backend** JWT — not a Firebase `oobCode`. A reviewer tapping the reset email hits "Missing password reset token" → **Guideline 2.1 rejection**.
**Action:** Either (a) wire the deep-link to pass `oobCode` and add a backend endpoint that accepts Firebase `oobCode`, or (b) switch the backend reset flow to issue its own tokens and use those in emails.

### C7. $0 payment is reachable
`src/screens/PaymentFlowScreen.tsx:29` — `paymentAmount = route.params?.totalAmount || 0`. If the param is missing (navigation race, bad deep link), the user reaches Apple Pay / Payment Sheet with a **$0.00** cart. Stripe will reject, but the UI shows a valid payment screen for zero dollars.
**Action:** Guard the screen — if `totalAmount` is missing or ≤ 0, redirect back with an error.

### C8. Apple Sign-In breaks for returning users
`src/utils/apiClient.ts:1127` — `appleSignIn` POSTs `identityToken` to the backend. Apple only returns `identityToken` on the **first** sign-in; subsequent sign-ins return `null`. The client sends `null` → backend can't verify → returning users can't sign in. **Apple requires Sign-in-with-Apple to work for returning users** (Guideline 4.8).
**Action:** Send `appleUserIdentifier` (the stable `user` field Apple returns every time) and have the backend accept either `identityToken` (first login) or `appleUserIdentifier` (returning login).

---

## HIGH — App Store rejection risks

### H1. Unused microphone permission strings
`app.json:28` `NSMicrophoneUsageDescription` ("record voice messages and videos") and `app.json:69` `RECORD_AUDIO` Android permission — **no audio recording feature exists** in the codebase. Apple rejects for unused permission strings (Guideline 5.1.1). **Action:** Remove both, or implement voice messages.

### H2. Firebase init failure crashes the app
`src/firebaseConfig.js:26-27` — on init failure, sets `app = {}; auth = {}`. Downstream callers invoke methods unconditionally: `LoginScreen.js:74` `auth.onAuthStateChanged`, `AuthContext.tsx:234` `onIdTokenChanged(auth, ...)`. In Firebase-restricted regions or on a cold start with no network, the app **crashes**. Reviewers in Cupertino hit this. **Action:** Either throw a proper error screen on init failure, or guard every caller.

### H3. Hardcoded fake data in ProfileScreen
`src/screens/ProfileScreen.tsx:505`:
```ts
[{ value: '0', label: 'Reviews' }, { value: '0', label: 'Messages' }, { value: '0', label: 'Projects' }]
```
Stats are hardcoded to `'0'` and never fetched. Reviewers see a profile with zero activity on a populated account. Also `:732` hardcodes "Version 1.0.0 · Build 2026.04" instead of reading `expo-constants`. **Action:** Fetch real counts or remove the stats row.

### H4. Non-functional notification toggles
`src/screens/ProfileScreen.tsx:603-612` — notification toggles update local state only; `onValueChange` is not wired to any API or push-token update. Toggles do nothing persistent. Reviewers will toggle, force-quit, reopen, and see them reset. **Action:** Wire to a user-preferences endpoint + FCM topic subscriptions.

### H5. Non-functional date-range selector in AnalyticsTab
`src/components/contractor/AnalyticsTab.tsx:25` — `week`/`month`/`quarter`/`year` selector changes state but `kpiData`, `earningsData`, and `serviceBreakdown` **never filter by it**. Decorative control. Combined with H6 below, the entire analytics page is misleading.

### H6. AnalyticsTab shows $0 revenue due to status-name mismatch
`src/components/contractor/AnalyticsTab.tsx:30,42,47,80` — filters on `j.status === 'completed' || j.status === 'paid'`, but every other screen (`JobDetailScreen.tsx:50`, `ActiveJobsScreen.tsx:126`, `EarningsScreen.tsx`) uses `completed_paid`. Result: analytics always shows 0 completed jobs and **$0 revenue**. Also `:69` `avgResponseTime: '—'` is a hardcoded em-dash presented as a metric.

### H7. "Escrow Protected" badge hardcoded on every contractor
HomeScreen:175-177, BusinessSearchScreen:145-148, BusinessDetailScreen:634-642, ActiveJobsScreen:196-204, QuoteReviewScreen:391-400, MessagesScreen:1078-1081 — every contractor card and quote card shows an "Escrow Protected" trust badge **regardless of the contractor's actual Stripe Connect status**. Misleading trust claim tied to money safety.

### H8. Hardcoded Unsplash image in quote cards
`src/screens/MessagesScreen.js:996` — every quote card in chat uses a hardcoded `images.unsplash.com/photo-1584622650111-993a426fbf0a` cover image. If Unsplash rate-limits or is offline, every quote card in chat breaks. External dependency in a money-critical UI.

### H9. Hardcoded NYC zip fallback
`src/screens/HomeScreen.tsx:320-321` — IP-geo fallback hardcodes `'10001'`. On IP fetch failure, every user is treated as NYC → wrong "Serves your area" badges, wrong default contractors. Reviewers testing outside NYC will see odd results.

### H10. Claim modal open to unauthenticated users
`src/screens/BusinessDetailScreen.tsx:497-504` — the claim button is NOT gated by `isAuthenticated` (unlike the report button at `:487`). An unauthenticated user can open the claim modal, upload a document to Cloudinary (`:163`), and call `submitClaim` (`:164`). Auth-bypass abuse vector.

### H11. Logout may not unregister push tokens
`src/utils/apiClient.ts:373` — on logout, `post('/users/push-token', { token: '' })` runs with `.catch(() => {})`. If the user is offline at logout, the push token is never cleared server-side → **notifications continue to a logged-out device**. Apple Guideline 4.5.4 (Push) concern.

### H12. No biometric gate on escrow actions
`releaseFunds` and `refundJob` are callable with a long-lived JWT and no step-up auth. For an escrow/fintech app, Apple reviewers often expect Face ID / Touch ID before releasing funds (Guideline 5.0 — discovery). Recommend `expo-local-authentication` before money-action confirms.

---

## MEDIUM — money safety & correctness

### M1. No idempotency keys on payment mutations
`apiClient.ts:978` `releaseFunds`, `:998` `refundJob`, `:968` `createCheckoutSession`, `:983` `markJobComplete`, `:1003` `createChangeOrder` — no `Idempotency-Key` header. A network timeout + user retry can **double-release escrow** or **double-refund**. Critical for a payments app.

### M2. No request timeouts anywhere
`apiClient.ts` `executeRequest` has no `AbortController`. A hung backend request blocks the UI indefinitely. On `PaymentFlowScreen`, a stuck poll freezes the user on a spinner with no escape.

### M3. Payment confirmation relies on client polling, not webhook
`PaymentFlowScreen.tsx:246` — after `presentPaymentSheet` success, the app polls the backend every ~2s for 24s. If polling times out, the user is told "we could not automatically confirm" while Stripe **already captured the funds**. No server webhook acknowledgment is awaited. Money-state divergence risk.

### M4. ActiveJobsScreen "accept quote" never navigates to payment
`ActiveJobsScreen.tsx:83-90` — `handleAcceptQuote` calls `updateQuoteStatus(quoteId, 'accepted')` and reloads the list. On web, acceptance requires payment. Here the quote is marked accepted with no way to pay → job stuck half-accepted. Broken money flow.

### M5. ChangeOrderScreen acceptance has no payment path
`ChangeOrderScreen.tsx:97-101` — `acceptChangeOrder` succeeds and alerts "accepted successfully" but **does not navigate to payment** or explain how the additional amount is charged. The accepted change order creates a financial obligation with no money movement.

### M6. Cancel of a funded job promises refund without confirming
`ActiveJobsScreen.tsx:353-375` — "Cancel Job" for funded states says "refund your payment from escrow" but `handleCancel` (`:112`) only calls `cancelJob`; the app never confirms the refund posted before showing the job as cancelled. User may see "Cancelled" while funds are still held.

### M7. Dispute evidence stored in the wrong Cloudinary folder
`DisputeScreen.tsx:103` — evidence photos uploaded to `CLOUDINARY_FOLDERS.CHAT`, not a DISPUTES folder. If chat assets are ever purged by a retention job, **dispute evidence is destroyed**. Also `MAX_PHOTOS = 3` (`:32`) may be too few vs web.

### M8. License verification sends two different payload shapes
`ContractorDashboardScreen.tsx:292,309` sends base64 directly to `requestVerification`; `ContractorEditProfileScreen.tsx:295` uploads to Cloudinary first and sends a URL. Backend must handle both — fragile. Pick one (URL).

### M9. Silent failure shows $0 earnings
`EarningsScreen.tsx:105` — on API error, `catch { setEarnings(null) }` → screen shows **$0.00** for available, pending, and total balances with no error state. Contractors may panic seeing zero balances during an outage. Also `:81` defaults `feePercent` to 5 (hardcoded) if the fetch fails.

### M10. Onboarding marked complete on failure
`ContractorOnboardingScreen.tsx:182-186,197-202` — on save error, the screen still advances to the next step; on finish failure, it still navigates to the dashboard with `onboardingComplete: true`. Contractors progress with missing data.

### M11. Two different API clients imported across screens
`HomeScreen.tsx:24`, `SavedScreen.tsx:21`, `ActiveJobsScreen.tsx:7`, `JobDetailScreen.tsx:20-30` import from `'../utils/apiClient'`, while `BusinessSearchScreen.tsx:22`, `BusinessDetailScreen.tsx:28`, `QuoteReviewScreen.tsx:16`, `DisputeScreen.tsx:18`, `ReviewScreen.tsx:16`, `ContractorDashboardScreen.tsx:21-41`, `ContractorEditProfileScreen.tsx:21`, `EarningsScreen.tsx:6-7`, `PaymentFlowScreen.tsx:7`, `ChangeOrderScreen.tsx:16`, `ContractorSignupScreen.tsx:19` import from `'../api'`. Two clients can diverge in auth handling, base URLs, and error shapes → silent failures. `src/api/index.ts` is a re-export shim; consolidate to one client.

### M12. Orphan Firebase accounts on signup failure
`ContractorSignupScreen.js:225-257` — creates a Firebase user before the backend profile; if backend fails, attempts `deleteUser(userCreated)` inside an empty `catch {}` → swallows deletion errors. Orphan Firebase accounts accumulate silently.

### M13. Logout-doesn't-restart — actually OK (verified)
`AuthContext.tsx:143` calls `apiLogout()` which does clear SecureStore. Not a bug. Retracted from initial findings.

### M14. Favorites sync only ever adds, never removes
`src/utils/favoritesStore.ts:33-47` — `syncFavoritesWithServer` merges via `new Set([...local, ...serverIds])` (union only). If a user removes a favorite on another device, this sync re-adds it locally → permanent desync.

### M15. Avatar cache is unbounded
`src/utils/avatarUtils.ts:198-199` — `avatarCache` and `bannerCache` are module-level `Map`s with no eviction. Every unique `(name, size, category)` adds an entry forever. On a contractor list with thousands of items, this is an OOM leak. Cache not cleared on logout.

### M16. BottomSheet drag is broken
`src/components/common/BottomSheet.tsx:76` — `translateY.setValue(gestureState.moveY)` uses `moveY` (absolute Y) instead of `dy` (delta). The sheet jumps to finger position instead of following the drag. Severe UX bug.

### M17. BottomSheet/ActionSheet cut exit animations
`BottomSheet.tsx:99` and `ActionSheet.tsx:82` — `if (!visible) return null;` kills the exit animation instantly instead of letting it play. Sheet/sheet disappears with no slide-out.

### M18. Navigation routes not in RootStackParamList
`src/types/index.ts:494-508` `RootStackParamList` is missing `JobDetail`, `QuoteReview`, `PaymentFlow`, `DisputeScreen`, `ReviewScreen`, `ContractorDashboard`, `ChatScreen` (with `conversationId`). Push-notification deep-link navigation (`usePushNotifications.ts:140,165,180,205,213,221`) calls these routes via `navigation.navigate(... as never)` casts → crashes or silent no-ops.

### M19. `useRequireAuth` navigates to a non-existent navigator
`src/hooks/useRequireAuth.ts:26` — `navigation.navigate('Auth', { screen: 'Login', ... })`. There is no `Auth` navigator in `MainNavigator.js`. Hook is broken; any caller gets a navigation error.

### M20. Protected-screen enforcement is cosmetic
`MainNavigator.js:288-316` — the "protection" only shows an `Alert` after the route has already rendered. No navigation guard; protected screens still mount and run side effects (API calls) for an unauthenticated user.

---

## LOW — quality / UX / a11y

### Q1. No accessibility
- No `accessibilityRole`/`accessibilityLabel` on icon-only buttons (back, close, edit, delete).
- No focus trap in modals — Tab navigation escapes to background.
- No `accessibilityLiveRegion` on toasts, offline banner, error states.
- No `accessibilityValue` on star rating slider.
- Skeleton shimmer animates forever — no reduced-motion support (a11y violation).
- No screen-reader announcements for state changes (loading → error → loaded).

### Q2. Dark mode is half-implemented
- `app.json:9` forces `userInterfaceStyle: "light"` → suppresses system dark mode at the native window level.
- Some components check `useColorScheme()` (`StarRating`, `AppHeader`, `GuestPrompt`, `AnimatedSplashScreen`) → dead branches.
- `designTokens.js` has no dark color tokens; `Typography`, `Header`, `Input`, `ActionSheet`, `Modal` all hardcode light colors.
- `Input.tsx:158` label has a hardcoded light background → white box behind label on dark inputs.

### Q3. Below-minimum touch targets
`Button.tsx:199` `size="sm"` is 36px height; Apple HIG requires 44pt. Risk of App Store rejection for small targets.

### Q4. Mixed JS/TS in auth-critical files
`LoginScreen.js`, `RegisterScreen.js`, `ForgotPasswordScreen.js`, `ContractorSignupScreen.js`, `MessagesScreen.js`, `MainNavigator.js` are `.js` while the project is `strict: true` TypeScript. Auth is exactly where you want type safety. These files skip typecheck entirely.

### Q5. Two image-picker libraries installed
`package.json` has both `expo-image-picker: 17.0.10` and `react-native-image-picker: 8.2.1`. `useImagePicker.ts:2` uses the RN one; `ContractorEditProfileModal.tsx:17` uses the Expo one. Inconsistent; inflates binary size. Pick one.

### Q6. Two toast systems installed
`package.json:60` `react-native-toast-message` AND `src/components/common/Toast.tsx` (custom). Inconsistent.

### Q7. Nominatim/Overpass ToS risk
`ServiceAreaMap.tsx:24-26,38-41` uses public OSM Nominatim (1 req/s limit, requires valid UA) and Overpass (`overpass-api.de`, frequently 429s). Not suitable for production. Sequential 10-zip fetch = 10+ seconds. Should use a paid geocoding API or self-host.

### Q8. No EXIF stripping on uploads
`useImagePicker.ts` does not strip EXIF metadata. Uploaded license documents and progress photos may contain GPS coordinates of users' homes. Privacy risk.

### Q9. No request retry/backoff
`apiClient.ts` `executeRequest` either succeeds or throws. Transient 5xx should auto-retry for GETs. No offline queue for sensitive actions.

### Q10. Commit hygiene
All 30 recent commits have the message `est for prdocutiont` (typo). No semantic versioning, no conventional commits, impossible to audit what changed. Incident response is extremely difficult.

### Q11. No tests
Zero automated tests on a payments/escrow app. `api/backend/package.json` test script is `echo "Error: no test specified" && exit 1`.

### Q12. No internationalization
All strings hardcoded. For a contractor marketplace that may need state-by-state legal copy, this is a maintenance risk.

### Q13. Sentry PII risk
`App.js:42` Sentry init has no `beforeSend` to scrub PII. Error breadcrumbs may include emails, addresses, message text.

---

## Prioritized fix plan

### Tier 0 — Ship blockers (fix before any TestFlight submission)
1. **C1** — Replace `pk_test_` with `pk_live_...` in `eas.json:53` production profile. Verify Apple Pay merchant ID.
2. **C2** — Rotate MongoDB password, JWT_SECRET, Cloudinary API secret, Firebase web API key. Run `git filter-repo` to scrub `backend/.env` from history. Restrict the new Firebase key in Google Cloud Console.
3. **C3** — Remove hardcoded `$2800`/`$3200` default line items in `QuoteCreationSheet.tsx:76-78,264-265`. Disable send until a real amount is entered.
4. **C4** — Move all hooks above the conditional return in `JobDetailScreen.tsx:76-103`.
5. **C5** — Fix the "Accept & Pay" button in `QuoteReviewScreen.tsx:430` to show the first-milestone amount, not the full total.
6. **C6** — Fix the password-reset deep-link (`App.js:79`) to pass `oobCode`/token and align backend + email flow.
7. **C7** — Guard `PaymentFlowScreen.tsx:29` against missing/zero `totalAmount`.
8. **C8** — Fix Apple Sign-In returning-user flow in `apiClient.ts:1127` to accept `appleUserIdentifier` when `identityToken` is null.

### Tier 1 — App Store rejection risks
9. **H1** — Remove `NSMicrophoneUsageDescription` and `RECORD_AUDIO` (or implement voice messages).
10. **H2** — Guard `firebaseConfig.js` init failure path; don't return `{}`.
11. **H3** — Remove hardcoded `'0'` stats in `ProfileScreen.tsx:505` or fetch real counts.
12. **H4** — Wire notification toggles in `ProfileScreen.tsx:603` to a preferences endpoint.
13. **H5/H6** — Fix `AnalyticsTab.tsx:30,42,47,80` status filter to `completed_paid`; make the date-range selector actually filter.
14. **H8** — Replace the hardcoded Unsplash URL in `MessagesScreen.js:996` with a local asset or generated image.
15. **H9** — Remove the `10001` NYC fallback in `HomeScreen.tsx:320`; show a "choose your location" prompt instead.
16. **H10** — Auth-gate the claim button in `BusinessDetailScreen.tsx:497`.
17. **H11** — Retry push-token unregister on next app foreground if logout was offline.
18. **H12** — Add `expo-local-authentication` biometric prompt before `releaseFunds`/`refundJob`.

### Tier 2 — Money safety
19. **M1** — Add `Idempotency-Key` header to all payment mutations in `apiClient.ts`.
20. **M2** — Add `AbortController` + 30s timeout to `executeRequest`.
21. **M3** — After `presentPaymentSheet` success, await a backend confirmation call (server checks webhook) rather than client-side polling only.
22. **M4** — `ActiveJobsScreen.tsx:83` accept-quote should navigate to PaymentFlow.
23. **M5** — `ChangeOrderScreen.tsx:97` accept should navigate to a payment flow for the delta.
24. **M6** — `ActiveJobsScreen.tsx:353` cancel should poll/confirm refund before showing "Cancelled".
25. **M7** — Add `DISPUTES` to `CLOUDINARY_FOLDERS` and use it in `DisputeScreen.tsx:103`.
26. **M8** — Standardize license verification to always upload to Cloudinary first and send a URL.
27. **M9** — `EarningsScreen.tsx:105` show an error state instead of $0 on API failure.
28. **M10** — `ContractorOnboardingScreen.tsx:182,197` don't advance on save error.

### Tier 3 — Correctness & UX
29. **M11** — Consolidate to one API client import path across all screens.
30. **M14** — Fix `favoritesStore.ts` sync to remove favorites removed on other devices.
31. **M15** — Add LRU eviction to `avatarUtils.ts` avatar/banner caches; clear on logout.
32. **M16** — Fix `BottomSheet.tsx:76` to use `gestureState.dy` instead of `moveY`.
33. **M17** — Fix `BottomSheet.tsx:99`/`ActionSheet.tsx:82` to play exit animation before unmount.
34. **M18** — Add missing routes to `RootStackParamList` in `types/index.ts:494`.
35. **M19/M20** — Fix `useRequireAuth` and add a real navigation guard in `MainNavigator.js`.
36. **Q4** — Convert `LoginScreen.js`, `RegisterScreen.js`, `ForgotPasswordScreen.js`, `ContractorSignupScreen.js`, `MessagesScreen.js`, `MainNavigator.js` to TypeScript.
37. **Q5/Q6** — Pick one image-picker library and one toast system; remove the other.

### Tier 4 — Hardening
38. **Q1** — Accessibility pass: roles, labels, focus trap, reduced-motion, live regions.
39. **Q2** — Either fully implement dark mode (tokens + `app.json` userInterfaceStyle `"automatic"`) or remove the `useColorScheme` branches.
40. **Q3** — Enforce 44pt min touch targets on `Button` sm and all icon buttons.
41. **Q8** — Strip EXIF on image upload in `useImagePicker.ts`.
42. **Q13** — Add `beforeSend` to Sentry init to scrub PII.
43. Add integration tests for auth, escrow release/refund, Stripe webhook confirmation, Apple Sign-In returning user.

### Effort estimate
- Tier 0: ~1–2 days (mostly secrets rotation + 8 small code fixes).
- Tier 1: ~3–4 days (10 fixes, some cross-cutting).
- Tier 2: ~3–5 days (money-safety hardening + idempotency + webhook ack).
- Tier 3: ~3–4 days (consolidation, navigation, TS conversion of auth files).
- Tier 4: ~3–5 days (a11y, dark mode, tests).
- **Total to App Store–ready: ~2–3 weeks** of focused work, assuming the web backend already has the matching endpoints (idempotency, webhook ack, Firebase `oobCode` reset, `appleUserIdentifier` login).

---

## What's already good (keep these)
- **Firebase + JWT exchange** with SecureStore token persistence and single-flight refresh on 401 — solid pattern.
- **Sentry** is wired with source maps (`app.json:80`).
- **expo-updates** OTA configured (`app.json:142-144`).
- **Apple Sign-In** is implemented (just needs the returning-user fix).
- **Socket.IO** messaging with optimistic send + retry on attachment failure.
- **PullToRefresh**, **SkeletonLoader**, **LazyImage**, **OfflineBanner** — the right primitives exist.
- **EarningsScreen** fetches the dynamic `platformFeePercent` (just defaults to 5 on error).
- **JobDetailScreen** correctly guards `contractor.stripeAccountId` and `stripeAccountChargesEnabled` before "Complete Payment".
- **VerifiedBadge** is a polished animated SVG.
- **NotificationsContext** groups by Today/Yesterday/Earlier with deep-link routing.
- **haptics.ts** utility exists (just needs to be wired into buttons + reduced-motion check).

The foundation is real; the gaps are concentrated in **secrets hygiene, payment-config, deep-link/auth edge cases, and a handful of misleading/fake data surfaces**. Fix Tier 0 + Tier 1 and this should pass App Review. Fix Tier 2 before letting real money flow through it.
