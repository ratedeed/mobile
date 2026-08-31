# ratedeedmobile — Mobile Affiliate & Referral System Deep-Dive Audit

**Date:** August 30, 2026  
**Audited Repository:** `/Users/tamim/Desktop/ratedeedmobile`  
**Multi-Agent Execution:** 38 subagents with adversarial skeptic verification  
**Total Verified Findings:** 30

---

## Executive Summary

A dedicated multi-agent audit was conducted on the Mobile Affiliate & Referral system (`AffiliateScreen.tsx`, `ContractorSignupScreen.js`, `RegisterScreen.js`, `apiClient.ts`, `App.js`, and `usePushNotifications.ts`).

The audit confirmed **30 verified defects** that directly affect earnings display (`+$NaN` bug), referral attribution during registration, Stripe Express onboarding return deep links, and push notification routing.

### Severity Breakdown

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| **Critical** | 0 | Homeowner Signup Omits Referral Attribution, Broken Mobile Payout Request Closure |
| **High** | 11 | `+$NaN` Earnings Display Bug, `Invalid Date` on Referred Contractors, Missing `platform: mobile` in Stripe Connect Call |
| **Medium** | 15 | Missing Pull-to-Refresh in AffiliateScreen, Hardcoded Minimum Payout Text, Unhandled Stripe Express Dismissal |
| **Low** | 4 | Share Sheet Default Copy Improvements, Clipboard Toast Feedback |

---

## HIGH Severity Issues (11)

### 1. [HIGH] Mismatched Earnings Schema Properties Cause +$NaN Display and Blank Job/Contractor Labels
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `api-network`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:316-320`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The earnings list accesses e.amount, e.contractorName, and e.jobId. However, the backend MongoDB schema and /api/affiliate/stats endpoint return commissionAmount, referredContractor ({ _id, companyName, category }), and job (ObjectId). The fields e.amount and e.contractorName do not exist.

#### Impact on Mobile Users & Affiliates
Because e.amount, e.contractorName, and e.jobId are undefined on AffiliateEarning documents, (e.amount / 100).toFixed(2) produces NaN, causing the UI to display '+$NaN' for every commission earning. Contractor names always default to 'Commission' and job IDs show empty 'Job #'.

#### Adversarial Verification Analysis
CONFIRMED: The defect is genuine and verified directly against both the mobile and backend codebases.

1. Backend Schema & Route Inspection:
- In /Users/tamim/Desktop/Ratedeed/api/backend/models/AffiliateEarning.js (lines 9-30), the schema defines `referredContractor` (ObjectId ref Contractor), `job` (ObjectId ref Job), `commissionAmount` (Number in cents), `jobAmount` (Number), and `feeCollected` (Number). It does NOT define `amount`, `contractorName`, or `jobId`.
- In /Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js (lines 78-83, 126), the GET /api/affiliate/stats endpoint fetches earnings via `AffiliateEarning.find({ affiliate: user._id }).populate('referredContractor', 'companyName category').sort({ createdAt: -1 }).limit(50).lean()` and returns them as `res.json({ ..., earnings })`.

2. Mobile Client Inspection:
- In /Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts (lines 1534-1537), `getAffiliateStats` returns the raw API response without transformation.
- In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx (line 63), `setEarnings(res.earnings || [])` stores the unmapped backend documents.
- In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx (lines 316-320):
  - Line 316: `e.contractorName` is `undefined`, so `e.contractorName || 'Commission'` always evaluates to `'Commission'` rather than displaying `e.referredContractor?.companyName`.
  - Line 317: `e.jobId` is `undefined`, so `e.jobId?.slice(-6) || ''` evaluates to `''`, rendering `Job #` without an ID.
  - Line 320: `e.amount` is `undefined`, so `(e.amount / 100).toFixed(2)` computes `(NaN).toFixed(2)` which produces `"NaN"`, rendering `+$NaN` for every earning in the list.

3. Defenses / Mitigations:
- There are no fallback mappings, data adapters, or defensive checks anywhere between the network layer and JSX rendering.

High severity is confirmed as this completely breaks the display of monetary earnings in the affiliate earnings log with `+$NaN`.

#### Exact Code Remediation
Update mapping to use formatCents(e.commissionAmount || 0), e.referredContractor?.companyName || e.contractorName || 'Commission', and (e.job?._id || e.job || '').toString().slice(-6).

---

### 2. [HIGH] Referred Contractors Tab Accesses Undefined Fields Resulting in 'Invalid Date' and Missing Company Names
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:286-287`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The contractor list accesses c.name and c.joinedAt. The backend /api/affiliate/stats endpoint formats and returns companyName and signupDate. As a result, c.name is undefined and new Date(c.joinedAt) receives undefined, evaluating to Invalid Date.

#### Impact on Mobile Users & Affiliates
Referred contractor cards render 'Invalid Date' for signup timestamps and generic 'Contractor' instead of the actual company name.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx (lines 286-287), the referred contractors list iterates over `contractors` and accesses `c.name` and `c.joinedAt`. In the backend route /api/affiliate/stats (/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js:65-75), the returned objects in `referredContractors` are formatted as { id, companyName, category, slug, signupDate, daysElapsed, daysRemaining, isActiveWindow }. Because the backend provides `companyName` and `signupDate` instead of `name` and `joinedAt`, `c.name` evaluates to undefined (falling back to the generic string 'Contractor') and `c.joinedAt` evaluates to undefined, causing `new Date(undefined).toLocaleDateString()` to render 'Invalid Date' on every contractor card. There are no client-side transformers or fallback handlers in apiClient.ts or AffiliateScreen.tsx mitigating this bug.

#### Exact Code Remediation
Reference c.companyName || c.name || 'Contractor' and new Date(c.signupDate || c.joinedAt || c.createdAt).toLocaleDateString(). Also display c.category trade badges where present.

---

### 3. [HIGH] Missing Mobile Platform Param in Stripe Connect Call Breaks App Return Deep Linking
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `push-deeplink`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1544-1547`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
createAffiliateStripeConnect sends an empty POST body {} to /api/affiliate/stripe-connect. The backend checks req.body.platform === 'mobile' to determine whether to emit a custom scheme return_url. Without platform: 'mobile', isMobile evaluates to false.

#### Impact on Mobile Users & Affiliates
Stripe Express onboarding links generate web return URLs (https://www.ratedeed.com/affiliate?stripe_success=true) instead of deep links (ratedeed://affiliate?stripe_success=true). After finishing bank verification in WebBrowser, the user is left on web rather than seamlessly returning to the mobile app to sweep pending commissions.

#### Adversarial Verification Analysis
Confirmed. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1544-1547), `createAffiliateStripeConnect` invokes `post(`${API_BASE}/affiliate/stripe-connect`, {}, authHeaders)` with an empty body `{}`.

The backend endpoint `/api/affiliate/stripe-connect` in `/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js` (lines 184-193) explicitly evaluates:
```javascript
const isMobile = (req.body && req.body.platform === 'mobile');
const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: isMobile ? 'ratedeed://affiliate?stripe_refresh=true' : `${baseUrl}/affiliate?stripe_refresh=true`,
    return_url: isMobile ? 'ratedeed://affiliate?stripe_success=true' : `${baseUrl}/affiliate?stripe_success=true`,
    type: 'account_onboarding',
});
```
Because `{ platform: 'mobile' }` is omitted in `createAffiliateStripeConnect` (unlike `getStripeConnectUrl` at line 1200 which passes `{ platform: 'mobile' }`), `isMobile` evaluates to `false`. Stripe Express onboarding is created with web return URLs (`https://www.ratedeed.com/affiliate...`) instead of the app custom scheme (`ratedeed://affiliate...`), preventing the browser session from deep linking back into the mobile application upon onboarding completion.

#### Exact Code Remediation
Pass { platform: 'mobile' } in the POST body: return post(`${API_BASE}/affiliate/stripe-connect`, { platform: 'mobile' }, authHeaders);

---

### 4. [HIGH] Primary Card Connect Stripe Action Button is Disabled and Routes to Payout Modal Instead of Stripe Flow
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:204-213`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The primary action button sets disabled={!hasStripeConnected || affiliateBalance < 1000} and onPress={() => setShowModal(true)}. When !hasStripeConnected, the button is disabled despite showing 'Connect Stripe', and its handler points to the payout modal rather than handleConnectStripe.

#### Impact on Mobile Users & Affiliates
When a user does not have Stripe connected, the main card button displays 'Connect Stripe' but is completely disabled and unresponsive. If pressed, it would open the payout request modal instead of initiating Stripe onboarding.

#### Adversarial Verification Analysis
Verified against /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx lines 204-213.

The primary action button on the Balance Card is defined as:
```tsx
<TouchableOpacity
  onPress={() => setShowModal(true)}
  disabled={!hasStripeConnected || affiliateBalance < 1000}
  className={`px-4 py-3 rounded-xl ${!hasStripeConnected || affiliateBalance < 1000 ? 'bg-slate-200 dark:bg-neutral-800' : 'bg-indigo-600'}`}
