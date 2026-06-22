# Ratedeed Mobile — Full UI + Messaging Audit

**Date:** Jun 22 2026
**Scope:** Full audit of all 28 mobile screens + messaging system. ~15,000 LOC read line-by-line. Homeowner journey, contractor journey, auth flows, messaging, push notifications, navigation.
**Verdict:** **~80% ready.** The core flows work for both roles. But there are **3 critical bugs** (onboarding is unreachable, new-conversation messages vanish, deep-link opens wrong chat), **2 still-broken issues from the prior audit** (Unsplash URL, online status not rendered), and the contractor onboarding auto-redirect makes the entire wizard dead code on mobile.

---

## Scorecard

| Area | Readiness | Key Issue |
|---|---|---|
| Homeowner search/browse | 80% | Hardcoded NYC zip fallback; name search is client-side only |
| Contractor profile | 85% | Fake on-time stat (98%); no safe-area on bottom CTA |
| Quote request/review | 75% | Accept doesn't call backend; no back button on some screens |
| Payment/escrow | 80% | No error UI when payment intent fails; $0 guard works |
| Job management | 80% | Hooks order fixed; completionNotes never set; chat opens list not thread |
| Reviews | 70% | No duplicate-review guard; no haptic on star tap |
| Disputes | 65% | Evidence to wrong Cloudinary folder; amount may show cents as dollars |
| Contractor dashboard | 75% | 8 tabs functional; profile-completion banner is dead code; earnings mismatch |
| Contractor onboarding | 10% | **CRITICAL: auto-redirect on mount makes the entire wizard unreachable** |
| Contractor signup | 80% | Works; password policy inconsistent; no ToS checkbox |
| Analytics | 50% | Date range selector is non-functional; 2 hardcoded stubs |
| Earnings | 60% | No error state (shows $0); hardcoded 5% in transaction rows; no withdraw |
| Messaging | 70% | See messaging section below |
| Auth | 75% | Works; password policy inconsistent; Firebase init crash path |
| Notifications | 65% | Deep-links broken for /payment (shows $0) and /review (missing contractorId) |
| Navigation | 85% | All screens registered; unread badge on Messages tab; AppHeader is dead code |

---

## CRITICAL — must fix

### C1. Contractor onboarding is unreachable (auto-redirect on mount)
`ContractorOnboardingScreen.tsx:42-47` — `useEffect(() => { navigation.reset({ index: 0, routes: [{name:'Main'},{name:'ContractorDashboard'}] }); }, [navigation])` runs on every mount and instantly resets the stack to the dashboard. The entire 7-step wizard (lines 26-592) is dead code. A contractor can never complete onboarding on mobile — they land on the dashboard with an incomplete profile, no services, no Stripe Connect.
**Fix:** Remove the unconditional `navigation.reset`. Gate it behind `if (profile.onboardingComplete === true)` or remove entirely (the web version was rebuilt to 3 steps — the mobile version should match).

### C2. New-conversation messages vanish (race condition)
`MessagesScreen.js:749-832` — When starting a new conversation: `handleSendMessage` creates the conversation (`:750`), adds an optimistic message (`:784`), then `setSelectedConversation` fires a `useEffect` (`:683-690`) that calls `loadMessages(cId, 1)`. `loadMessages` page 1 does `setMessages([...msgs])` (`:661`), which **wipes the optimistic message**. The async send then tries to match `tempId` to replace with the server response (`:816`), but `tempId` is gone. The user's first message disappears until a manual refresh.
**Fix:** Don't call `loadMessages` if there's an in-flight optimistic message, or re-insert the optimistic message after `loadMessages` resolves.

### C3. Deep-link fallback opens the WRONG conversation
`MessagesScreen.js:1193-1198` — If `route.name === "ChatScreen"` and `selectedConversation` is null and conversations are loaded, it picks `conversations[Object.keys(conversations)[0]]` — the first conversation by key order, not the one from `route.params.conversationId`. A push notification tap for chat X can open chat Y.
**Fix:** Find the conversation by `route.params.conversationId` instead of picking `keys()[0]`.

---

## HIGH — broken or missing functionality

### H1. Hardcoded Unsplash URL still in quote cards (prior audit H8 — not fixed)
`MessagesScreen.js:1026-1028` — every quote card cover uses `https://images.unsplash.com/photo-1584622650111-993a426fbf0a...`. If Unsplash rate-limits or is down, every quote card in every chat breaks. Should use the contractor's banner/portfolio image or a local asset.

### H2. Online status computed but not rendered in chat header
`MessagesScreen.js:1189` — `chatOnline` is computed but the chat header (`:1254-1273`) only renders avatar + name + verified badge. The green dot exists in the conversation list (`:305`) but not in the chat thread itself. Also, no initial online-status fetch on conversation join — nobody appears online until a broadcast event happens.

