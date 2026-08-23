# Ratedeed Mobile ↔ Web — Feature Parity Audit (2026-08-22)

**Scope:** `/Users/tamim/Desktop/ratedeedmobile` (Expo/React Native) vs `/Users/tamim/Desktop/Ratedeed` (Next.js web).
**Method:** Screen-by-screen and API-by-API comparison (mobile `src/screens` + `src/utils/apiClient.ts` vs web `src/app` + `src/lib/api.ts`), cross-referenced with the mobile 08-13 audit (95 findings) and the web audits.

---

## Verdict

**The mobile app matches the web on every core user flow — homeowner and contractor — and is a superset in messaging, auth, and notifications.** The web-only surfaces are exactly the ones that belong on web (admin console, SEO/marketing pages, blog, embed widget). The gaps that matter are **mobile-side behavior bugs that break parity** with the intended web flow (Section 3), not missing features.

---

## 1. Feature parity matrix

| Feature | Web | Mobile | Status |
|---|---|---|---|
| Browse/explore | `/`, `/directory`, `/contractors/*` | HomeScreen (Explore) | ✅ |
| Contractor search | `/search` | BusinessSearchScreen | ✅ |
| Business profile | `/c/[slug]` | BusinessDetailScreen (+Request Quote, Message, Save, Reviews) | ✅ |
| Saved | `/saved` | SavedScreen | ✅ |
| Social feed + posts | `/post` | Feed + `createPost`/`likePost`/`commentOnPost` | ✅ |
| Messaging | `/messages`, `/chat/[id]` (sockets) | MessagesScreen (sockets, offline queue, read receipts) | ✅ mobile superset |
| Block/unblock, report conversation | — | `blockUser`, `reportConversation` | 🟢 mobile-only |
| Jobs (homeowner) | `/jobs`, `/jobs/[id]` | ActiveJobsScreen, JobDetailScreen | ✅ |
| Quotes | `/quote-review` | QuoteReviewScreen | ⚠️ flow bug (§3.1) |
| Payment | `/payment` | PaymentFlowScreen (Stripe + Apple Pay) | ⚠️ money bug (§3.2) |
| Payout (contractor) | `/payout` | EarningsScreen + `requestPayout` | ⚠️ error bug (§3.3) |
| Reviews | `/review`, `/review/[id]` + respond | ReviewScreen + `submitReview`/`respondToReview` | ✅ |
| Disputes | `/dispute` | DisputeScreen (`raiseDispute`/`cancelDispute`/`resolveDispute`) | ✅ |
| Change orders | — (web: contractor dashboard) | ChangeOrderScreen (`accept`/`decline`/`create`) | ✅ |
| Escrow ops | `/payment` + admin | `releaseFunds`, `refundJob`, `markJobComplete` | ✅ |
| Contractor dashboard | `/contractor-dashboard` | ContractorDashboardScreen | ✅ |
| Contractor onboarding | `/contractor-onboarding` | ContractorOnboardingScreen | ⚠️ nav bug (§3.5) |
| Contractor edit profile | `/contractor-edit` | ContractorEditProfileScreen | ✅ |
| Contractor signup | `/contractor-signup` | ContractorSignupScreen | ✅ |
| Contractor analytics | `/analytics` | Analytics tab in dashboard | ✅ |
| Contractor leads | dashboard leads | `getContractorLeads` + `updateLeadStatus` | ✅ |
| Verification/claims | contractor profile flows | `submitClaim`, `requestVerification` | ✅ |
| Affiliate program | `/affiliate` | AffiliateScreen (`requestAffiliatePayout`, Stripe Connect) | ✅ |
| Notifications | **none** | NotificationsScreen + prefs + push tokens | 🟢 mobile-only (web gap) |
| Auth | `/login`, `/signup`, reset/verify | Login/Register/Forgot/Reset/VerifyEmailChange + **Apple Sign-In** | ✅ mobile superset |
| Email change | `/verify-email-change` | VerifyEmailChangeScreen | ✅ |
| Guest browsing | public SEO pages | GuestPrompt on Home/BusinessDetail | ✅ |
| Admin console (17 sections) | `/admin/*` | — | 🅰️ web-only (correct) |
| Blog / SEO pages / legal | `/blog`, `-in-` money pages, `/legal/*`, sitemap/robots | — | 🅰️ web-only (correct) |
| Contractor embed widget | `/c/[slug]/widget` | — | 🅰️ web-only (correct) |

🟢 = mobile-ahead · ⚠️ = parity risk (see §3) · 🅰️ = intentionally web-only

---

## 2. Mobile is ahead of web (not gaps — wins)

1. **Notifications center** — mobile has a full screen with prefs, unread/read, mark-all; **web has no notifications route at all** (verified: no `/notifications` in `src/app`). Contractors/homeowners on web currently only get in-app toasts at best.
2. **Apple Sign-In** — mobile-only.
3. **Socket messaging** — offline queue, read receipts, typing, online status, message delete/edit sync — full duplex client.
4. **Blocked users + report conversation** — mobile-only `blockUser`/`unblockUser`/`reportConversation`.

---

## 3. Parity-breaking mobile bugs (from 08-13 audit, cross-checked against web behavior)

These make mobile behave differently from the web's approved flow — fix order matters:

| # | Mobile bug | Web behavior (correct) | Impact |
|---|---|---|---|
| 3.1 | **ActiveJobsScreen.tsx:253** — tapping a quote card goes to PaymentFlow, bypassing QuoteReview; even declined quotes open the pay screen | Web routes quote action only via `/quote-review` (accept/decline, milestones, escrow explainer) | Homeowner can pay a declined quote; escrow-trust UX skipped |
| 3.2 | **PaymentFlowScreen.tsx:33** — amount treated as dollars while callers pass cents (×100) | Web payment uses cents consistently | **Money bug** — verify payment amounts before any release |
| 3.3 | **EarningsScreen.tsx:111** — fetch error silently renders $0.00 + disabled withdraw, no retry | Web `/payout` must surface load errors | Contractor believes balance is $0 |
| 3.4 | **HomeScreen.tsx:811** — Explore zip search never updates the zip the category rows use (silent no-op) | Web `/search` applies the query server-side | Location search appears broken on the default tab |
| 3.5 | **ContractorOnboardingScreen.tsx:292 / LoginScreen redirect** — "Go to Dashboard" resets to Explore (index:0), dashboard never mounts, onboarding never auto-triggers | Web `/contractor-dashboard` routes to onboarding when incomplete | First-run contractor funnel broken |
| 3.6 | **MessagesScreen.js:1299** — chat deep-link fallback opens the first conversation instead of an error | Web `/chat/[id]` 404s | Wrong-recipient risk |

---

## 4. Shared backend — implications

Both apps hit the same API (`api.ratedeed.com`), so backend bugs affect both (web audits cover them). The mobile `apiClient.ts` (1,478 lines, ~130 exported functions) covers the full backend surface — including money ops (`releaseFunds`, `refundJob`, `resolveDispute`) with **no admin surface duplicate in mobile**, which is correct.

---

## 5. Recommended actions

1. **Fix §3.2 first** (cents/dollars in PaymentFlowScreen) — verify against a real Stripe payment intent before any money moves; confirm web `/payment` path uses the same value correctly.
2. **Fix §3.1** — gate quote-card tap by status and route through QuoteReview.
3. **Fix §3.5** — `navigation.reset({ index: 1 })` or replace with the dashboard.
4. **Fix §3.4 / §3.6 / §3.3** — zip sync, conversation fallback guard, error/retry state.
5. **Port the notifications center to web** — the web has no notifications surface while mobile does; this is the single biggest web gap found in the audit.