>
  <Text className={`font-bold text-xs ${!hasStripeConnected || affiliateBalance < 1000 ? 'text-slate-500 dark:text-neutral-500' : 'text-white'}`}>
    {!hasStripeConnected ? 'Connect Stripe' : affiliateBalance < 1000 ? 'Min $10' : 'Withdraw'}
  </Text>
</TouchableOpacity>
```

When `!hasStripeConnected` is true:
1. The button label displays 'Connect Stripe'.
2. The button is disabled because `disabled={!hasStripeConnected || ...}` evaluates to true.
3. The button handler is statically bound to `() => setShowModal(true)` (the payout withdrawal modal) rather than `handleConnectStripe`.

While there is a separate yellow alert banner above the card (lines 175-193) with a working 'Connect Stripe' button that calls `handleConnectStripe`, the primary CTA on the balance card itself is non-functional, misleadingly labeled, disabled, and misrouted. The finding is confirmed.

#### Exact Code Remediation
Branch the button behavior: when !hasStripeConnected, assign onPress={handleConnectStripe} and disabled={connectingStripe}; when hasStripeConnected and affiliateBalance >= 1000, assign onPress={() => setShowModal(true)}.

---

### 5. [HIGH] Omission of platform: 'mobile' in createAffiliateStripeConnect breaks mobile Stripe onboarding deep link return
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `api-network`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1544-1547`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
createAffiliateStripeConnect executes post(`${API_BASE}/affiliate/stripe-connect`, {}, authHeaders) with an empty JSON body. In backend affiliateRoutes.js (lines 184-193), the server checks 'req.body && req.body.platform === "mobile"' to generate deep link URLs (ratedeed://affiliate?stripe_success=true and stripe_refresh=true). Because platform is omitted, the backend defaults to web URLs (https://www.ratedeed.com/affiliate), breaking mobile deep linking.

#### Impact on Mobile Users & Affiliates
Contractors and affiliates completing Stripe Connect onboarding in the mobile app are redirected to the web application in an external browser rather than returning cleanly into the mobile app via deep linking, breaking the onboarding verification loop.

#### Adversarial Verification Analysis
CONFIRMED. Inspection of `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1544-1547) verifies that `createAffiliateStripeConnect` invokes `post(`${API_BASE}/affiliate/stripe-connect`, {}, authHeaders)` with an empty body `{}`. In the backend endpoint `/api/backend/routes/affiliateRoutes.js` (lines 184-193), the server determines return URLs via `const isMobile = (req.body && req.body.platform === 'mobile')`. Because `platform` is omitted in the mobile payload, `isMobile` evaluates to false, and Stripe's Express onboarding generates standard web URLs (`https://www.ratedeed.com/affiliate?stripe_success=true`) instead of the app deep links (`ratedeed://affiliate?stripe_success=true`). In contrast, `getStripeConnectUrl` (lines 1194-1201) correctly provides `{ platform: 'mobile', businessType, returnTo }`. In `AffiliateScreen.tsx`, `handleConnectStripe` launches `WebBrowser.openBrowserAsync(res.url)`, leaving the user on the web application upon completion rather than returning cleanly into the mobile app. No client-side fallback or interceptor mitigates this missing payload property.

#### Exact Code Remediation
Update createAffiliateStripeConnect in apiClient.ts to pass { platform: 'mobile' } in the POST body: `export const createAffiliateStripeConnect = async (): Promise<{ url: string; stripeAccountId: string }> => { const authHeaders = await getAuthHeaders(); return post(`${API_BASE}/affiliate/stripe-connect`, { platform: 'mobile' }, authHeaders); };`

---

### 6. [HIGH] Earnings tab property mismatch renders commissions as '+$NaN' and leaves job IDs blank
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:316-320`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
AffiliateScreen.tsx accesses e.contractorName, e.jobId, and e.amount when rendering earnings. The backend AffiliateEarning documents returned by /api/affiliate/stats populate referredContractor (with companyName), job (ObjectId), and commissionAmount. Because e.amount is undefined, (e.amount / 100).toFixed(2) produces 'NaN', rendering '+$NaN'.

#### Impact on Mobile Users & Affiliates
Commissions list displays corrupt '+$NaN' amounts and blank job identifiers ('Job #'), destroying financial transparency and partner trust.

#### Adversarial Verification Analysis
Confirmed. In `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx` (lines 313-325), the earnings list renders properties `e.contractorName`, `e.jobId`, and `e.amount`. However, the backend endpoint `GET /api/affiliate/stats` (`/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js` lines 78-83) returns raw `AffiliateEarning` model documents where the commission amount is stored as `commissionAmount`, the job reference is `job` (ObjectId), and the contractor details are in `referredContractor` (populated with `{ companyName, category }`).

Because `e.amount` is `undefined`, JavaScript evaluates `(undefined / 100).toFixed(2)` as `"NaN"`, rendering `+$NaN` on every commission row. Similarly, `e.jobId` is undefined, rendering `Job #` with a blank ID, and `e.contractorName` is undefined, permanently falling back to `'Commission'`. No intermediary transformation exists in `apiClient.ts` or `AffiliateScreen.tsx`. The finding is real and high severity.

#### Exact Code Remediation
Update AffiliateScreen.tsx lines 316-320 to access `e.referredContractor?.companyName || e.contractorName || 'Commission'`, `e.job?._id || e.job || e.jobId || ''`, and `((e.commissionAmount ?? e.amount ?? 0) / 100).toFixed(2)`.

---

### 7. [HIGH] Deep Link Configuration Misses www Subdomain and Canonical Signup/Join URL Aliases
- **Track Domain:** Mobile Referral Attribution on Contractor & Homeowner Signups
- **Category:** `push-deeplink`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/App.js:85-164`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
1. linking.prefixes only includes ['ratedeed://', 'https://ratedeed.com'], omitting 'https://www.ratedeed.com' (the default domain produced by backend affiliateRoutes.js: referralLink = `${host}/contractor-signup?ref=${referralCode}`).\n2. In linking.config.screens, only 'register' and 'contractor-signup' are configured. Common web aliases like '/signup', '/join', '/c/join', and '/contractor/signup' are not mapped or normalized in getStateFromPath.\n3. Deep links like 'ratedeed://signup?ref=ABC' or 'https://www.ratedeed.com/signup?ref=ABC' fail to resolve to the Register or ContractorSignup screens.

#### Impact on Mobile Users & Affiliates
Prospective contractors and homeowners tapping referral links from SMS, emails, affiliate social shares, or web links fail to land on the registration screen with referral parameters attached, causing dropped referrals and attribution failure.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/App.js (lines 85-164), deep link configuration has two verified defects:
1. `linking.prefixes` is defined as `['ratedeed://', 'https://ratedeed.com']`, omitting `'https://www.ratedeed.com'`. In React Navigation, `extractPathFromURL` strictly tests incoming URLs against the prefix regular expressions; incoming Universal Links starting with `https://www.ratedeed.com/` return `undefined`, causing React Navigation to ignore the link entirely. This directly breaks referral links generated by backend `affiliateRoutes.js:48-49`, which defaults to `https://www.ratedeed.com/contractor-signup?ref=${referralCode}`.
2. `linking.config.screens` only maps `Register: 'register'` and `ContractorSignup: 'contractor-signup'`. Web and marketing aliases such as `/signup` (the canonical homeowner signup route on web `src/lib/navigation.tsx`), `/join`, `/c/join`, and `/contractor/signup` are not mapped in `screens` nor normalized in `getStateFromPath` (which only normalizes `/c/`, `/contractors/`, `/messages/`, `/quote/`). Furthermore, `/c/join` is rewritten by `getStateFromPath` to `/contractor/join`, which matches no screen.
3. As a result, users tapping referral links containing `www.ratedeed.com` or `/signup?ref=...` fail to resolve to the registration screens with referral parameters attached, causing dropped referrals and affiliate attribution failure. No defensive handlers or fallback listeners exist in the mobile codebase to mitigate this.

#### Exact Code Remediation
1. Add 'https://www.ratedeed.com' to `linking.prefixes`.\n2. In `linking.getStateFromPath`, add canonical path aliases:\n   if (cleanPath.startsWith('/signup')) cleanPath = cleanPath.replace('/signup', '/register');\n   if (cleanPath.startsWith('/join')) cleanPath = cleanPath.replace('/join', '/register');\n   if (cleanPath.startsWith('/c/join') || cleanPath.startsWith('/contractor/signup')) cleanPath = cleanPath.replace(/\/c\/join|\/contractor\/signup/, '/contractor-signup');\n3. Ensure query parameters (`ref`, `referralCode`) are parsed and passed into screen route params.

---

### 8. [HIGH] Contractor Signup Screen Lacks Referral Code UI Input and Verification Field
- **Track Domain:** Mobile Referral Attribution on Contractor & Homeowner Signups
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js:70-84, 358-677`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ContractorSignupScreen.js maintains a `referralCode` state and reads `route.params?.ref` or `AsyncStorage.getItem('ratedeed_ref_code')`, but there is NO TextInput element or confirmation badge rendered anywhere across Step 1 (Personal), Step 2 (Business), or Step 3 (Hours & Summary). If a contractor opens the app directly, they cannot input a referral code. If they arrive via deep link, they cannot view, modify, or verify that the code was captured.

#### Impact on Mobile Users & Affiliates
Contractors who receive a referral code via word-of-mouth, offline marketing, or non-deep-linked communication cannot enter their referral code. Deep-linked contractors receive no visual confirmation or editing ability for their detected referral code.

#### Adversarial Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js`, `referralCode` state is initialized on line 70, populated via `route.params?.ref` or `AsyncStorage.getItem('ratedeed_ref_code')` in `useEffect` (lines 73-83), and submitted in the signup payload on line 271 (`referralCode: referralCode.trim() || undefined`).

However, across all three registration steps:
1. Step 1 (Personal Info, lines 358-455): Only renders inputs for firstName, lastName, email, phone, password, and confirmPassword.
2. Step 2 (Business Details, lines 458-576): Only renders inputs for companyName, service category, business address, and zip codes.
3. Step 3 (Hours & Summary, lines 578-677): Only renders business hours toggles, a registration summary card (showing Name, Company, Category, Service Area), and the submit button.

There is no TextInput or visual badge anywhere in the UI for entering or reviewing a referral code. As a result:
- Contractors signing up via organic app store install, word-of-mouth, or manual promo codes have zero ability to enter an affiliate code.
- Contractors arriving via deep link receive no visual confirmation or editing ability for their captured referral code.
Attribution is completely blocked for all non-deep-linked contractor acquisitions.

#### Exact Code Remediation
Add a 'Referral Code (Optional)' input field in Step 1 (Personal Info) or Step 3 (Summary Card), pre-populated with `referralCode`, sanitized with uppercase formatting (`text.toUpperCase().trim()`), with a visual badge indicating when a referral code is active (e.g., 'Referral Code Applied: {referralCode}').

---

### 9. [HIGH] Missing platform: 'mobile' in createAffiliateStripeConnect breaks OAuth return deep linking
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `api-network`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1544-1547`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In backend routes/affiliateRoutes.js (line 184), the /api/affiliate/stripe-connect endpoint checks 'const isMobile = (req.body && req.body.platform === "mobile")' to configure Stripe refresh_url and return_url to 'ratedeed://affiliate?stripe_success=true'. However, createAffiliateStripeConnect in src/utils/apiClient.ts sends an empty POST body {}, causing isMobile to be false and Stripe to redirect to the web URL 'https://www.ratedeed.com/affiliate' on mobile.

#### Impact on Mobile Users & Affiliates
Mobile users completing Stripe Connect onboarding in WebBrowser.openBrowserAsync are redirected to the desktop web interface instead of returning to the native mobile AffiliateScreen via deep link.

#### Adversarial Verification Analysis
Verified defect. 

1. Mobile Implementation (/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1544-1547):
`createAffiliateStripeConnect` executes `post(`${API_BASE}/affiliate/stripe-connect`, {}, authHeaders)` with an empty request payload `{}`. No default body or interceptor injects platform information.

2. Backend Implementation (/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js:184-193):
The backend endpoint checks `const isMobile = (req.body && req.body.platform === 'mobile')`. Because `platform` is omitted in the request body, `isMobile` evaluates to `false`. Consequently, Stripe AccountLink is created with web URLs (`${baseUrl}/affiliate?stripe_success=true`) instead of mobile deep links (`ratedeed://affiliate?stripe_success=true`).

3. Impact & Comparison:
When `WebBrowser.openBrowserAsync` opens the Stripe onboarding flow in `AffiliateScreen.tsx`, completing onboarding redirects the user to the web URL inside the in-app browser rather than deep-linking back to the native `AffiliateScreen`. In contrast, contractor onboarding (`getStripeConnectUrl` at line 1200) and job checkout (`createJobCheckout` at line 1245) explicitly pass `{ platform: 'mobile' }`.

4. Remediation:
Update `createAffiliateStripeConnect` in `src/utils/apiClient.ts` to pass `{ platform: 'mobile' }`.

#### Exact Code Remediation
Update createAffiliateStripeConnect in /Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts to pass { platform: 'mobile' }:
```typescript
export const createAffiliateStripeConnect = async (): Promise<{ url: string; stripeAccountId: string }> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/affiliate/stripe-connect`, { platform: 'mobile' }, authHeaders);
};
```

---

### 10. [HIGH] Push notification taps navigate without clearing unread notification state or syncing badge
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `push-deeplink`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:263-315`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In backend Notification.js (lines 118-123), the pushData object only includes { type, link, conversationId } and omits the notification document ID. In mobile usePushNotifications.ts, handleRouteData(data) only performs navigation.navigate(...), without calling markNotificationRead, refreshNotifications, or badge decrement APIs.