### H3. Notification deep-links broken for /payment and /review
`NotificationsScreen.tsx:270-274` — `/payment/` extracts `quoteId` but `PaymentFlowScreen` also needs `totalAmount`. Without it, `paymentAmount = 0`, button is disabled, user sees "$0.00" dead-end.
`NotificationsScreen.tsx:281-284` — `/review/` extracts `jobId` but `ReviewScreen` needs `contractorId` (`ReviewScreen.tsx:47`). Tapping a review notification throws "Missing contractor information."
**Fix:** Pass all required params from the notification payload, or fetch the quote/job before navigating.

### H4. Analytics date range selector is non-functional
`AnalyticsTab.tsx:25,201-211` — `setDateRange` only updates the dropdown label. None of the `useMemo` calculations (`kpiData`, `earningsData`, `serviceBreakdown`, `topClients`, `recentActivity`) reference `dateRange`. Selecting "This Week" shows the same all-time data as "This Year."

### H5. QuoteReview accept doesn't call backend
`QuoteReviewScreen.tsx:113-141` — `handleAccept` navigates straight to `PaymentFlow` with `quoteId` but never calls `updateQuoteStatus(quoteId, 'accepted')`. If the user backs out of payment, the quote stays `pending` forever. ActiveJobs shows "Pending User Approval" with no path forward.

### H6. Profile-completion banner is dead code
`ContractorDashboardScreen.tsx:775` — `showBanner` is hardcoded `false`. The entire banner UI (`:780-820`) including the "Complete Setup" button is unreachable. Contractors with incomplete profiles get no nudge to finish.

### H7. DisputeScreen amount may show cents as dollars
`DisputeScreen.tsx:201-202` — `$${jobAmount.toLocaleString()}` treats `jobAmount` as dollars, but `getJobById` returns `totalAmount` which elsewhere is treated as cents (`JobDetailScreen.tsx:376` divides by 100). A $10,000 job shows as "$1,000,000".

### H8. Dispute evidence uploaded to wrong Cloudinary folder
`DisputeScreen.tsx:148` — `CLOUDINARY_FOLDERS.CHAT` instead of a `DISPUTES` folder. Evidence photos mixed with chat photos; if chat assets are purged, dispute evidence is destroyed.

---

## MEDIUM — UI gaps and inconsistencies

### M1. ProfilePage notification toggles are fake
`ProfileScreen.tsx:631-639` — `Toggle`'s `onValueChange` is never passed. Toggling does nothing persistent.

### M2. Contractor dashboard earnings mismatch with EarningsScreen
`ContractorDashboardScreen.tsx:1317-1341` — dashboard "Total Earnings" computed from `jobs` list (gross). `EarningsScreen.tsx` uses `getContractorEarnings` endpoint (net × 0.95). Two screens show different numbers for the same data.

### M3. EarningsScreen shows $0 on error
`EarningsScreen.tsx:105-106` — `catch { setEarnings(null) }` → screen shows $0.00 for all balances with no error state. Contractor can't tell "no earnings" from "failed to load."

### M4. EarningsScreen transaction rows hardcode 5% fee
`EarningsScreen.tsx:172-173` — "Fee (5%) / Net (95%)" hardcoded in transaction breakdown, even though the screen fetches `getPlatformFeePercent` for the info card. Transaction rows show wrong numbers when fee ≠ 5%.

### M5. Analytics has 2 hardcoded stubs
`AnalyticsTab.tsx:74,306-307` — `avgResponseTime: '—'` and `onTimeCompletion: { value: 0, displayValue: '—' }`. Displayed as if real.

### M6. License verification sends 3 different payload shapes
- `ContractorDashboardScreen.tsx:319` — base64 data URI
- `ContractorEditProfileScreen.tsx:295-298` — Cloudinary URL
- `ContractorOnboardingScreen.tsx` — (unreachable, but would be a third shape)
Backend must handle all three. Fragile.

### M7. Firebase init crash path not fixed
`firebaseConfig.js:26-27` — on init failure, `app = {}; auth = {}`. Downstream callers (`LoginScreen.js:74`, `AuthContext.tsx:234`) invoke methods on it unconditionally → crash in Firebase-restricted regions.