#### Impact on Mobile Users & Affiliates
When users tap lock-screen/system-tray push notifications for affiliate commissions, payout approvals, quotes, or jobs, the app navigates to the destination screen but the notification remains permanently 'read: false' in the database and context badge count. Tab badges and notification icons continue displaying unread status.

#### Adversarial Verification Analysis
CONFIRMED: The finding is fully verified against both the backend and mobile codebases.

1. Backend (/Users/tamim/Desktop/Ratedeed/api/backend/models/Notification.js:118-123):
When sending push notifications from the Notification post-save hook, `pushData` only contains:
```javascript
const pushData = {
    type: doc.type,
    link: doc.link || '',
    ...(doc.conversationId ? { conversationId: doc.conversationId.toString() } : {})
};
```
The MongoDB document ID (`doc._id`) is omitted entirely from `pushData`.

2. Mobile Client (/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:263-380):
- Push notification taps captured via Expo Notifications (`addNotificationResponseReceivedListener`, `getLastNotificationResponseAsync`) and Firebase Messaging (`onNotificationOpenedApp`, `getInitialNotification`) extract `data` and pass it to `handleRouteData(data)`.
- `handleRouteData` (lines 263-315) only executes `navigation.navigate(...)`. It does not call `markNotificationRead` (or any read-acknowledgment endpoint) and has no `notificationId` to do so.
- When the destination screen mounts or the app returns to the foreground (`AppState.addEventListener('change')` in `NotificationsContext.tsx:135-139`), `refreshNotifications` re-fetches notifications from `/api/notifications`. Because the database record was never marked `read: true`, the notification remains unread (`read: false`).
- Consequently, `unreadCount` in `NotificationsContext` remains unreduced, keeping tab bar notification badges and the device OS badge (`Notifications.setBadgeCountAsync`) active until the user manually visits `NotificationsScreen` and taps the item or clicks 'Mark all as read'.

No defensive guards or navigation listeners in the mobile codebase mitigate this behavior. The defect is real and confirmed.

#### Exact Code Remediation
1. In /Users/tamim/Desktop/Ratedeed/api/backend/models/Notification.js (line 118), include notificationId in pushData:
```javascript
const pushData = {
    notificationId: doc._id.toString(),
    type: doc.type,
    link: doc.link || '',
    ...(doc.conversationId ? { conversationId: doc.conversationId.toString() } : {})
};
```
2. In /Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts, mark the notification as read upon routing:
```typescript
import { markNotificationRead } from '../utils/apiClient';

// inside handleRouteData:
if (data?.notificationId) {
  markNotificationRead(String(data.notificationId)).then(() => refreshNotifications()).catch(() => {});
}
```

---

### 11. [HIGH] Referral attribution lost when switching from RegisterScreen to ContractorSignupScreen
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `attribution-gap`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js:186-204`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
When a prospective contractor opens a referral deep link leading to /register?ref=CODE or lands on RegisterScreen, RegisterScreen.js does not inspect route.params for referral parameters (ref / referralCode) and does not persist them to AsyncStorage. When the user taps 'I am a Contractor', it navigates to ContractorSignup without passing referral parameters.

#### Impact on Mobile Users & Affiliates
Prospective contractors referred by affiliates who start at the general registration screen and switch to contractor signup lose referral attribution, depriving referrers of legitimate commission.

#### Adversarial Verification Analysis
CONFIRMED: The defect is real. In /Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js:
1. RegisterScreen does not consume `route` (via props or `useRoute()`) and does not check `route.params` for `ref` or `referralCode`.
2. Unlike web's AppWrapper.tsx which intercepts query params globally, mobile's App.js linking configuration does not persist referral parameters to AsyncStorage upon deep link handling.
3. In RegisterScreen.js (lines 195-204), tapping the 'I\'m a Contractor' toggle executes `navigation.navigate('ContractorSignup')` with no parameters.
4. When ContractorSignupScreen mounts, `route.params` is empty, and `AsyncStorage.getItem('ratedeed_ref_code')` returns null since RegisterScreen never persisted it. As a result, referral attribution is lost when a referred contractor switches from the general registration screen to the contractor signup screen.

#### Exact Code Remediation
In /Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js:
1. Capture route.params?.ref or route.params?.referralCode on mount and persist via AsyncStorage.setItem('ratedeed_ref_code', ref).
2. Pass params when navigating to ContractorSignup:
```javascript
<Pressable
  onPress={() => navigation.navigate('ContractorSignup', { ref: route.params?.ref || route.params?.referralCode })}
  className="flex-1 py-2.5 rounded-lg items-center"
>
```

---

## MEDIUM Severity Issues (15)

### 12. [MEDIUM] Default 'Requested' Payout Status Renders in Error Red Instead of Pending Amber
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:347-351`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The payout status styling checks only p.status === 'completed' (emerald) and p.status === 'pending' (amber), falling back to bg-red-50 text-red-700 for all other values. The backend AffiliatePayout model assigns the default status 'requested' upon creation, which triggers the red error fallback.

#### Impact on Mobile Users & Affiliates
Healthy, newly submitted affiliate payout requests are styled in red badge containers with red text, misleading users into believing their requests were rejected or failed.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx (lines 347-351), the payout status badge style and text color evaluate `p.status === 'completed'` for emerald and `p.status === 'pending'` for amber, falling back to `bg-red-50 text-red-700` for all other values. 

In the backend model (/Users/tamim/Desktop/Ratedeed/api/backend/models/AffiliatePayout.js), the valid status enum values are `['requested', 'processing', 'completed', 'rejected']`, and newly created payouts via `POST /api/affiliate/payout` (affiliateRoutes.js:244) are assigned `status: 'requested'`. The mobile screen receives `res.payouts` directly from `GET /api/affiliate/stats` without status mapping or normalization. Consequently, every newly submitted, healthy payout request with status 'requested' (or in-progress 'processing') hits the fallback and renders inside a red error badge container with red text, misleading users into believing their payout request failed or was rejected.

#### Exact Code Remediation
Expand the status check: p.status === 'completed' for emerald, (p.status === 'requested' || p.status === 'pending' || p.status === 'processing') for amber/yellow, and p.status === 'rejected' for red.

---

### 13. [MEDIUM] Bypassing Universal Money Utilities Leads to Missing Number Formatting and Input Parse Failures
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:114-122, 199, 201, 320, 343`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Balances and earnings perform manual string interpolation `${(balance / 100).toFixed(2)}` instead of using formatCents / formatCurrency. In handleRequestPayoutSubmit, parseFloat(payoutAmount) is used without sanitizing non-numeric currency characters like '$'.

#### Impact on Mobile Users & Affiliates
AffiliateScreen bypasses src/utils/money.ts, causing large balances over $1,000 to render without comma formatting, and leading dollar signs in payout inputs (e.g. '$25.00') cause parseFloat to return NaN and fail validation.

#### Adversarial Verification Analysis
Verified against `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx`.

1. **Manual String Interpolation / Bypassing Money Utilities**:
   - Lines 199 (`${(affiliateBalance / 100).toFixed(2)}`), 201 (`${(totalEarned / 100).toFixed(2)}`), 320 (`+${(e.amount / 100).toFixed(2)}`), and 343 (`${(p.amount / 100).toFixed(2)}`) manually format cent amounts using `.toFixed(2)`.
   - This bypasses `src/utils/money.ts` (`formatCents` / `formatCurrency`), resulting in missing comma thousands separators for amounts >= $1,000.

2. **Input Parse & Validation Flaw**:
   - In `handleRequestPayoutSubmit` (lines 114-122), `parseFloat(payoutAmount)` is called directly on the raw text state from `TextInput` (lines 381-386) without stripping leading currency symbols like `$`.
   - If a user enters or pastes `$25.00`, `parseFloat` returns `NaN`, causing the validation check `isNaN(amt)` to fail and falsely trigger the `$10.00 minimum threshold alert`.
   - Furthermore, the comparison `amt > affiliateBalance / 100` relies on floating-point arithmetic rather than integer cents comparison with `dollarsToCents()`.

Defensive mechanisms or sanitizers are absent in `AffiliateScreen.tsx`. The finding is confirmed.

#### Exact Code Remediation
Import formatCents, dollarsToCents, and formatCurrency from ../utils/money. Sanitize user input via payoutAmount.replace(/[^0-9.]/g, '') before parsing, and validate against integer cents.

---

### 14. [MEDIUM] Stale Referral Code Persists in AsyncStorage After Successful Contractor Signup
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `attribution-gap`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js:77, 273-278`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ContractorSignupScreen.js stores the referral code via AsyncStorage.setItem('ratedeed_ref_code', routeRef) on initial load, but does not clear it via AsyncStorage.removeItem('ratedeed_ref_code') after successful registration.

#### Impact on Mobile Users & Affiliates
If an affiliate referral link is opened once, the referral code remains cached in AsyncStorage indefinitely. Subsequent contractor signups on that device continue to attribute commissions to the old referrer even if no referral link was used.

#### Adversarial Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js`, `AsyncStorage.setItem('ratedeed_ref_code', routeRef)` stores the referral code when provided in route parameters (line 77), and falls back to `AsyncStorage.getItem('ratedeed_ref_code')` when route parameters are absent (lines 79-81).

However:
1. In `handleSignup` (lines 243-286), upon successful registration via `await contractorSignup(payload)` (line 273), `AsyncStorage.removeItem('ratedeed_ref_code')` is never invoked.
2. A search across the entire mobile codebase confirms that `AsyncStorage.removeItem('ratedeed_ref_code')` is never called anywhere in the app, and there is no expiration/TTL mechanism.
3. There is no visible referral code input or UI indicator in any of the signup steps (Step 1 personal, Step 2 business, Step 3 hours), so any future contractor account registered on the same device will silently and irrevocably inherit the cached referral code without the user being aware or able to clear it.

Remediation is confirmed: `await AsyncStorage.removeItem('ratedeed_ref_code').catch(() => {});` should be called upon successful signup in `handleSignup`.

#### Exact Code Remediation
Call await AsyncStorage.removeItem('ratedeed_ref_code').catch(() => {}) upon successful completion of contractorSignup.

---

### 15. [MEDIUM] Payout Modal Lacks KeyboardAvoidingView and Explicit Placeholder Text Colors
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:360-412`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The payout Modal uses a static View without KeyboardAvoidingView, and TextInput elements omit the placeholderTextColor prop.

#### Impact on Mobile Users & Affiliates
Opening the keyboard inside the payout request modal obscures input fields and the submit button on smaller devices. In dark mode, missing placeholder text colors can render input placeholders invisible.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx (lines 360-412), the payout Modal is implemented using a fixed-layout View with no KeyboardAvoidingView or scroll wrapper. Focusing the text inputs on smaller screens (particularly iOS) causes the software keyboard to cover the lower input field and the 'Submit Withdrawal Request' button. Furthermore, both TextInput elements (amount input at line 380 and payout details input at line 391) omit the placeholderTextColor prop, leading to poor contrast / illegibility against dark backgrounds (dark:bg-neutral-800) in dark mode. No defensive handlers or global wrappers mitigate this in AffiliateScreen.tsx.

#### Exact Code Remediation
Wrap modal contents with KeyboardAvoidingView (behavior={Platform.OS === 'ios' ? 'padding' : undefined}) and add placeholderTextColor="#94a3b8" to all TextInput components.

---

### 16. [MEDIUM] Property name mismatch renders referred contractors with 'Contractor' name and 'Invalid Date'
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:286-287`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
AffiliateScreen.tsx accesses c.name and c.joinedAt when rendering referred contractors. The backend GET /api/affiliate/stats endpoint returns an array of objects formatted with companyName and signupDate. Because c.name and c.joinedAt are undefined, the UI displays 'Contractor' and new Date(c.joinedAt).toLocaleDateString() outputs 'Invalid Date'.