### M8. Microphone permission still declared but unused
`app.json:28,71` — `NSMicrophoneUsageDescription` + `RECORD_AUDIO`. No voice recording feature exists. (Apple approved anyway, but it's a future rejection risk if they re-review.)

### M9. No missed-messages sync on app foreground
`apiClient.ts:491-505` — on app active, socket reconnects but conversations/messages are never re-fetched. Messages received while backgrounded are invisible until manual pull-to-refresh or a new socket event.

### M10. Socket auth token not refreshed on JWT refresh
`AuthContext.tsx:201-228` — `setAuthTokenUpdatedCallback` updates React state but never updates `socket.auth`. The socket keeps the old JWT until a `connect_error` triggers recovery. Can cause silent auth failures.

### M11. Logged-out push notification tap is a no-op
`usePushNotifications.ts:261,268` — `if (!isAuthenticated) return;`. Tapping a message notification while logged out does nothing — no redirect to login, no queueing.

### M12. AppHeader is dead code
`AppHeader.tsx` — imported by nothing. The menu button has no `onPress`. The whole component is unused.

### M13. ContractorEditProfileScreen is unreachable
`MainNavigator.js:359` registers it, but no `navigation.navigate('ContractorEditProfile')` call exists anywhere. The dashboard's inline edit sheet is used instead.

### M14. Password policy inconsistent
`RegisterScreen.js:97-115` requires 8+ chars + uppercase + number + special. `ResetPasswordScreen.tsx:44` requires only 6 chars. `ContractorSignupScreen.js` requires 8 but no complexity.

### M15. No "already reviewed?" guard
`ActiveJobsScreen.tsx:292-307` — "Leave a Review" shows for all `completed_paid` jobs with no check if a review already exists. Can submit duplicates.

---

## MESSAGING — specific findings

### What works
- ✅ Send/receive text messages with optimistic UI + retry
- ✅ Image attachments via Cloudinary (5MB limit, images only)
- ✅ Quote creation from chat (contractors only, Stripe-gated)
- ✅ Quote cards display with "Review Details" → QuoteReview
- ✅ Block/unblock from ActionSheet
- ✅ Typing indicators inside an open thread
- ✅ Read receipts (✓→✓✓) when server emits `messageRead`
- ✅ Message pagination (50/page, "Load older" button)
- ✅ Character counter (500 max)
- ✅ Haptics on send, conversation select, image pick
- ✅ Pull-to-refresh on conversation list
- ✅ Unread badge on Messages tab
- ✅ Keyboard handling with `KeyboardAvoidingView`
- ✅ Safe-area insets on composer + modals

### What's broken
- ❌ New-conversation messages vanish (C2 above)
- ❌ Deep-link opens wrong conversation (C3 above)
- ❌ Hardcoded Unsplash URL in quote cards (H1)
- ❌ Online status not rendered in chat header (H2)
- ❌ No "you were blocked" UX for the blockee
- ❌ No blocked badge on conversation rows
- ❌ `deleteConversation` imported but never wired to UI
- ❌ No missed-messages sync on foreground
- ❌ Socket auth token stale after JWT refresh
- ❌ Logged-out push tap does nothing
- ❌ No typing indicator in conversation list (thread-only)
- ❌ No pull-to-refresh on message thread
- ❌ No inline accept/decline on quote cards (must navigate to QuoteReview)
- ❌ QuoteCreationSheet: no date picker, photos orphaned on failure, state not reset on cancel

---

## Prioritized fix plan

### Tier 0 — Critical (fix before release)
1. **C1** — Remove the auto-redirect in ContractorOnboardingScreen (or rebuild to match web 3-step version)
2. **C2** — Fix new-conversation message vanishing race
3. **C3** — Fix deep-link opening wrong conversation
4. **H3** — Fix notification deep-links for /payment (pass totalAmount) and /review (pass contractorId)
5. **H5** — Call `updateQuoteStatus('accepted')` before navigating to payment
6. **H7** — Fix DisputeScreen amount display (divide by 100 if backend returns cents)
7. **H8** — Upload dispute evidence to `CLOUDINARY_FOLDERS.DISPUTES` not `CHAT`

### Tier 1 — High (fix in v1.0.1)
8. **H1** — Replace hardcoded Unsplash URL with local asset or contractor image
9. **H2** — Render online status dot in chat header; fetch initial status on conversation join
10. **H4** — Make analytics date range actually filter data
11. **H6** — Enable the profile-completion banner (remove hardcoded `false`)
12. **M7** — Guard Firebase init failure path
13. **M9** — Re-fetch conversations on app foreground
14. **M10** — Update socket auth on token refresh
15. **M11** — Redirect to login on logged-out push tap

### Tier 2 — Medium (backlog)
16. **M1** — Wire notification toggles to API
17. **M2** — Unify earnings math between dashboard and EarningsScreen
18. **M3** — Add error state to EarningsScreen
19. **M4** — Use dynamic fee in EarningsScreen transaction rows
20. **M5** — Remove analytics stubs
21. **M6** — Standardize license verification to Cloudinary URL
22. **M8** — Remove unused microphone permission (or implement voice messages)
23. **M12** — Delete dead AppHeader component
24. **M13** — Delete dead ContractorEditProfileScreen
25. **M14** — Unify password policy
26. **M15** — Add "already reviewed?" guard

### Tier 3 — Messaging polish
27. Add "you were blocked" UX
28. Wire `deleteConversation` to ActionSheet
29. Add typing indicator to conversation list
30. Add pull-to-refresh on message thread
31. Add inline accept/decline on quote cards
32. Fix QuoteCreationSheet date picker + photo orphaning + state reset
33. Add missed-messages sync on network reconnect

### Effort estimate
- Tier 0: ~2 days (7 fixes, C1 is the biggest — either remove the redirect or rebuild onboarding)
- Tier 1: ~2-3 days (8 fixes, mostly small)
- Tier 2: ~2 days (11 small fixes)
- Tier 3: ~2-3 days (7 messaging improvements)
- **Total: ~1-1.5 weeks** to close all mobile gaps.