#### Impact on Mobile Users & Affiliates
Referred contractors list displays generic placeholder 'Contractor' instead of actual contractor company names, and registration date renders as 'Invalid Date'.

#### Adversarial Verification Analysis
CONFIRMED: The property name mismatch is verified in the codebase.

1. Source inspection:
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx` (lines 286-287), the contractors list renders:
  - `<Text>{c.name || 'Contractor'}</Text>`
  - `<Text>Joined {new Date(c.joinedAt).toLocaleDateString()}</Text>`
- In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (line 1534), `getAffiliateStats()` calls `GET /affiliate/stats` and returns raw response data without property transformation.

2. Backend response verification:
- In `/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js` (lines 59-75), the `GET /api/affiliate/stats` endpoint formats referred contractors as:
  `{ id, companyName, category, slug, signupDate, daysElapsed, daysRemaining, isActiveWindow }`
- The backend sends `companyName` and `signupDate`, not `name` or `joinedAt`.

3. Runtime impact:
- `c.name` evaluates to `undefined`, falling back to `'Contractor'`.
- `c.joinedAt` evaluates to `undefined`. In JavaScript, `new Date(undefined).toLocaleDateString()` produces `'Invalid Date'`.
- Consequently, every contractor in the referral list is rendered with the title 'Contractor' and subtitle 'Joined Invalid Date'.

4. Severity evaluation:
- Adjusted from High to Medium: The bug produces broken string rendering ('Invalid Date' and generic placeholder) on the referrals tab without throwing an uncaught JS exception, crashing the app, corrupting database state, or blocking financial operations.

#### Exact Code Remediation
Update AffiliateScreen.tsx line 286-287 to read `c.companyName || c.name || 'Contractor'` and `c.signupDate || c.joinedAt ? new Date(c.signupDate || c.joinedAt).toLocaleDateString() : 'Recently'`

---

### 17. [MEDIUM] Newly requested affiliate payouts display false red 'Rejected' status badge due to status string mismatch
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:347-350`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
AffiliateScreen.tsx checks `p.status === 'completed' ? ... : p.status === 'pending' ? ... : 'bg-red-50 text-red-700'`. Backend AffiliatePayout model schema sets default status to 'requested' (and transitions to 'processing'). Since 'requested' and 'processing' do not match 'completed' or 'pending', newly submitted withdrawal requests fall into the red error badge style.

#### Impact on Mobile Users & Affiliates
Newly submitted, valid affiliate payout requests immediately display an alarming red 'Rejected' badge, misleading affiliates into believing their payout failed.

#### Adversarial Verification Analysis
CONFIRMED: The defect is real and verified against both the mobile client and backend codebase.

1. Backend Schema & Route Behavior:
   - In `/Users/tamim/Desktop/Ratedeed/api/backend/models/AffiliatePayout.js` (lines 22-26), the Mongoose schema defines `status` as `enum: ['requested', 'processing', 'completed', 'rejected']` with default `'requested'`.
   - In `/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js` (lines 239-245), `POST /api/affiliate/payout` creates payout documents with `status: 'requested'`.
   - In `affiliateRoutes.js` (lines 85-88, 127), `GET /api/affiliate/stats` retrieves and returns raw payout records directly to the client without status normalization.

2. Mobile Client Rendering Bug:
   - In `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx` (lines 347-350):
     ```tsx
     <View className={`px-2.5 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
       <Text className={`text-[10px] font-bold capitalize ${p.status === 'completed' ? 'text-emerald-700' : p.status === 'pending' ? 'text-amber-700' : 'text-red-700'}`}>
         {p.status || 'Pending'}
       </Text>
     </View>
     ```
   - When `p.status` is `'requested'` or `'processing'`, `p.status === 'completed'` and `p.status === 'pending'` both evaluate to `false`.
   - The badge falls into the default `bg-red-50 text-red-700` styling with `text-red-700` font color.

3. Impact & Absence of Mitigations:
   - There are no client-side transformers or API interceptors in `src/utils/apiClient.ts` to map `'requested'` or `'processing'` to `'pending'`.
   - Affiliates who submit a valid withdrawal request immediately see an alarming red badge with text 'Requested' or 'Processing', creating false confusion that their payout request was rejected.
   - Severity is confirmed at `medium` (financial UI status mismatch creating high user anxiety without backend data corruption).

#### Exact Code Remediation
Update AffiliateScreen.tsx line 347 to treat 'requested', 'processing', and 'pending' as amber badges: `const isPending = p.status === 'pending' || p.status === 'requested' || p.status === 'processing'; const isCompleted = p.status === 'completed'; const badgeClass = isCompleted ? 'bg-emerald-50 text-emerald-700' : isPending ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';`

---

### 18. [MEDIUM] Missing manual referral code input on Contractor Registration loses word-of-mouth partner attribution
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `attribution-gap`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js:73-83, 358-455`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ContractorSignupScreen only captures referral codes if present in route.params?.ref or AsyncStorage. There is no visible TextInput in any of the 3 registration steps (Personal, Business, Hours) allowing a contractor to view, input, or modify a referral code. If a contractor opens the app directly without tapping a deep link, the referral code is lost.

#### Impact on Mobile Users & Affiliates
Word-of-mouth and manual contractor referrals cannot be entered on mobile signup, causing complete loss of affiliate attribution and partner commission.

#### Adversarial Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js`, the component defines `const [referralCode, setReferralCode] = useState('');` (line 70) and submits `referralCode: referralCode.trim() || undefined` in the signup payload (line 271). However, `referralCode` is only populated via `useEffect` from `route.params?.ref`, `route.params?.referralCode`, or `AsyncStorage.getItem('ratedeed_ref_code')` (lines 73-83).

Inspection of the entire multi-step registration form confirms that no `TextInput` or UI element for `referralCode` exists across Step 1 (lines 358-455), Step 2 (lines 458-575), or Step 3 (lines 578-678).

Consequently:
1. Contractors downloading and opening the mobile app directly (word-of-mouth referrals, podcast/flyer promotions, direct App Store/Play Store installs) have no way to manually enter or verify an affiliate/referral code.
2. Even if a deep link was used, the user cannot see or modify the applied code.
3. The registration payload submits `referralCode: undefined`, resulting in 100% loss of affiliate attribution and partner commissions for manual mobile signups.

Adjusted severity from high to medium because core registration succeeds without crashing or corrupting data, and deep links (when clicked) do populate route.params; the defect represents a significant attribution/UX omission rather than an app outage or security vulnerability.

#### Exact Code Remediation
Add an optional 'Referral Code' TextInput field in Step 1 of ContractorSignupScreen.js, pre-filled with `referralCode` from route params/AsyncStorage while allowing manual entry: `<TextInput placeholder="Referral Code (Optional)" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" className="..." />`.

---

### 19. [MEDIUM] Affiliate API client methods lack demo mode checks and fallbacks in apiClient.ts
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `api-network`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1534-1548`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
apiClient.ts affiliate methods (getAffiliateStats, requestAffiliatePayout, createAffiliateStripeConnect) omit `if (isDemoMode()) return demo...` guards present in all other API methods across apiClient.ts, attempting live network calls with fake demo JWT credentials in demo mode.

#### Impact on Mobile Users & Affiliates
App Store reviewers and demo mode users encounter unhandled network failures and 401 exceptions when testing or opening the Partner Program screen.

#### Adversarial Verification Analysis
CONFIRMED: The defect is genuine and verified in the codebase.

1. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1534-1548), the three affiliate endpoints (`getAffiliateStats`, `requestAffiliatePayout`, and `createAffiliateStripeConnect`) directly call `get()` and `post()` with auth headers without checking `isDemoMode()`:
   - `getAffiliateStats` (lines 1534-1537)
   - `requestAffiliatePayout` (lines 1539-1542)
   - `createAffiliateStripeConnect` (lines 1544-1547)

2. In contrast, all other API modules across `apiClient.ts` (auth, contractor browsing, quotes, jobs, reviews, notifications, disputes, profile, etc.) consistently guard with `if (isDemoMode()) return demo.demoFunction(...)`.

3. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/demoApiClient.ts`, there are zero mock implementations for affiliate endpoints (`demoGetAffiliateStats`, `demoRequestAffiliatePayout`, `demoCreateAffiliateStripeConnect` are entirely missing).

4. In `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx`, the screen calls `getAffiliateStats()` on mount in `fetchStats()`. In demo mode, it attempts a real network request with a mock demo JWT (`auth_token`), causing an unauthenticated network failure (401). While `fetchStats` catches the error in a try/catch, stats and referral links remain unpopulated. Furthermore, user actions like tapping "Connect Stripe" or requesting a payout result in failed network calls and error alerts.

No defensive guards or navigation handlers mitigate this defect. The finding is confirmed at Medium severity.

#### Exact Code Remediation
Add demo mode guards to getAffiliateStats, requestAffiliatePayout, and createAffiliateStripeConnect in apiClient.ts, and implement demoGetAffiliateStats, demoRequestAffiliatePayout, and demoCreateAffiliateStripeConnect in demoApiClient.ts.

---

### 20. [MEDIUM] Unauthenticated access to AffiliateScreen silently fails with empty state instead of login redirect
- **Track Domain:** Mobile API Client Methods & Payout Network Lifecycle
- **Category:** `security-payout`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:48-72`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
AffiliateScreen.tsx does not check `isAuthenticated` from AuthContext. When an unauthenticated user opens the screen, getAffiliateStats fails with 401, which is caught and silently ignored. The screen finishes loading and renders an empty state with no referral links and disabled withdrawal buttons without prompting the user to authenticate.

#### Impact on Mobile Users & Affiliates
Unauthenticated guest users opening the affiliate screen via deep link or shared URL see a broken screen with $0.00 balance and no login prompt.

#### Adversarial Verification Analysis
Verified and confirmed against the codebase. 

1. **Source Inspection (`AffiliateScreen.tsx`)**:
   - `AffiliateScreen.tsx` does not import or call `useAuth()`.
   - On initial mount, `useEffect` executes `fetchStats()`, which calls `getAffiliateStats()`.
   - For unauthenticated users, `getAuthHeaders()` in `src/utils/apiClient.ts` returns `{}` (no bearer token). The API call to `/api/affiliate/stats` rejects with 401 Unauthorized.
   - `fetchStats()` (lines 66-71) catches the 401 error, logs it via `console.error`, and clears `loading` in `finally`.
   - The screen renders the default empty state:
     - Referral Link is empty string; tapping 'Copy Link' (line 92) and 'Share Link' (line 99) silently early-returns (`if (!referralLink) return`).
     - Balance card shows `$0.00` and a disabled 'Connect Stripe' / 'Min $10' button.
     - An amber 'Stripe Account Required' banner displays with a 'Connect Stripe' button, which on tap fails with an error alert because `createAffiliateStripeConnect` also requires authentication.
     - Contractor and Earnings tabs show 'No Referrals Yet' and 'No Earnings Yet'.
     - No login prompt or redirect is presented anywhere.

2. **Navigation & Defensive Guards Inspection (`MainNavigator.js` & `App.js`)**:
   - `App.js` registers `AffiliateScreen: 'affiliate'` in linking config, allowing guest access via deep links (`ratedeed://affiliate`, `https://ratedeed.com/affiliate`).
   - `MainNavigator.js` registers `AffiliateScreen` (line 418) in the root stack.
   - `MainNavigator.js` has a session expiration guard (lines 344-355), but `AffiliateScreen` is NOT included in `protectedScreens` (only `ContractorDashboard`, `EarningsScreen`, `JobDetail`, etc. are listed).
   - In comparison, screens like `ProfileScreen.tsx`, `ActiveJobsScreen.tsx`, and `SavedScreen.tsx` explicitly check `!isAuthenticated` and render dedicated guest sign-in CTA screens.

3. **Conclusion & Severity**:
   - The finding is genuine and confirmed. Unauthenticated guests navigating to the Partner Program encounter a broken, non-functional screen without guidance to log in.
   - Severity Medium is appropriate: it causes a dead-end UI and broken onboarding for referral partners, but does not expose unauthorized backend data.

#### Exact Code Remediation
Import useAuth in AffiliateScreen.tsx. If `!isAuthenticated`, render a landing view detailing the partner program benefits with a 'Sign In to Join Partner Program' CTA that navigates to the Login screen.

---

### 21. [MEDIUM] Homeowner Registration Screen Completely Omits Referral Code Extraction, UI Input, and API Attribution
- **Track Domain:** Mobile Referral Attribution on Contractor & Homeowner Signups
- **Category:** `attribution-gap`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js:86-134`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
RegisterScreen.js does not read deep link parameters (route.params?.ref or route.params?.referralCode), does not check or retrieve cached referral codes from AsyncStorage (ratedeed_ref_code), and does not provide an input field for referral codes. In handleRegister(), the payload sent to register() completely omits referralCode. Furthermore, when the user toggles the role switch from Homeowner to Contractor ('I\'m a Contractor'), navigation.navigate('ContractorSignup') does not forward any referral parameters.

#### Impact on Mobile Users & Affiliates
100% loss of referral attribution for homeowner signups on mobile. Referring contractors and affiliate partners receive zero attribution, credit, or commission when referred users register through the homeowner flow.

#### Adversarial Verification Analysis
VERIFIED WITH SEVERITY DOWNGRADE:

1. Code Verification:
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js`:
  - `useRoute` is not imported; deep link parameters (`route.params?.ref` or `route.params?.referralCode`) are completely ignored.
  - `AsyncStorage` key `ratedeed_ref_code` is neither read nor saved (unlike `ContractorSignupScreen.js:73-83`).
  - No `referralCode` state or text input exists in the UI.
  - The `register()` API call (lines 126-133) does not include `referralCode`.
  - The role toggle to ContractorSignup (line 196: `navigation.navigate('ContractorSignup')`) does not forward route parameters.

2. Skeptic / Severity Adjustment Context:
- The finding claims 'critical' severity on the basis that homeowner referral commissions are lost. However, investigation of the full system (`api/backend/models/User.js`, `api/backend/routes/userRoutes.js`, `api/backend/routes/affiliateRoutes.js`, and `api/backend/utils/affiliateHelper.js`) confirms that Ratedeed's affiliate program is strictly contractor-oriented (1% commission on platform fees from referred contractors completing jobs within 90 days). There is no homeowner affiliate attribution model or `referredBy` field on `User`.
- Platform-generated affiliate links specifically target `/contractor-signup?ref=CODE`, which maps to `ContractorSignupScreen.js` where extraction, AsyncStorage persistence, and API payload submission are already implemented.
- The genuine defect is that if a contractor lands on `RegisterScreen` via a deep link or app route and switches via the 'I\'m a Contractor' toggle, the referral parameter is lost because it was neither cached to AsyncStorage nor forwarded in navigation params.
- Severity is accordingly adjusted from 'critical' to 'medium'.

#### Exact Code Remediation
1. Import useRoute and read route.params?.ref || route.params?.referralCode with fallback to AsyncStorage.getItem('ratedeed_ref_code').\n2. Add a state variable `referralCode` and include an optional Referral Code text input on the registration form.\n3. Pass `referralCode: referralCode.trim().toUpperCase() || undefined` in the register() API call.\n4. When toggling to ContractorSignup, pass `navigation.navigate('ContractorSignup', { ref: referralCode })`.

---

### 22. [MEDIUM] Dual listener registration causes duplicate cold-start and background tap routing
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `push-deeplink`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:317-380`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
usePushNotifications.ts registers both Expo Notifications.addNotificationResponseReceivedListener and @react-native-firebase/messaging().onNotificationOpenedApp, as well as calling both messaging().getInitialNotification() and Notifications.getLastNotificationResponseAsync() on cold start. While hasHandledInitialNotificationRef guards the Expo cold-start check, it does not synchronize with Firebase's getInitialNotification(). On cold start on iOS, both listeners process the same notification and invoke handleRouteData twice.

#### Impact on Mobile Users & Affiliates
Tapping a notification on iOS or during cold start triggers duplicate navigation actions in immediate succession, causing navigation glitch transitions or stacked screens.

#### Adversarial Verification Analysis
CONFIRMED: The defect is real and verified in `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts` (lines 317-380).

1. Cold-start race & duplicate dispatch:
In `usePushNotifications.ts`, both `checkFirebaseInitialNotification` (using `@react-native-firebase/messaging().getInitialNotification()`) and `checkInitialNotification` (using Expo `Notifications.getLastNotificationResponseAsync()`) are invoked concurrently on hook initialization. `hasHandledInitialNotificationRef` only guards `checkInitialNotification` (Expo) and is never checked or set by `checkFirebaseInitialNotification`. As a result, when both native modules resolve the launching notification on cold start, `handleRouteData` is invoked twice. Furthermore, when `isAuthenticated` or `userRole` transitions from falsey to truthy, the hook's `useEffect` re-runs, processing `pendingNotificationRef` and unconditionally re-invoking `checkFirebaseInitialNotification()`.

2. Background notification tap duplicate dispatch:
Both Expo's `Notifications.addNotificationResponseReceivedListener` and Firebase's `messaging().onNotificationOpenedApp` are registered concurrently in the same `useEffect`. Tapping a notification while the app is backgrounded fires both handlers, each extracting the payload and calling `handleRouteData(data)` without cross-listener coordination.

3. Lack of deduplication:
Neither `handleRouteData`, `navigateByLink`, nor the navigation layer contains deduplication logic (such as message ID caching or a timestamp throttle). Consequently, duplicate navigation actions are dispatched in immediate succession.

Severity is confirmed as medium because it causes duplicate navigation transitions, redundant screen mounts, and visual navigation glitches across all notification tap pathways without crashing the app.

#### Exact Code Remediation
Add a deduplication timestamp or messageId ref in usePushNotifications.ts to discard duplicate dispatches:
```typescript
const lastHandledNotificationRef = useRef<{ id?: string; time: number }>({ time: 0 });

const handleRouteData = (data: any) => {
  const notifKey = data?.notificationId || data?.conversationId || data?.type || JSON.stringify(data);
  const now = Date.now();
  if (lastHandledNotificationRef.current.id === notifKey && now - lastHandledNotificationRef.current.time < 2000) {
    return;
  }
  lastHandledNotificationRef.current = { id: notifKey, time: now };
  // proceed with routing
};
```

---

### 23. [MEDIUM] Linking config prefixes omits https://www.ratedeed.com universal link domain
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `push-deeplink`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/App.js:85-87`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In App.js, linking.prefixes is defined as ['ratedeed://', 'https://ratedeed.com']. Universal links from shared web URLs, marketing emails, and social media platforms frequently include the 'www' subdomain ('https://www.ratedeed.com/contractor-signup?ref=...'). Because 'https://www.ratedeed.com' is omitted from prefixes, React Navigation rejects the deep link pattern.

#### Impact on Mobile Users & Affiliates
Affiliate links or notification links with 'https://www.ratedeed.com' domain fail to deep link into the mobile app, dropping users onto the default Explore home screen.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/App.js:85-87, linking.prefixes is defined as ['ratedeed://', 'https://ratedeed.com'], omitting 'https://www.ratedeed.com'.

Key findings from code audit:
1. Backend Referral Link Generation: In api/backend/routes/affiliateRoutes.js (line 48-49), referral links default to FRONTEND_URL or 'https://www.ratedeed.com', generating links like 'https://www.ratedeed.com/contractor-signup?ref=CODE'.
2. In-App Sharing: In src/screens/ContractorDashboardScreen.tsx (lines 2059-2076), contractor profile sharing for clipboard, Facebook, Twitter/X, LinkedIn, and WhatsApp explicitly uses 'https://www.ratedeed.com/c/...'.
3. React Navigation Mechanism: React Navigation's useLinking hook invokes extractPathFromURL(prefixes, url) before calling getStateFromPath. extractPathFromURL builds a strict RegExp from each prefix (^https:(/)*ratedeed\.com). For any incoming URL with the 'www' subdomain (e.g. 'https://www.ratedeed.com/...'), extractPathFromURL fails to match and returns undefined, so getStateFromPath is never reached and the deep link is dropped.
4. No Defensive Mitigations: Neither subscribe nor getInitialURL rewrites or strips the 'www' subdomain before passing the URL to React Navigation. Additionally, app.json (lines 21, 53) omits 'www.ratedeed.com' from iOS associatedDomains and Android intentFilters.

Remediation:
Add 'https://www.ratedeed.com' to prefixes in App.js:
prefixes: ['ratedeed://', 'https://ratedeed.com', 'https://www.ratedeed.com']
(And consider adding 'applinks:www.ratedeed.com' / 'www.ratedeed.com' to app.json for full OS-level Universal Links / App Links support).

#### Exact Code Remediation
Add the www subdomain to prefixes in /Users/tamim/Desktop/ratedeedmobile/App.js:
```javascript
const linking = {
  prefixes: ['ratedeed://', 'https://ratedeed.com', 'https://www.ratedeed.com'],
  // ...
};
```

---

### 24. [MEDIUM] AffiliateScreen ignores route params, failing to route to payouts or earnings tabs
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:19-36`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
AffiliateScreen.tsx initializes activeTab as 'contractors' and does not import useRoute or read route.params. Neither deep links (/affiliate?tab=payouts) nor push notification routing in usePushNotifications.ts can control which tab is displayed on load.

#### Impact on Mobile Users & Affiliates
Users tapping push notifications for approved payouts or deep links like /affiliate?tab=payouts are always directed to the 'contractors' tab, forcing manual tab navigation to find payout records.

#### Adversarial Verification Analysis
The finding is confirmed. Code inspection of `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx` (lines 19-36) confirms that `AffiliateScreen` does not accept a `route` prop or call `useRoute()`. The `activeTab` state is statically initialized to `'contractors'` (`useState<'contractors' | 'earnings' | 'payouts'>('contractors')`) with no `useEffect` or route parameter listener to inspect `route.params?.initialTab` or `route.params?.tab`.

Furthermore, in `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts`:
1. Lines 308-314: Push notifications for `affiliate_commission`, `affiliate_payout_approved`, and `affiliate_payout_rejected` call `navigation.navigate('AffiliateScreen')` without passing any tab parameter.
2. Lines 256-259: `navigateByLink` simply executes `navigation.navigate('AffiliateScreen')` for any path starting with `/affiliate`.

In contrast to `ContractorDashboardScreen.tsx` (which explicitly inspects `(route.params as any)?.initialTab` and updates `activeTab`), `AffiliateScreen` completely ignores route parameters. Users navigating via push notifications or deep links to payouts/earnings are always placed on the default 'contractors' tab.

Severity remains Medium as it is a navigation/UX defect in push and deep-link routing.

#### Exact Code Remediation
1. In /Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:
```typescript
import { useRoute } from '@react-navigation/native';

export default function AffiliateScreen() {
  const route = useRoute<any>();
  const initialTab = route.params?.tab || route.params?.initialTab;
  const [activeTab, setActiveTab] = useState<'contractors' | 'earnings' | 'payouts'>(
    initialTab === 'earnings' || initialTab === 'payouts' ? initialTab : 'contractors'
  );

  useEffect(() => {
    if (route.params?.tab || route.params?.initialTab) {
      const t = route.params.tab || route.params.initialTab;
      if (t === 'earnings' || t === 'payouts' || t === 'contractors') {
        setActiveTab(t);
      }
    }
  }, [route.params?.tab, route.params?.initialTab]);
```
2. In /Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:
```typescript
} else if (data?.type === 'affiliate_payout_approved' || data?.type === 'affiliate_payout_rejected') {
  navigation.navigate('AffiliateScreen', { initialTab: 'payouts' });
} else if (data?.type === 'affiliate_commission') {
  navigation.navigate('AffiliateScreen', { initialTab: 'earnings' });
}
```

---

### 25. [MEDIUM] Referral code persists indefinitely in AsyncStorage after contractor signup
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `attribution-gap`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js:73-83, 271-285`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ContractorSignupScreen.js persists routeRef to AsyncStorage under key 'ratedeed_ref_code'. However, upon successful registration inside handleSignup, AsyncStorage.removeItem('ratedeed_ref_code') is never called, leaving the referral code in persistent device storage forever.

#### Impact on Mobile Users & Affiliates
On shared devices or multiple contractor registrations on the same device, the first referral code ever used permanently re-attributes subsequent signups to that referrer.

#### Adversarial Verification Analysis
CONFIRMED: The defect is fully verified against `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js`.

1. Code Inspection:
- In `ContractorSignupScreen.js:73-83`, when a referral parameter is present, it is persisted to storage via `AsyncStorage.setItem('ratedeed_ref_code', routeRef)`. When no parameter is present, it hydrates from storage via `AsyncStorage.getItem('ratedeed_ref_code')`.
- In `handleSignup` (`ContractorSignupScreen.js:243-286`), the payload includes `referralCode: referralCode.trim() || undefined`. Upon successful API registration via `await contractorSignup(payload)` and sign out via `await auth.signOut()`, `AsyncStorage.removeItem('ratedeed_ref_code')` is never called.
- A codebase-wide search confirms `ratedeed_ref_code` is only referenced in those two lines (77 and 79) and is never cleared upon logout (`AuthContext.tsx` / `apiClient.ts`) or registration completion.
- Furthermore, `ContractorSignupScreen.js` has no UI input field for referral code, making the persisted code invisible and unmodifiable by the user.

2. Impact:
Any subsequent contractor account registered on the same device without an explicit referral link will silently and permanently inherit the previous referral code, misattributing affiliate commissions to the original referrer.

3. Verdict: Confirmed as a real medium-severity defect.

#### Exact Code Remediation
In /Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorSignupScreen.js, clear the stored code upon successful signup:
```javascript
await contractorSignup(payload);
await AsyncStorage.removeItem('ratedeed_ref_code');
await auth.signOut();
```

---

### 26. [MEDIUM] NotificationsScreen handleNotificationPress uses non-idempotent toggleRead
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx:216-220`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In NotificationsScreen.tsx, handleNotificationPress executes 'if (!item.read) { await toggleRead(item._id); }'. The toggleRead handler in NotificationsContext computes newReadState by inverting the current local state (!(notification?.read ?? true)). If state is updated concurrently, toggleRead issues a PUT /unread call instead of idempotently marking as read.

#### Impact on Mobile Users & Affiliates
Race conditions during rapid tap or background notification list updates can invert notification read status, causing opened notifications to be marked unread.

#### Adversarial Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx (lines 216-220), `handleNotificationPress` invokes `await toggleRead(item._id)` when `!item.read`. In /Users/tamim/Desktop/ratedeedmobile/src/context/NotificationsContext.tsx (lines 192-212), `toggleRead` is non-idempotent: it computes `newReadState = !(notification?.read ?? true)` based on the context's current `notifications` state. If a socket event (`onNotificationRead`, `onNotificationsAllRead`), background refresh, or duplicate press updates the context state before or during execution while the item prop in NotificationsScreen is stale, `toggleRead` evaluates `newReadState` as `false` and issues a `PUT /notifications/:id/unread` API request (`apiClient.markNotificationUnread(id)`), flipping the notification back to unread. In contrast, `markAsRead(id)` (NotificationsContext.tsx:165-177) is fully idempotent and always sends `PUT /notifications/:id/read`. Replacing `toggleRead` with `markAsRead` in `handleNotificationPress` eliminates this race condition.

#### Exact Code Remediation
In /Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx, replace toggleRead with markAsRead in handleNotificationPress:
```typescript
const handleNotificationPress = async (item: NotificationItem) => {
  if (!item.read) {
    await markAsRead(item._id);
  }
  // navigation routing ...
};
```

---

## LOW Severity Issues (4)

### 27. [LOW] Incomplete Dark Mode Theme Classes and Invalid View Text Styling on Status Badges
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:176-193, 290-295, 347-352`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The Stripe warning card uses light-only classes (bg-amber-50 border border-amber-200 text-amber-900 text-amber-700) without dark: equivalents. The 90-day remaining window badges and payout badges use light backgrounds without dark mode support. Line 290 applies text-emerald-600 directly to a View container.

#### Impact on Mobile Users & Affiliates
In dark mode, the Stripe warning card and status pills render with jarring light backgrounds, low-contrast text, or illegible styling. Furthermore, text color classes applied to View elements fail to cascade to children in React Native NativeWind.

#### Adversarial Verification Analysis
Confirmed. Inspection of `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx` verifies the defect:
1. Lines 176-193: The Stripe Connection banner uses hardcoded light-only styling (`bg-amber-50 border border-amber-200`, `text-amber-900`, `text-amber-700`) without corresponding `dark:` variants, rendering an un-themed bright amber box with dark text when dark mode is enabled.
2. Line 290: `<View className={`px-2.5 py-0.5 rounded-full ${c.daysRemaining > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>` incorrectly applies `text-*` classes to a `View` container (which does not cascade to child `Text` elements in React Native / NativeWind) and lacks dark mode background classes.
3. Line 347: `<View className={`px-2.5 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>` also applies text color classes to a `View` container and lacks dark mode background tokens.

Adjusted severity is set to 'low' as this is purely a visual / UI theming inconsistency and does not cause runtime crashes or functionality loss.

#### Exact Code Remediation
Add explicit dark: classes (e.g. dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200, dark:bg-emerald-950/40 dark:text-emerald-400, dark:bg-neutral-800) and ensure text styling classes are placed exclusively on Text elements.

---

### 28. [LOW] Clean Referral Code is Stored in State but Never Exposed in the UI
- **Track Domain:** Mobile Affiliate Screen UI, Balances & Share Integration
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx:28, 57, 215-241`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The screen receives and stores referralCode in state, but the UI only presents the long referralLink URL with a single Copy Link button, omitting the raw referral code and dedicated code copy action.

#### Impact on Mobile Users & Affiliates
Affiliates who want to give their clean referral code (e.g. 'TAMIM482') to contractors filling out the signup form manually must manually extract it from the full URL.

#### Adversarial Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/AffiliateScreen.tsx`, `referralCode` is tracked in state (line 28) and populated from the `getAffiliateStats()` API call (line 57). However, lines 215–241 only render `referralLink` in the UI and provide copy/share actions for the full URL (`handleCopyLink` and `handleShare`). The `referralCode` variable is never exposed in the JSX or copyable as an individual code badge, forcing affiliates who need just the clean code for manual contractor onboarding to manually extract it from the full link string. There are no defensive guards or navigation handlers that expose this code elsewhere in the screen.

#### Exact Code Remediation
Display the referralCode in a dedicated badge alongside the referral link with an individual 'Copy Code' button.

---

### 29. [LOW] Missing affiliate and payout icon mapping in NotificationsScreen
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `ui-flow`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx:445-458`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
getNotificationIcon does not have explicit type or keyword matches for 'affiliate_commission', 'affiliate_payout_approved', or 'affiliate_payout_rejected'. As a result, all affiliate notifications fall through to the default bell icon.

#### Impact on Mobile Users & Affiliates
Affiliate rewards, commissions, and payout notifications render with a generic purple bell icon rather than financial / referral icons, degrading visual hierarchy.

#### Adversarial Verification Analysis
Confirmed. In `/Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx` (lines 445-458), `getNotificationIcon` matches specific notification types and message keywords for tickets, reviews, messages, quotes/payments, leads, job updates, and licenses. However, it lacks cases for backend affiliate notification types ('affiliate_commission', 'affiliate_payout_approved', 'affiliate_payout_rejected') as well as keywords ('affiliate', 'commission', 'payout'). Because affiliate notifications lack sender avatars, all affiliate commission and payout notifications fall through to the default purple bell icon (`name: 'bell'`). While navigation handling in `handleNotificationPress` (line 281) and push handling in `usePushNotifications.ts` (line 309) correctly route to `AffiliateScreen`, the missing icon mapping in `getNotificationIcon` degrades visual hierarchy and distinction in the notification list. Adjusted severity is confirmed as Low.

#### Exact Code Remediation
Add explicit cases for affiliate notifications in getNotificationIcon inside /Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx:
```typescript
if (type === 'affiliate_commission' || m.includes('referral commission') || m.includes('affiliate')) {
  return { name: 'hand-holding-usd', color: '#10b981', bg: isDark ? '#064e3b' : '#d1fae5' };
}
if (type === 'affiliate_payout_approved' || type === 'affiliate_payout_rejected' || m.includes('payout')) {
  return { name: 'wallet', color: '#6366f1', bg: isDark ? '#1e1b4b' : '#eef2ff' };
}
```

---

### 30. [LOW] Affiliate API functions omit Demo Mode mocks causing network errors
- **Track Domain:** Affiliate Push Notifications, Deep Linking & Notification Navigation
- **Category:** `api-network`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1534-1548`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Unlike other API client functions (e.g. getNotifications, browseContractors), getAffiliateStats, requestAffiliatePayout, and createAffiliateStripeConnect do not check isDemoMode(). In Demo mode, live network calls are dispatched to non-existent demo endpoints.

#### Impact on Mobile Users & Affiliates
Opening the Partner / Affiliate screen in Demo Mode triggers live network requests to /api/affiliate/stats, causing network errors or hanging spinners.

#### Adversarial Verification Analysis
Confirmed. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1534-1548`, the affiliate endpoints (`getAffiliateStats`, `requestAffiliatePayout`, `createAffiliateStripeConnect`) completely omit the `if (isDemoMode())` guard present across all other API client functions. Neither `apiClient.ts` base request handlers (`get`, `post`) nor `AffiliateScreen.tsx` contain any fallback or demo check. Navigating to 'Partner Program (Earn 1%)' from `ProfileScreen.tsx` while in Demo Mode results in live HTTP requests to `/api/affiliate/*` using invalid or unauthenticated tokens, failing with network/auth errors and leaving the screen in an empty or failed state.

#### Exact Code Remediation
In /Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts, guard affiliate functions with isDemoMode():
```typescript
export const getAffiliateStats = async (): Promise<any> => {
  if (isDemoMode()) return demo.demoGetAffiliateStats();
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE}/affiliate/stats`, authHeaders);
};
```

---
