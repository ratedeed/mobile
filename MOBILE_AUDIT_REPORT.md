# ratedeedmobile — Full Production Readiness & Web Parity Audit

**Date:** August 28, 2026  
**Audited Repository:** `/Users/tamim/Desktop/ratedeedmobile`  
**Reference Repositories:** `/Users/tamim/Desktop/Ratedeed` (Web Frontend & Express Backend)  
**Total Verified Findings:** 39

---

## Executive Summary & Production Readiness Verdict

### **Verdict: NOT PRODUCTION-READY (Critical Blockers Identified)**

A comprehensive 45-agent audit with adversarial skeptic verification was conducted on `ratedeedmobile` to evaluate feature parity with the web platform, security posture, and App Store / Google Play release readiness.

The audit confirmed **39 verified defects**, including **7 Critical Blockers** and **12 High Severity Issues** that directly affect token refresh session stability, financial charge calculations, push notification delivery, socket connection security, and contractor verification.

### Severity Breakdown

| Severity | Count | Primary Areas |
| :--- | :---: | :--- |
| **Critical** | 4 | Broken 401 Token Refresh, Cents/Dollars Quote Normalization Discrepancies, Milestone Funding Crash, Stale Token Revocation |
| **High** | 15 | Missing Socket Auth Handshake, Decimal Price Range Splitting, License Verification Bypass on Profile Edit, Unhandled Stripe PaymentSheet Errors |
| **Medium** | 12 | Push Deep Link Parameter Mismatch, Missing Offline Queueing, Hardcoded UI Constraints, Unescaped Search Query |
| **Low** | 8 | Missing Haptic Feedback Edge Cases, Icon Sizing, Deprecated Props |

---

## CRITICAL Severity Issues (4)

### 1. [CRITICAL] Broken 401 Token Refresh and Stale Header Retry in apiClient.ts
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:116-121, 193-260`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In apiClient.ts, all authenticated endpoint wrappers (e.g. getContractorProfile, getUserProfile, getNotifications, getJobById, etc.) pre-fetch credentials via 'const authHeaders = await getAuthHeaders()' and pass the resulting object as 'headers' to get/post/put/del. Inside get/post/put/del, makeRequest checks 'if (!hasAuthHeader(headers))' before fetching auth headers. When an endpoint returns a 401, handleResponse calls refreshTokenIfNeeded() which writes a fresh token to SecureStore, and then invokes retryFn() (which calls makeRequest()). However, makeRequest closes over the original 'headers' parameter, which still contains the expired Bearer token. Because hasAuthHeader(headers) evaluates to true, makeRequest never calls getAuthHeaders() to read the refreshed token, resending the exact same expired token on retry and failing with 401 again.

#### Impact on Mobile Users & Parity
When an access token expires during active user sessions, automatic 401 token refresh retry fails for all authenticated endpoints, resulting in unexpected session termination, repeated 401 API errors, and forced logout.

#### Verification Analysis
The finding is CONFIRMED.

Detailed Analysis:
1. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts`, nearly all authenticated endpoint functions (over 50 functions including `getContractorProfile`, `getUserProfile`, `getNotifications`, `getJobById`, `sendMessage`, `getContractorJobs`, etc.) pre-fetch credentials before dispatching requests by executing:
   `const authHeaders = await getAuthHeaders();`
   and passing `authHeaders` as the `headers` argument to `get()`, `post()`, `put()`, or `del()`.

2. Inside `get`, `post`, `put`, and `del` (lines 193-260), an inner closure `makeRequest` checks `if (!hasAuthHeader(headers))` before resolving auth headers from `SecureStore`. Because `headers` was passed with the pre-fetched Bearer token, `hasAuthHeader(headers)` evaluates to `true`, bypassing dynamic header resolution.

3. When an access token expires:
   a. The initial network request executes with the expired token in `currentHeaders` and receives HTTP 401.
   b. `handleResponse()` catches the 401 on line 117-121 and calls `await refreshTokenIfNeeded()`.
   c. `refreshTokenIfNeeded()` (lines 70-114) contacts `/api/users/refresh-token`, obtains a new token, and persists it to `SecureStore` via `await setSecureItem('auth_token', data.token)`.
   d. `handleResponse()` then invokes `retryFn()`, which calls `makeRequest()`.
   e. When `makeRequest()` executes on retry, it closes over the original `headers` parameter containing the expired `Authorization` header. Because `hasAuthHeader(headers)` remains `true`, it never queries `getAuthHeaders()` for the newly stored token.
   f. `makeRequest()` replays the HTTP request using the exact same expired Bearer token, receiving a second 401 from the server.
   g. Since `retried` is now `true`, `handleResponse()` throws an unhandled API Error 401.

4. No interceptors, normalizers, or polyfills mitigate this bug. Automatic 401 recovery is completely broken for all authenticated endpoint wrapper functions.

Adjusted Severity: critical.

#### Required Remediation
Remove manual 'const authHeaders = await getAuthHeaders()' calls from individual endpoint wrapper functions so that makeRequest manages authorization headers dynamically. In makeRequest, always re-evaluate authorization headers from SecureStore on every request execution (and retry execution) rather than relying on a stale closed-over headers object.

---

### 2. [CRITICAL] Password reset leaves Firebase Auth out-of-sync and discards returned session tokens, causing permanent login lockout
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `production-blocker`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ResetPasswordScreen.tsx:72-82`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend POST /api/users/reset-password updates MongoDB user.password and increments tokenVersion but does not synchronize the password with Firebase Auth via admin.auth().updateUser(user.firebaseUid, { password: newPassword }). Furthermore, ResetPasswordScreen.tsx discards the returned session tokens ({ token, refreshToken, socketToken }) and redirects to LoginScreen.js. When the user tries logging in on LoginScreen.js, Firebase Auth signInWithEmailAndPassword rejects the credentials because Firebase still holds the old password.

#### Impact on Mobile Users & Parity
Users who reset their password via mobile or web email link are permanently locked out on the mobile app because LoginScreen cannot authenticate with the new password against Firebase Auth.

#### Verification Analysis
Confirmed. In backend userRoutes.js (`POST /api/users/reset-password`), MongoDB `user.password` and `tokenVersion` are updated, but Firebase Auth is never synchronized via `admin.auth().updateUser(user.firebaseUid, { password: newPassword })` (unlike `/api/users/change-password` which does perform this update). Additionally, `ResetPasswordScreen.tsx` (lines 72-77) discards the session tokens returned by the backend and redirects the user to `LoginScreen.js`. Because `LoginScreen.js` (line 121) authenticates against Firebase Auth using `signInWithEmailAndPassword(auth, email, password)`, Firebase rejects the user's new password with `auth/invalid-credential` or `auth/wrong-password`. Users who forgot their old password and reset it are permanently locked out on both mobile and web.

#### Required Remediation
1. Update backend userRoutes.js /api/users/reset-password to call admin.auth().updateUser(user.firebaseUid, { password: newPassword }) when user.firebaseUid exists. 2. Update ResetPasswordScreen.tsx to take the returned token and refreshToken and call updateBackendToken(res.token, true, res) to authenticate the user immediately upon reset.

---

### 3. [CRITICAL] Milestone Quote Acceptance Payment Intent Fails Due to Subdocument ID Desynchronization
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `production-blocker`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx:158-166`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
When accepting a milestone quote, QuoteReviewScreen passes firstMilestone._id (from quote.milestones) to PaymentFlowScreen. When createPaymentIntent(quoteId, milestoneId) is called, backend stripeController.js creates a Job from quote.milestones without copying the subdocument ObjectIds (_id), giving job.milestones brand new ObjectIds. The backend then queries job.milestones.find(m => m._id.toString() === bodyMilestoneId.toString()), which fails to match and throws a 400 'Milestone not found or already funded' rejection.

#### Impact on Mobile Users & Parity
100% of milestone quotes fail to initialize payment intents from QuoteReviewScreen. Homeowners are blocked with a 400 error from accepting quotes and paying milestone deposits.

#### Verification Analysis
CONFIRMED: The audit finding is 100% verified and accurate.

1. In `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx` (lines 148-166), when navigating to `PaymentFlow`, `milestoneId` is populated with `firstMilestone._id` from `quote.milestones`.
2. In `/Users/tamim/Desktop/ratedeedmobile/src/screens/PaymentFlowScreen.tsx` (lines 70, 200, 268) and `apiClient.ts` (line 1371), `createPaymentIntent(quoteId, milestoneId)` sends `{ quoteId, milestoneId }` as `POST /api/stripe/payment-intent`.
3. In `/Users/tamim/Desktop/Ratedeed/api/backend/controllers/stripeController.js` (lines 1275-1279), when creating a new `Job`, `milestones` are mapped as `{ name: m.name, amount: m.amount, status: 'pending' }` without copying `_id: m._id`. Mongoose automatically generates brand new ObjectIds for `job.milestones`. (The same omission exists in `jobController.js:85-89`).
4. In `stripeController.js` (lines 1306-1313):
```js
if (bodyMilestoneId) {
    nextMilestone = job.milestones.find(m => m._id.toString() === bodyMilestoneId.toString());
} else {
    nextMilestone = job.milestones.find(m => m.status === 'pending');
}
if (!nextMilestone) {
    return res.status(400).json({ message: 'Milestone not found or already funded' });
}
```
Because `bodyMilestoneId` is the `Quote` subdocument ObjectId, it will never match the newly generated `Job` subdocument ObjectIds in `job.milestones`. The query returns `undefined`, triggering the 400 error and completely blocking mobile users from accepting and funding milestone quotes.

#### Required Remediation
In stripeController.js (and jobController.js), preserve the milestone _id when instantiating Job.milestones from quote.milestones ({ _id: m._id, name: m.name, amount: m.amount, status: 'pending' }), or fallback to the first pending milestone in job.milestones if bodyMilestoneId does not match job subdocument IDs directly.

---

### 4. [CRITICAL] False-Positive Payment Confirmation on App Resume for Subsequent Milestones
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `financial`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/PaymentFlowScreen.tsx:114-130, 163-172`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
PaymentFlowScreen registers an AppState listener that triggers startPollingPaymentStatus(false) whenever the app returns from background to active. startPollingPaymentStatus checks quote.status === 'accepted' || quote.status === 'paid'. On milestone jobs where a prior milestone was already funded and the quote status is already 'accepted', returning to the app (e.g. from an SMS OTP prompt or banking app) immediately triggers the success branch, transitioning to Step 2 'Payment Confirmed' and notifying the chat thread even if the Stripe payment intent was never confirmed or failed.

#### Impact on Mobile Users & Parity
Homeowners and contractors receive false confirmation that milestone payments were captured and held in escrow when returning to the app, allowing work to proceed without payment or escrow protection.

#### Verification Analysis
Confirmed. In PaymentFlowScreen.tsx (lines 109-130 and 163-172), returning to the app while on Step 0 triggers startPollingPaymentStatus(false) via the AppState listener. The polling function evaluates whether quote.status === 'accepted' || quote.status === 'paid' || (quote.jobId && quote.jobStatus !== 'awaiting_payment'). For any subsequent milestone on an existing accepted/partially-funded job, these conditions are already true before payment. This immediately sends a false escrow confirmation message to the chat thread and transitions the UI to Step 2 ('Payment Confirmed') without verifying the milestone status or capturing payment.

#### Required Remediation
Check the specific milestone funding status (e.g. job.milestones.find(m => m._id === milestoneId)?.status === 'funded') and verify the PaymentIntent clientSecret status rather than checking global quote.status === 'accepted'.

---

## HIGH Severity Issues (15)

### 5. [HIGH] Missing Quote and Job Data Normalization Leading to Cent/Dollar Financial Discrepancies
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `financial`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1153-1250`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In the web codebase (src/lib/api.ts), normalizeQuote and normalizeJob convert integer cents from the backend (totalAmount, subtotal, platformFee, lineItems.amount, milestones.amount, amountFunded) into dollar floats at the API client boundary. In the mobile codebase, apiClient.ts does not normalize Quote or Job objects. Individual mobile screens implement conflicting assumptions: JobDetailScreen and QuoteReviewScreen manually divide by 100, PaymentFlowScreen applies a flawed heuristic (rawTotal < 100 ? rawTotal * 100 : rawTotal) which treats any project over $100 as raw cents ($150 becomes $1.50), and QuoteReviewScreen checks diagnosticFeeCredit > 1000 ? 100 : 1, corrupting credit values under $10.

#### Impact on Mobile Users & Parity
Financial discrepancy and payment miscalculations across mobile screens, including charging 1/100th of the intended amount (e.g. $1.50 instead of $150) in PaymentFlowScreen and miscalculating diagnostic credits in QuoteReviewScreen.

#### Verification Analysis
The finding is CONFIRMED. 

Verification details:
1. Backend & API Client Parity: In the backend (Quote.js, Job.js), all monetary fields (totalAmount, subtotal, platformFee, lineItems.amount, milestones.amount, amountFunded, diagnosticFeeCredit) are stored in integer cents. The web client (src/lib/api.ts:177-227) explicitly normalizes Quote and Job entities by dividing all cent values by 100 at the API boundary. The mobile client (src/utils/apiClient.ts) lacks any Quote/Job normalizers, returning raw integer cents from the backend.
2. Inconsistent and Flawed Ad-Hoc Heuristics:
   - QuoteReviewScreen.tsx (line 416) uses the heuristic `(Number(quote.diagnosticFeeCredit) / (quote.diagnosticFeeCredit > 1000 ? 100 : 1)).toFixed(2)`. For any diagnostic fee credit <= $10.00 (<= 1000 cents, e.g., $5.00 = 500 cents), it divides by 1 instead of 100, displaying -$500.00 instead of -$5.00.
   - PaymentFlowScreen.tsx (lines 34, 402) and JobDetailScreen.tsx (lines 619-624) use `rawTotal > 0 && rawTotal < 100 ? rawTotal * 100 : rawTotal`. If a dollar float is passed (e.g. $150), values >= 100 are treated as raw cents ($1.50).
   - Inconsistent formatCurrency definitions: money.ts defines formatCurrency expecting dollar values, whereas JobDetailScreen and ChangeOrderScreen define local formatCurrency helpers expecting cents, and ContractorDashboardScreen / ActiveJobsScreen perform manual inline division by 100.

Severity is assessed as High (severe financial display corruption and brittle ad-hoc heuristics across payment and quote review screens).

#### Required Remediation
Port normalizeQuote and normalizeJob from web api.ts into mobile apiClient.ts. Apply them automatically to all Quote and Job response payloads (getQuote, getUserQuotes, getContractorQuotes, getJobById, getUserJobs, getContractorJobs, createQuote, createQuoteFromChat). Standardize money display across screens by using formatCurrency from money.ts on normalized dollar values.

---

### 6. [HIGH] Decimal Price Splitting Bug in parsePriceRange Corrupts Service Pricing
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/price.ts:1-32`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
parsePriceRange uses 'clean.replace(/,/g, '').match(/\d+/g)' to extract numeric values. Because '\\d+' only matches integer digits and ignores decimal points, a decimal price string like '$75.50 - $150.00' is split into ['75', '50', '150', '00']. numbers[0] is assigned to min ('75') and numbers[1] is assigned to max ('50'). When saved back to the backend via formatPriceRange in ContractorOnboardingScreen, ContractorEditProfileScreen, or ContractorDashboardScreen, the corrupted range is permanently written to the contractor's profile in the database.

#### Impact on Mobile Users & Parity
Contractor service pricing estimates containing decimal numbers are corrupted when parsed and saved, converting valid prices like $75.50 - $150.00 into $75 – $50.

#### Verification Analysis
CONFIRMED.

Analysis of /Users/tamim/Desktop/ratedeedmobile/src/utils/price.ts (lines 1-32):

1. Mechanism Verification:
In `parsePriceRange`:
```ts
const numbers = clean.replace(/,/g, '').match(/\d+/g);
if (numbers && numbers.length >= 2) {
  return { min: numbers[0], max: numbers[1], contactForQuote: false };
}
```
Because the regular expression `/\d+/g` matches contiguous digit sequences and ignores decimal points (`.`), any price string containing decimal values is split at the decimal separator:
- `"$75.50 - $150.00"` produces `['75', '50', '150', '00']`. `numbers[0]` ('75') is assigned to `min` and `numbers[1]` ('50') is assigned to `max`. The upper bound `$150.00` is completely discarded.
- `"$100.00+"` produces `['100', '00']`, which enters the `numbers.length >= 2` branch instead of the single number `+` branch, returning `{ min: '100', max: '00' }`.
- `"Up to $50.00"` produces `['50', '00']`, which also enters `numbers.length >= 2`, returning `{ min: '50', max: '00' }`.

2. Save/Corruption Path:
In `ContractorOnboardingScreen.tsx` (line 256), `ContractorEditProfileScreen.tsx` (line 388), and `ContractorDashboardScreen.tsx` (line 893), the parsed `minPrice` and `maxPrice` are formatted via `formatPriceRange` (or inline formatter):
```ts
formatPriceRange('75', '50', false) // returns '$75 – $50'
formatPriceRange('100', '00', false) // returns '$100 – $0'
```
When the contractor saves their profile, the corrupted string is sent to the backend and permanently overwrites `servicesOffered[].priceEstimate` in MongoDB.

3. Lack of Mitigations:
There are no intermediate sanitizers, schema validations, or defensive guards that prevent this regex tokenization bug. Floating point numbers must be matched using a pattern such as `/\d+(?:\.\d+)?/g`.

#### Required Remediation
Update parsePriceRange to match floating point numbers using regex /\\d+(?:\\.\\d+)?/g instead of /\\d+/g, ensuring decimal numbers like 75.50 and 150.00 are captured as complete numbers before assigning min and max values.

---

### 7. [HIGH] login() Destructures Non-Existent data.user Property Wiping Persistent User Data
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:395-407`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In apiClient.ts, the login() function attempts to persist user profile data using 'const userData = { ...data.user }; delete userData.token; ... AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData))'. However, the backend route POST /api/users/login returns user attributes flat at the root level of the response object (e.g. data._id, data.firstName, data.role), not nested under data.user. As a result, data.user is undefined, and an empty object '{}' is stored in AsyncStorage under USER_DATA_KEY.

#### Impact on Mobile Users & Parity
Calling the login() API function wipes out stored user profile attributes in AsyncStorage, causing local authentication state to lose user metadata.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` lines 395-407, `login()` performs `const userData = { ...data.user };` before saving to `AsyncStorage` under `USER_DATA_KEY`. However, the backend endpoint `POST /api/users/login` in `/Users/tamim/Desktop/Ratedeed/api/backend/routes/userRoutes.js` (lines 149-165) returns user attributes flat at the root level of the response (`_id`, `firstName`, `role`, `email`, etc.) rather than nested under a `user` property. Consequently, `data.user` is undefined, `{ ...data.user }` evaluates to an empty object `{}`, and `AsyncStorage` is written with `{}`. In contrast, `backendLoginFirebase` (lines 449-450) and `appleSignIn` (lines 1380-1381) correctly extract flat properties via `const { token, refreshToken, socketToken, ...userData } = data;`.

#### Required Remediation
Destructure root-level user properties from the response object in login() identical to backendLoginFirebase: 'const { token, refreshToken, socketToken, ...userData } = data; await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));'.

---

### 8. [HIGH] refundJob Submits Dollar Values to Cent-Based Backend Endpoint
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `financial`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1220-1224`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend endpoint POST /api/jobs/:id/refund expects the 'amount' field in integer cents. Web api.ts converts dollar amounts using 'amount: amount ? Math.round(amount * 100) : undefined'. Mobile apiClient.ts forwards the 'amount' argument directly without multiplying by 100. When a user or contractor requests a partial refund of $50, the backend receives 50 cents instead of 5000 cents.

#### Impact on Mobile Users & Parity
Refund requests submitted through the mobile app are processed for 1% of the intended amount (e.g. requesting a $50 refund results in a $0.50 Stripe refund).

#### Verification Analysis
CONFIRMED.

Analysis & Verification:
1. Backend Endpoint Contract:
In `/Users/tamim/Desktop/Ratedeed/api/backend/controllers/jobController.js` (lines 1210, 1253-1256, 1298), `POST /api/jobs/:id/refund` explicitly expects `req.body.amount` to be in integer cents (e.g., lines 1256 & 1298 pass `amount` directly to `stripe.refunds.create({ amount: refundAmount })`).

2. Web Client Parity:
In `/Users/tamim/Desktop/Ratedeed/src/lib/api.ts` (lines 403-407), the web client converts dollar amounts to integer cents:
`body: JSON.stringify({ amount: amount ? Math.round(amount * 100) : undefined, reason })`

3. Mobile Client Bug:
In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1219-1223):
```ts
export const refundJob = async (jobId: string, amount?: number, reason?: string): Promise<any> => {
  if (isDemoMode()) return demo.demoRefundJob(jobId, amount, reason);
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE}/jobs/${jobId}/refund`, { amount, reason }, authHeaders);
};
```
Mobile passes the dollar argument directly in `{ amount, reason }` without multiplying by 100. There are no interceptors or normalizers in `post()` or downstream in mobile that convert this value.

4. Financial Impact:
If a caller supplies a dollar amount (e.g., $50), the backend receives 50 cents ($0.50), resulting in an under-refund of 99% of the intended amount.

Remediation:
Update `refundJob` in `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` to convert dollar amounts to cents using `dollarsToCents(amount)` from `/Users/tamim/Desktop/ratedeedmobile/src/utils/money.ts` or `amount != null ? Math.round(amount * 100) : undefined`.

#### Required Remediation
Update refundJob in apiClient.ts to convert dollar amounts to integer cents: 'amount: amount != null ? Math.round(amount * 100) : undefined', or use the dollarsToCents helper from money.ts.

---

### 9. [HIGH] Premature logout and missing backend synchronization in Profile email change flow breaks authentication
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `production-blocker`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ProfileScreen.tsx:442-468`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
handleChangeEmail invokes Firebase verifyBeforeUpdateEmail(auth.currentUser, emailNew.trim()) and immediately calls logout() followed by navigation to Login with verified=true. In Firebase Auth, the email is not updated until the user clicks the verification link in their email inbox, and the backend /api/users/request-email-change endpoint is never invoked. Attempting to log in on LoginScreen with the new email immediately fails with auth/user-not-found or auth/invalid-credential.

#### Impact on Mobile Users & Parity
Users attempting to change their email on mobile are immediately logged out into a broken state where neither the old nor the new email can be used to log in on LoginScreen.

#### Verification Analysis
CONFIRMED: The finding accurately identifies a critical UX and authentication synchronization defect in ProfileScreen.tsx:442-468.

1. Mechanism & Code Verification:
- In ProfileScreen.tsx (lines 442-468), `handleChangeEmail` executes Firebase Auth's `verifyBeforeUpdateEmail(auth.currentUser, emailNew.trim())`.
- Firebase's `verifyBeforeUpdateEmail` only dispatches an action email to the new address; it does NOT update the user's email in Firebase Auth until the link is opened and verified by the user.
- Immediately following `verifyBeforeUpdateEmail`, ProfileScreen calls `await logout()` and navigates to `LoginScreen` with `{ verified: true }`.
- On LoginScreen.js (lines 41-51), a toast notification displays: "Your email has been changed. Use your new email to log in."
- When the user follows this instruction and attempts to log in with the new email, Firebase Auth `signInWithEmailAndPassword` fails with `auth/user-not-found` or `auth/invalid-credential` because the email has not yet been updated in Firebase.

2. Backend Desynchronization:
- The backend contains a full, secure email-change verification flow: `POST /api/users/request-email-change` (which verifies MongoDB and Firebase email uniqueness, and issues a 1-hour verification token) and `POST /api/users/verify-email-change` (which updates MongoDB `user.email` and Firebase Admin email).
- The mobile app already provides `VerifyEmailChangeScreen.tsx` and `apiClient.requestEmailChange`, but ProfileScreen bypasses this entire protocol in favor of client-side Firebase Auth calls, leaving the backend and MongoDB database desynchronized.

3. Impact & Verdict:
- The user is prematurely logged out of their session and guided directly into a failing login attempt.
- The finding is fully CONFIRMED with Severity High.

#### Required Remediation
Align mobile with the backend email-change protocol: call apiClient.requestEmailChange(emailNew, emailPassword) to dispatch the backend verification email with token, do not prematurely call logout(), and inform the user that their current session remains active until they verify the link.

---

### 10. [HIGH] Double Platform Fee Deduction Rendered in Contractor Earnings History
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `financial`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/EarningsScreen.tsx:211-216`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend stripeController.js populates payment transactions from TransactionLog entries with type 'funds_released' / 'milestone_released', where amount is already the net payout after deducting the 5% platform fee (quote.subtotal). EarningsScreen treats item.amount as Gross, computes Fee (5%) on this net figure, and subtracts it again to show a discounted Net (95%) figure.

#### Impact on Mobile Users & Parity
Contractors see a second 5% platform fee deducted from their transaction history, showing inaccurate net payout calculations and triggering contractor distrust and support complaints.

#### Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/EarningsScreen.tsx (lines 211-216), `item.amount` is treated as a Gross payment amount and subjected to a second 5% fee calculation:
- Backend `/api/stripe/earnings` (`/Users/tamim/Desktop/Ratedeed/api/backend/controllers/stripeController.js:1473-1494`) populates payment transactions from `TransactionLog` entries with type `funds_released` / `milestone_released`.
- In `jobController.js` (`releaseFunds`, lines 272-302, 486-498), `amountToTransfer` recorded in `TransactionLog` is already `quote.subtotal` (or `milestone.amount * ratio`), which is net of the initial 5% platform fee deducted at quote creation.
- When `EarningsScreen.tsx` renders payment transaction items, it displays `Gross: formatCurrency(amount)`, `Fee: formatCurrency(amount * (feePercent / 100))`, and `Net: formatCurrency(amount * (1 - feePercent / 100))`.
- For instance, on a $1,000 job with a $50 platform fee, the backend records and returns $950 as `item.amount`. The mobile app displays Gross: $950, Fee: $47.50, and Net: $902.50, visually deducting the platform fee twice and misleading contractors about their actual payout.

#### Required Remediation
Display item.amount directly as Net Payout or reconstruct the gross value by dividing by (1 - feePercent / 100) before computing the fee breakdown.

---

### 11. [HIGH] Misleading Unilateral Job Cancellation on Funded In-Progress Escrow Jobs
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ActiveJobsScreen.tsx:351-373`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ActiveJobsScreen and JobDetailScreen render a 'Cancel Job' button for homeowners on funded_in_progress and partially_funded jobs with an alert prompt stating 'This will cancel the job and refund your payment from escrow'. However, backend jobController.js explicitly forbids unilateral homeowner cancellations on active funded jobs (lines 1368-1372), returning a 400 Bad Request error.

#### Impact on Mobile Users & Parity
Homeowners are presented with a 'Cancel Job' button promising immediate escrow refunds on active jobs, which unconditionally fails with a 400 error upon confirmation.

#### Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/ActiveJobsScreen.tsx (lines 351-373) and /Users/tamim/Desktop/ratedeedmobile/src/screens/JobDetailScreen.tsx (lines 340-351, 1106-1116), homeowners are shown a 'Cancel Job' button on jobs with 'funded_in_progress' and 'partially_funded' status, with confirmation dialogs promising 'This will cancel the job and refund your payment from escrow'. However, backend /Users/tamim/Desktop/Ratedeed/api/backend/controllers/jobController.js (lines 1368-1372) explicitly disallows unilateral homeowner cancellations on funded jobs (`if (isUser && !isContractor && isFunded)`), unconditionally rejecting the request with HTTP 400 Bad Request. Homeowners clicking this button always experience a failed cancellation attempt.

#### Required Remediation
Restrict the homeowner 'Cancel Job' button to 'awaiting_payment' status only. For funded jobs, display 'Raise Dispute' or provide clear instructions to initiate dispute mediation or request contractor cancellation.

---

### 12. [HIGH] Contractor Quote Withdrawal Fails with 403 Forbidden
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx:585-595`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
When a contractor taps 'Withdraw Quote' in QuoteReviewScreen, the screen executes updateQuoteStatus(quoteId!, 'cancelled'). Backend quoteController.js (lines 340-351) requires contractors to send 'withdrawn', 'declined', or 'rejected', and explicitly rejects other status values with 403 Forbidden 'Contractors can only withdraw (reject) quotes'.

#### Impact on Mobile Users & Parity
Contractors are unable to withdraw their own pending quotes from mobile, receiving a 403 error.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx` (lines 585–598), when a contractor presses the 'Withdraw Quote' button, the app invokes `updateQuoteStatus(quoteId!, 'cancelled')`. 

In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1396–1400), `updateQuoteStatus` sends `PUT /api/quotes/:id/status` with body `{ status: 'cancelled' }`.

In backend `/Users/tamim/Desktop/Ratedeed/api/backend/controllers/quoteController.js` (lines 340–351):
1. Lines 341–343 only alias `'withdrawn'` and `'declined'` to `'rejected'`. The value `'cancelled'` remains unmodified as `targetStatus = 'cancelled'`.
2. Lines 345–347 evaluate `if (isContractor && targetStatus !== 'rejected')` and immediately return HTTP 403 Forbidden with `{ message: 'Contractors can only withdraw (reject) quotes' }`.
3. There are no client-side interceptors, request transformers, or backend middleware that convert `'cancelled'` to `'withdrawn'` or `'rejected'`.

Consequently, any attempt by a contractor to withdraw a pending quote on mobile fails with 403 Forbidden. The finding is real and correctly identified.

#### Required Remediation
Update QuoteReviewScreen.tsx line 590 to pass 'withdrawn' or 'rejected' (await updateQuoteStatus(quoteId!, 'withdrawn')).

---

### 13. [HIGH] Missing React Native Firebase Notification Tap Listeners Breaks Background and Cold-Start Deep Linking
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `production-blocker`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:309-342`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The mobile app registers for FCM tokens using @react-native-firebase/messaging and backend push notifications are sent via Firebase Admin SDK. However, usePushNotifications.ts only attaches listeners from expo-notifications (Notifications.addNotificationResponseReceivedListener and Notifications.getLastNotificationResponseAsync()). On Android and iOS native builds, background/quit notification taps delivered by native Firebase Cloud Messaging are dispatched to messaging().onNotificationOpenedApp() and messaging().getInitialNotification(), neither of which is implemented in usePushNotifications.ts.

#### Impact on Mobile Users & Parity
When a user taps an incoming push notification from the Android or iOS notification center while the app is in the background or killed, the tap event is lost and deep linking never fires. Users are brought to whatever screen the app was previously on or to the initial screen instead of the relevant chat, job, quote, or support ticket.

#### Verification Analysis
CONFIRMED: The finding is verified and accurate.

1. Mechanism Analysis:
- In `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts`, the app requests push permissions and retrieves the push token using `@react-native-firebase/messaging` (`messaging().getToken()`), which saves the FCM registration token to the backend.
- The backend (`/Users/tamim/Desktop/Ratedeed/api/backend/utils/pushNotifications.js`) sends notifications directly via Firebase Admin SDK with native notification payloads (`android.notification` and `apns.payload.aps.alert`).
- When the app is in the background or killed, incoming push notifications are delivered natively by Firebase / APNs.
- When the user taps an OS-delivered notification, native Android/iOS intents are routed to the React Native Firebase messaging module.
- However, `usePushNotifications.ts` (lines 309–342) exclusively attaches listeners from `expo-notifications` (`Notifications.addNotificationResponseReceivedListener` and `Notifications.getLastNotificationResponseAsync()`).
- Neither `messaging().onNotificationOpenedApp()` (for background taps) nor `messaging().getInitialNotification()` (for cold-start taps) is implemented anywhere in the mobile codebase.

2. Impact:
- When a user taps a push notification delivered while the app is in the background or terminated, the tap event is not captured by `expo-notifications`. As a result, `handleRouteData` is never invoked, and the app fails to navigate to the intended chat conversation, job details, quote review, or support ticket.

3. Severity Assessment:
- Adjusted from 'critical' to 'high' because while it completely breaks notification deep linking on background and cold-start states across Android and iOS, it does not cause app crashes, data corruption, or security vulnerabilities.

#### Required Remediation
In usePushNotifications.ts, register messaging().onNotificationOpenedApp((remoteMessage) => handleRouteData(remoteMessage.data)) for background notification taps, and invoke messaging().getInitialNotification().then((remoteMessage) => { if (remoteMessage) handleRouteData(remoteMessage.data); }) on cold launch alongside the Expo notification listeners.

---

### 14. [HIGH] handleMessagesRead Lacks Conversation ID Guard Causing Cross-Conversation Read Receipt Corruption
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js:505-513`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend messagesRoutes.js emits io.to(otherParticipant).emit('messagesRead', { conversationId, readerId, readAt }). In MessagesScreen.js, handleMessagesRead receives this event and maps over the active messages array with if (sId !== readerId) return { ...m, read: true }. It omits checking whether conversationId in the payload matches selectedConvRef.current?.conversationId, causing cross-conversation state pollution.

#### Impact on Mobile Users & Parity
When a user receives a messagesRead socket event for any other conversation (e.g. Conversation B), all sent messages in the currently open conversation (Conversation A) are immediately and incorrectly marked as read (double checkmarks) in the UI before the other participant in Conversation A has actually read them.

#### Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js:505-513, `handleMessagesRead` receives the payload `{ conversationId, readerId }` emitted by backend `messagesRoutes.js` (lines 609-613, 664-668) via `io.to(otherParticipant.toString()).emit('messagesRead', ...)`.

Because the backend emits `messagesRead` to the user's personal socket room rather than a conversation-specific room, the mobile client receives `messagesRead` events for all conversations the user is a participant in.

In `MessagesScreen.js`, `handleMessagesRead` unconditionally executes:
```javascript
const handleMessagesRead = ({ conversationId, readerId }) => {
  setMessages((prev) => prev.map((m) => {
    const sId = resolveId(m.senderId);
    if (sId !== readerId) {
      return { ...m, read: true };
    }
    return m;
  }));
};
```
Unlike `handleTyping` (line 524) and `handleNewMessage` (line 465), which check `selectedConvRef.current?.conversationId === conversationId`, `handleMessagesRead` does not check if `conversationId` matches `selectedConvRef.current?.conversationId` or `selectedConvRef.current?._id`.

As a result, if a user has Conversation A open and another contact opens Conversation B, the `messagesRead` socket event for Conversation B causes all messages sent by the user in Conversation A to be marked as `read: true` immediately in the UI.

In contrast, the web client (`src/lib/message-store.ts:343-360`) correctly indexes messages by `convId = data.conversationId`. The mobile app requires a matching conversation ID guard before modifying the active `messages` state.

#### Required Remediation
Add a conversation guard in handleMessagesRead in MessagesScreen.js: if (conversationId && selectedConvRef.current && selectedConvRef.current.conversationId !== conversationId && selectedConvRef.current._id !== conversationId) return; before mapping over messages.

---

### 15. [HIGH] React Navigation Deep Linking Config Missing Canonical URL Patterns for Profiles, Messages, and Quotes
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/App.js:99-144`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In App.js linking.config.screens, BusinessDetail is only mapped to contractor/:slug (missing c/:slug and contractors/:slug which are used by reviewController.js, contractorRoutes.js, and web sitemaps), ChatScreen is only mapped to chat/:conversationId (missing messages/:conversationId generated by backend messagesRoutes.js and quoteController.js), and QuoteReview is only mapped to quote-review/:quoteId (missing quote/:quoteId generated by reminderScheduler.ts).

#### Impact on Mobile Users & Parity
Universal links and deep links shared from the web or notifications using canonical web path structures (https://ratedeed.com/c/:slug, https://ratedeed.com/contractors/:slug, https://ratedeed.com/messages/:conversationId, and ratedeed://quote/:id) fail to route to the correct screens, falling back to the Explore/Home tab.

#### Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/App.js (lines 99-144), the `linking.config.screens` mapping lacks canonical and internal route patterns:

1. Profile paths: `BusinessDetail` is only mapped to `'contractor/:slug'`. The web application's canonical route is `/c/[slug]` (src/app/c/[slug]/page.tsx) and backend notifications generated by reviewController.js:103 and contractorRoutes.js:1209/1303 emit links formatted as `/c/:slug`. External universal links or web shares formatted as `https://ratedeed.com/c/:slug` fail to match `BusinessDetail` and fall back to the root Explore screen.
2. Conversation paths: `ChatScreen` is only mapped to `'chat/:conversationId'`. Backend notification links generated by messagesRoutes.js:283 and quoteController.js:577 use `/messages/:conversationId`. When opened via universal or deep link, this matches `Main.screens.Messages: 'messages'`, opening the conversation list tab rather than the specific conversation in `ChatScreen`.
3. Quote reminders: `QuoteReview` is only mapped to `'quote-review/:quoteId'`, but reminderScheduler.ts:105 schedules local push notification payloads with `ratedeed://quote/${info.id}`, which fails to match `QuoteReview`.

Because `linking` does not implement a custom `getStateFromPath` or normalizer, React Navigation drops or misroutes these links. The finding is valid and confirmed.

#### Required Remediation
In App.js linking config, expand the screen path mappings or aliases to include path patterns: BusinessDetail: 'c/:slug', ChatScreen: 'messages/:conversationId', and alias quote/:quoteId to QuoteReview.

---

### 16. [HIGH] Appointment Reminder Push Notifications Dropped by handleRouteData Routing Ladder
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:263-307`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend server.js cron schedules 1-hour reminders with push payload data: { type: 'appointment_reminder', quoteId: quote._id.toString() } and local scheduler uses type: 'diagnostic_1hr_reminder'. In usePushNotifications.ts handleRouteData(), the if/else routing chain checks new_message, ticket_reply, quote_request, new_lead, review_reminder, job_update, etc., but has no branch for appointment_reminder or diagnostic_1hr_reminder. Because there is also no link string in the appointment reminder payload, it falls through completely without taking action.

#### Impact on Mobile Users & Parity
When homeowners or contractors receive 1-hour appointment reminder push notifications (sent from the backend cron in server.js:666 or local reminderScheduler.ts), tapping the notification does not navigate to the quote review or appointment details, resulting in a dead tap.

#### Verification Analysis
The finding is CONFIRMED.

Code inspection verifies:
1. Backend Cron (/Users/tamim/Desktop/Ratedeed/api/backend/server.js:666, 678):
The 1-hour appointment reminder cron sends FCM notifications to both homeowners and contractors with payload:
`data: { type: 'appointment_reminder', quoteId: quote._id.toString() }`
No `link` string is provided in this payload.

2. Mobile Local Notification Scheduler (/Users/tamim/Desktop/ratedeedmobile/src/utils/reminderScheduler.ts:101-106):
Local notifications scheduled via Expo Notifications provide:
`data: { type: 'diagnostic_1hr_reminder', appointmentId: info.id, isDiagnostic, url: 'ratedeed://quote/' + info.id }`
No `link` property matching `handleRouteData` or deep linking configuration is provided.

3. Push Notification Routing Handler (/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts:263-307):
When a notification is tapped, `addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync` extract `data` and pass it to `handleRouteData(data)`.
The function checks `data?.link` (which is undefined), and then evaluates an `if/else` ladder matching specific notification types (`new_message`, `quote_request`, `ticket_reply`, `ticket_closed`, `new_review`, `new_lead`, `review_reminder`, `job_update`, `stripe_approved`, `affiliate_commission`).
Neither `appointment_reminder` nor `diagnostic_1hr_reminder` is included in this ladder.

4. Impact:
Tapping 1-hour appointment reminder notifications completely falls through `handleRouteData()` with no action taken (dead tap), preventing homeowners and contractors from navigating to the quote/appointment review screen.

Remediation:
Add a branch in `handleRouteData()` in `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts`:
```typescript
else if ((data?.type === 'appointment_reminder' || data?.type === 'diagnostic_1hr_reminder') && (data?.quoteId || data?.appointmentId)) {
  navigation.navigate('QuoteReview', { quoteId: String(data.quoteId || data.appointmentId) });
}
```

#### Required Remediation
Add a case in handleRouteData() in usePushNotifications.ts for appointment_reminder and diagnostic_1hr_reminder: else if ((data?.type === 'appointment_reminder' || data?.type === 'diagnostic_1hr_reminder') && (data?.quoteId || data?.appointmentId)) { navigation.navigate('QuoteReview', { quoteId: String(data.quoteId || data.appointmentId) }); }.

---

### 17. [HIGH] Blocked Conversation Input Not Disabled and Empty-Detail User Reports Fail with 400 Bad Request
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `security`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js:1201-1215`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
1) In MessagesScreen.js, when loadMessages() or fetchConversations() returns 403 or otherParticipant?.hasBlocked / isBlocked is true, MessagesScreen.js does not set a blocked UI state or replace the message composer with a blocked banner (unlike web ChatPage.tsx lines 1161-1168). 2) In handleReport (line 1210), reportConversation(targetId, convId, category, details || '') passes details as reason. In backend reportRoutes.js:143, if (!reason) returns 400 'Reason is required'. If the user does not enter optional details in ReportModal, reason is sent as empty string instead of the selected category, causing the report to be rejected by the backend.

#### Impact on Mobile Users & Parity
When a conversation is blocked by either user, the mobile chat interface still presents an active, editable message input composer, image attachment picker, and quote creation trigger. The user is allowed to compose messages that immediately fail on submission, and no visual indication is provided that the conversation is blocked. Furthermore, if a user submits a report with no additional text details, the report fails with HTTP 400.

#### Verification Analysis
CONFIRMED: The audit finding is 100% accurate across both mechanisms.

1. Blocked Composer State Missing in Mobile:
- In /Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js (lines 1955-2004), the message composer (message TextInput, image picker, quote trigger, and send button) is rendered unconditionally. Unlike web /Users/tamim/Desktop/Ratedeed/src/components/pages/ChatPage.tsx (lines 1161-1168) which displays blocked banners ('You have blocked this user...' or 'This user has blocked you...'), mobile provides no visual banner and does not disable the composer when `blockedUsers.has(targetId)` or `otherParticipant?.hasBlocked` / `isBlocked` is true.
- When an outgoing message is sent to a blocked user, it either shows an unexpected Alert at send time (for locally blocked users, line 912) or fails on backend POST with 403 (for remote blocked users).

2. Empty-Detail Report Fails with 400 Bad Request:
- In /Users/tamim/Desktop/ratedeedmobile/src/components/chat/ReportModal.tsx (lines 40, 101, 108), the details field is labeled 'Additional details (optional)' and defaults to empty string `""`.
- In /Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js (line 1210), `handleReport` invokes `reportConversation(targetId, convId, category, details || "")`.
- In /Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts (line 1454), `reportConversation` maps the 4th parameter (`details || ""`) directly to the request body payload `{ reason }`: `post('${API_BASE}/reports/conversation', { reportedUserId, conversationId, category, reason }, authHeaders)`.
- In backend /Users/tamim/Desktop/Ratedeed/api/backend/routes/reportRoutes.js (line 143), `handleConversationReport` strictly checks `if (!reason) return res.status(400).json({ message: 'Reason is required.' })`.
- Because empty string `""` is falsy, every report submitted without optional text details fails with HTTP 400 'Reason is required.', displaying an error alert to the user and preventing report submission.

#### Required Remediation
1) In MessagesScreen.js, replace the composer bar with a disabled banner 'You have blocked this user' or 'This user has blocked you. You cannot reply to this conversation.' when blockedUsers.has(targetId) or otherParticipant?.hasBlocked is true. 2) In handleReport and apiClient.ts reportConversation, ensure category or details || category is passed as the reason parameter: reportConversation(targetId, convId, category, details?.trim() ? `${category}: ${details.trim()}` : category).

---

### 18. [HIGH] Universal Link & Deep Link Routing Failure for Shared Profile URLs (/c/:slug)
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `production-blocker`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/App.js:110`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The linking configuration in App.js only registers `BusinessDetail: 'contractor/:slug'`, but all web routes, social share links in ContractorDashboardScreen, and email links use `https://www.ratedeed.com/c/:slug`. Because `c/:slug` is omitted from linking.config.screens, incoming shared URLs fail to match and route to BusinessDetail.

#### Impact on Mobile Users & Parity
Universal links and deep links shared via WhatsApp, Twitter, SMS, or web (/c/:slug) fail to resolve in the mobile app, breaking social sharing, contractor marketing, and onboarding link flows.

#### Verification Analysis
CONFIRMED.

In `/Users/tamim/Desktop/ratedeedmobile/App.js` line 110:
`linking.config.screens` defines:
```js
BusinessDetail: 'contractor/:slug',
```

However, across the web platform (`/Users/tamim/Desktop/Ratedeed/src/app/c/[slug]`) and the mobile app itself (`ContractorDashboardScreen.tsx` lines 2059-2076, generating share links for Facebook, X/Twitter, LinkedIn, and WhatsApp), contractor profile URLs are consistently generated and formatted as:
`https://www.ratedeed.com/c/:slug` or `https://ratedeed.com/c/:slug`.

Because React Navigation's `getStateFromPath` strictly matches the path template registered in `linking.config.screens` and does not include `c/:slug`, any incoming Universal Link or deep link targeting `/c/:slug` fails to match `BusinessDetail` and fails to route the user to the contractor's profile.

There are no URL normalizers or deep link middlewares in `App.js` to rewrite `/c/:slug` before React Navigation parses it. Although `usePushNotifications.ts` (lines 240-246) contains custom string splitting for `/c/`, that handler only executes for push notification taps (`expo-notifications`), leaving OS-level deep links and Universal Links unhandled.

Severity: High (breaks core sharing, marketing links, and external contractor profile routing on mobile).

#### Required Remediation
Add the `c/:slug` pattern or route alias to `linking.config.screens` in App.js: `BusinessDetail: { path: 'c/:slug', exact: false }` and support both `c/:slug` and `contractor/:slug`.

---

### 19. [HIGH] Android content:// URIs Bypass Cloudinary Upload in Contractor Portfolio Addition
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx:835`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In `handleAddPortfolio`, the local file check strictly tests `if (finalImageUrl && finalImageUrl.startsWith('file://'))`. On Android, Expo ImagePicker frequently returns `content://` URIs. Because it only checks for `file://`, `content://` URIs bypass `uploadToCloudinary` and are sent directly to `addPortfolioItem`.

#### Impact on Mobile Users & Parity
Local Android file URIs (content://...) get saved into the production database instead of Cloudinary URLs, resulting in broken, unrenderable project images across the web directory and other mobile clients.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx:835`, `handleAddPortfolio` checks `if (finalImageUrl && finalImageUrl.startsWith('file://'))` before calling `uploadToCloudinary`. On Android, `ImagePicker.launchImageLibraryAsync` (called via `pickFromLibrary` at line 509) commonly yields `content://` URIs (such as when selecting images from Google Photos or Android's system document picker). 

Because `pickFromLibrary` returns `asset.uri` without converting or caching it, `portfolioItem.imageUrl` holds the raw `content://...` URI. The strict `.startsWith('file://')` guard evaluates to `false`, bypassing `uploadToCloudinary` entirely. The raw Android `content://` URI is then transmitted to the backend `POST /api/contractors/portfolio` (`contractorRoutes.js:128`), which stores the local Android URI directly into MongoDB. 

This causes broken, unrenderable image links across the web platform and other devices. The finding is confirmed with High severity.

#### Required Remediation
Update the check to `if (finalImageUrl && !finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://'))` before calling `uploadToCloudinary` to ensure all local URIs (content://, file://, ph://, data) are uploaded to Cloudinary.

---

## MEDIUM Severity Issues (12)

### 20. [MEDIUM] createAffiliateStripeConnect Omits platform Parameter Breaking Deep Link Return
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1474-1478`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend endpoint POST /api/affiliate/stripe-connect checks 'req.body.platform === "mobile"' to generate a deep-link return URL ('ratedeed://affiliate?stripe_success=true'). Unlike getStripeConnectUrl, createAffiliateStripeConnect in apiClient.ts posts an empty body '{}' without the platform parameter. Stripe therefore constructs a standard web return URL (https://www.ratedeed.com/affiliate), breaking the mobile onboarding loop.

#### Impact on Mobile Users & Parity
Contractors and affiliates completing Stripe Connect onboarding via mobile are redirected to the website in an external browser rather than returning into the mobile app via deep linking.

#### Verification Analysis
Confirmed. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1474-1477), `createAffiliateStripeConnect` executes `post(`${API_BASE}/affiliate/stripe-connect`, {}, authHeaders)` with an empty payload. In `/Users/tamim/Desktop/Ratedeed/api/backend/routes/affiliateRoutes.js` (lines 184-193), the backend explicitly checks `const isMobile = (req.body && req.body.platform === 'mobile')` to decide between returning deep link URLs (`ratedeed://affiliate?stripe_success=true` / `stripe_refresh=true`) and standard web URLs (`${baseUrl}/affiliate?...`). Because `{ platform: 'mobile' }` is omitted (unlike in `getStripeConnectUrl` at line 1144), `isMobile` resolves to `false`, causing Stripe to construct web return URLs and breaking the mobile deep linking loop back into the app after onboarding.

#### Required Remediation
Pass '{ platform: "mobile" }' in the request body of createAffiliateStripeConnect in apiClient.ts.

---

### 21. [MEDIUM] Incomplete Contractor Normalization in normalizeApiContractor
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:267-376`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Mobile normalizeApiContractor in apiClient.ts lacks several transformations present in web normalizers.ts: it does not derive human-readable location strings from GeoJSON coordinates or city/state fields, does not map completedJobsCount or estimatePolicy, and does not normalize review/post sub-arrays with avatar fallbacks. If a contractor record contains GeoJSON location data ({ type: 'Point', coordinates: [...] }), components rendering contractor.location may display '[object Object]' or undefined.

#### Impact on Mobile Users & Parity
Contractor profile objects lack normalization for reviews, posts, estimate policies, completed jobs count, and formatted location strings, leading to inconsistent display across mobile screens.

#### Verification Analysis
CONFIRMED: The mobile implementation of `normalizeApiContractor` in `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 267-376) is incomplete compared to the web implementation in `/Users/tamim/Desktop/Ratedeed/src/lib/normalizers.ts` (lines 8-164) and violates the `Contractor` TypeScript interface (`location?: string`).

Key discrepancies verified:
1. **Location Resolution & GeoJSON Object Leaks**: In the backend Mongoose model (`api/backend/models/Contractor.js:179-182`), `location` is a GeoJSON Point `{ type: 'Point', coordinates: [lng, lat] }`. Web normalizes this into a human-readable string `location: derivedLocation` and maps coordinates to `businessCenter`. In mobile `normalizeApiContractor`, `location` is omitted from normalized field assignments and inherited from `...data` as an Object. While some screens (`HomeScreen.tsx:168`, `BusinessSearchScreen.tsx:62`) employ inline `typeof loc === 'string'` guards, `BusinessDetailScreen.tsx:1354-1355` does:
   `const rawLocation = [scCity, scState].filter(Boolean).join(', ') || sc.location || '';`
   `const scLocation = rawLocation.replace(/^\d{4,5}\s*,\s*/, '').replace(/^\d{4,5}\s+/, '');`
   When `scCity`/`scState` are absent, `rawLocation` evaluates to the GeoJSON object, throwing `TypeError: rawLocation.replace is not a function` and crashing the Similar Contractors carousel.
2. **Sub-array Normalization**: Unlike web, mobile does not normalize `reviews` and `posts` sub-arrays or supply avatar fallbacks via `avatarUtils`.
3. **Completed Jobs & Policy Defaults**: Fields such as `completedJobsCount` (with `jobsCompleted` fallback) and `showCompletedJobs` (defaulting to `true`) are not mapped.

The finding is accurate and Medium severity is appropriate.

#### Required Remediation
Align mobile normalizeApiContractor with web normalizers.ts by adding derived location string resolution, price range mapping, estimate policy extraction, and review/post sub-array normalization.

---

### 22. [MEDIUM] Password complexity validation disparity between mobile registration screens and backend schema creates orphaned Firebase users
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/RegisterScreen.js:97-111`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend validation middleware (validateUserSignup in validationMiddleware.js) strictly requires a special character matches(/[!@#$%^&*(),.?":{}|<>]/). However, RegisterScreen.js and ContractorSignupScreen.js only validate length >= 8, one uppercase letter, and one number. When a user enters a password without a special character, createUserWithEmailAndPassword succeeds, but backend register() returns 400 Bad Request.

#### Impact on Mobile Users & Parity
Users signing up with valid alphanumeric passwords (e.g. Pass1234) succeed in Firebase account creation but fail backend registration with a 400 validation error, creating orphaned Firebase accounts and broken onboarding states.

#### Verification Analysis
CONFIRMED: There is a direct validation disparity between the mobile client and backend. In RegisterScreen.js (lines 97-111), the client validates length >= 8, uppercase letters, and digits, but lacks a special character check. In backend validationMiddleware.js (lines 38-39), validateUserSignup strictly requires a special character matches(/[!@#$%^&*(),.?":{}|<>]/). When a user enters a password like 'Password123', createUserWithEmailAndPassword succeeds and sendEmailVerification is dispatched, but the subsequent call to register() fails with 400 Bad Request. Although RegisterScreen.js attempts deleteUser(userCreated) in its catch block, the user receives a verification email for a failed registration and cannot complete signup. (Note: ContractorSignupScreen.js posts to /api/contractors which does not validate password complexity, so the 400 failure specifically affects homeowner registration via RegisterScreen.js).

#### Required Remediation
Add special character validation (/[!@#$%^&*(),.?":{}|<>]/) to client-side validation in RegisterScreen.js and ContractorSignupScreen.js before calling createUserWithEmailAndPassword.

---

### 23. [MEDIUM] Stored auth hydration skips tokenVersion revocation verification on mobile app launch
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `security`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx:64-132`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
During loadStoredAuth(), if auth_token in SecureStore is not expired according to its JWT exp timestamp, AuthContext immediately sets isAuthenticated=true and loads cached user data without querying the backend. If tokenVersion was incremented (e.g., password changed or session revoked from web), mobile does not detect revocation at launch. In contrast, web auth-store.ts calls api.getProfile() during initializeAuth() to validate tokenVersion against the database immediately.

#### Impact on Mobile Users & Parity
Sessions revoked on the web or via backend admin remain visually active on mobile upon app launch, exposing cached profile data until an authenticated request fails.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx` (`loadStoredAuth`, lines 64–132), authentication hydration only validates the JWT `exp` claim locally via `isTokenExpired()`. If the unexpired access token is present in SecureStore, AuthContext immediately sets `backendToken`, hydrates cached user profile data from AsyncStorage (`ratedeed-user-data`), and sets `isLoading = false`, establishing `isAuthenticated = true` without contacting the server.

In contrast:
1. Backend Token Version Enforcement: In `/Users/tamim/Desktop/Ratedeed/api/backend/middleware/authMiddleware.js` (lines 39–44) and `userRoutes.js` (lines 253–258), token revocation relies on comparing `decoded.tokenVersion` against `user.tokenVersion` in MongoDB.
2. Web Client Parity: In `/Users/tamim/Desktop/Ratedeed/src/lib/auth-store.ts` (`initializeAuth`, lines 59–115), web requires a successful `api.getProfile()` call against the backend before setting `isAuthenticated: true`.
3. Mobile Risk: Although subsequent network calls (such as background `syncFavoritesWithServer()`) will fail with 401 and eventually trigger `onAuthInvalidated -> logout()`, there is an initial visual state window where revoked sessions appear fully active, and if launched offline or under flaky connectivity, the mobile app remains in an authenticated state displaying cached profile data indefinitely.

Severity remains Medium as backend access remains protected by server-side middleware, but mobile client state management diverges from web and delays token revocation enforcement.

#### Required Remediation
In loadStoredAuth(), perform a lightweight profile check (e.g., getProfile()) on app launch to verify that the stored token's tokenVersion is still valid against the backend database before fully establishing active authentication state.

---

### 24. [MEDIUM] Diagnostic Fee Credit Display Calculation Error for Small Credits
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `financial`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx:416-417`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend stores diagnosticFeeCredit in cents. QuoteReviewScreen uses the conditional Number(quote.diagnosticFeeCredit) / (quote.diagnosticFeeCredit > 1000 ? 100 : 1). For any credit <= 1000 cents (<= $10.00), it divides by 1 instead of 100.

#### Impact on Mobile Users & Parity
Small diagnostic credits of $10.00 or less are displayed 100x inflated (e.g. $5.00 displays as -$500.00 credit), corrupting the quote breakdown calculation.

#### Verification Analysis
CONFIRMED: The finding is accurate and verified against the source code.

1. Source code verification:
In `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx` lines 415-417:
```tsx
<Text className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
  -${(Number(quote.diagnosticFeeCredit) / (quote.diagnosticFeeCredit > 1000 ? 100 : 1)).toFixed(2)}
</Text>
```

2. Mechanism:
- The backend (`api/backend/models/Quote.js` line 19 and `api/backend/controllers/quoteController.js` lines 75, 104, 489, 533) stores `diagnosticFeeCredit` in cents (`Math.round(diagnosticFeeCredit * 100)`).
- When fetched via `getQuote(quoteId)` in mobile (`src/utils/apiClient.ts` line 1390), the raw quote object is returned with `diagnosticFeeCredit` in cents.
- For any diagnostic fee credit <= $10.00 (i.e., <= 1000 cents in database), the ternary condition `quote.diagnosticFeeCredit > 1000` evaluates to false, causing the divisor to be 1 rather than 100.
- For example, a $5.00 credit (500 cents) is displayed as `-$500.00` and a $10.00 credit (1000 cents) is displayed as `-$1000.00`.

3. Impact & Mitigation Check:
- There are no client-side interceptors or normalizers in `getQuote` (unlike `MessagesScreen.js` which normalizes quotes).
- The total amount due row correctly renders `totalAmount / 100`, which creates a visible arithmetic discrepancy in the quote breakdown card where the credit row displays a 100x inflated discount while the total reflects the true deduction.
- Severity is confirmed at Medium.

#### Required Remediation
Replace the conditional with unconditional division by 100: (Number(quote.diagnosticFeeCredit) / 100).toFixed(2).

---

### 25. [MEDIUM] Blank State and Inoperative Action Handlers in ChangeOrderScreen on Deep Navigation
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ChangeOrderScreen.tsx:38-51, 97-129`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
ChangeOrderScreen relies entirely on route.params.changeOrder to populate changeOrderState. When opened via deep link or route without pre-loaded state, changeOrderState is undefined and the component lacks a useEffect hook to fetch the change order by changeOrderId or jobId, causing accept and decline handlers to silently exit.

#### Impact on Mobile Users & Parity
Opening a change order via deep link or chat notification renders a blank form with non-functional Accept/Decline action buttons.

#### Verification Analysis
CONFIRMED: In /Users/tamim/Desktop/ratedeedmobile/src/screens/ChangeOrderScreen.tsx, the component initializes its state exclusively from route parameters: `const { jobId, mode, changeOrderId, changeOrder: initialChangeOrder } = (route.params || {})` and `const [changeOrderState, setChangeOrderState] = useState(initialChangeOrder)`. 

1. Deep Link Breakdown: In /Users/tamim/Desktop/ratedeedmobile/App.js (line 134), the linking configuration defines `ChangeOrderScreen: 'change-order/:jobId'`. When a user navigates to the screen via deep link, only `jobId` is passed in `route.params`. As a result, `mode` is undefined (`isCreate` evaluates to `false`), causing the screen to render the review mode branch.
2. Missing Fetch Lifecycle: `ChangeOrderScreen.tsx` imports only `useState` from React and contains no `useEffect` hook or API call on mount. It cannot fetch the job or its change orders using `getJobById(jobId)`.
3. Broken UI & Silent Failure: Because `changeOrderState` is undefined, the review view renders a blank/fallback state showing "$0.00" for amount, missing description, and the contradictory status message "This change order was processed." (due to `changeOrderState?.status === 'pending'` evaluating to false). If `handleAccept` or `handleDecline` are somehow triggered (e.g. if `mode: 'review'` was passed with `changeOrderId` but without `changeOrder`), lines 99 and 116 (`if (!jobId || !changeOrderState?._id) return;`) cause the handlers to silently exit without any user feedback or network action.

No defensive normalizers, fallback resolvers, or wrapper components mitigate this issue. The finding is fully verified and accurate.

#### Required Remediation
Add a useEffect hook to fetch job and change order details via getJobById(jobId) when changeOrderState is missing.

---

### 26. [MEDIUM] Automated Financial Chat Notifications Fail Due to Empty Recipient ID
- **Domain Track:** Financial Flows: Payments, Escrow, Change Orders & Quotes
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/PaymentFlowScreen.tsx:118-123`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
PaymentFlowScreen, QuoteReviewScreen, and JobDetailScreen call sendMessage(conversationId, '', messageText) with an empty recipientId string (''). Backend messagesRoutes.js validates recipientId against User and Contractor models and returns 404 'Recipient not found' when recipientId is empty.

#### Impact on Mobile Users & Parity
All automated transactional messages in chat threads fail silently with 404 errors, leaving counterparties unaware of payment confirmations, completion requests, and change orders.

#### Verification Analysis
CONFIRMED: The audit finding is accurate. 

1. Code Inspection:
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/PaymentFlowScreen.tsx` (lines 118-123), `sendMessage(quote.conversationId, '', '💳 Payment Confirmed: Escrow funds held securely in RateDeed Escrow. Work is ready to begin!')` is invoked with an empty string `''` as the `recipientId` argument.
- The same defect is present in:
  - `/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx` (lines 184-189): `sendMessage(quote.conversationId, '', '❌ Quote for ... was declined...')`
  - `/Users/tamim/Desktop/ratedeedmobile/src/screens/JobDetailScreen.tsx` (lines 225, 308-314, 359, 373, 406-411): progress photo upload notifications, milestone payment release requests, change order acceptances/rejections, and change order creations all pass `''` as `recipientId`.
  - `/Users/tamim/Desktop/ratedeedmobile/src/screens/ReviewScreen.tsx` (lines 117-122): review submission notification passes `''` as `recipientId`.

2. Backend Contract & Failure Mechanism:
- `sendMessage` in `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 907-911) sends `{ conversationId, recipientId, messageText, attachmentUrl }` via `POST /api/messages/`.
- The backend `/Users/tamim/Desktop/Ratedeed/api/backend/routes/messagesRoutes.js` (lines 76-86, 107-117) validates `recipientId` with `body('recipientId').isMongoId()`. Passing `''` fails validation immediately, returning HTTP 400 (`Invalid recipient ID.`), or if unvalidated, fails User/Contractor lookups returning HTTP 404 (`Recipient not found`).
- Because these screen calls wrap `sendMessage` in silent `try { ... } catch {}` blocks, every transactional chat notification fails silently and never appears in the conversation thread.

Severity is correctly assessed as `medium` because the primary actions (payment, quote decline, change orders) succeed via their dedicated endpoints, but the corresponding in-thread conversational audit trail and instant chat notifications fail completely.

#### Required Remediation
Pass the recipient user's ID (e.g. quote.contractor?.user || quote.user) to sendMessage calls across financial flow screens.

---

### 27. [MEDIUM] handleTyping Ignores isTyping: false Flag and Unconditionally Shows Typing Indicator
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js:523-528`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The backend server.js sends socket event typing with payload { conversationId, userId, isTyping: boolean }. In MessagesScreen.js, handleTyping receives this event but completely ignores the isTyping boolean property, unconditionally executing setIsOtherTyping(true) and scheduling a 3-second timeout even when isTyping is false. In contrast, the web message-store.ts correctly checks if (data.isTyping) state.setTyping(...) else state.clearTyping(...).

#### Impact on Mobile Users & Parity
Whenever another chat participant stops typing or sends a message (which emits an isTyping: false event), the mobile chat UI falsely displays that the user is typing for an additional 3 seconds, causing confusing typing bubble flicker and incorrect typing indicators.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/MessagesScreen.js` (lines 523–528), `handleTyping` destructures only `{ conversationId, userId: typerId }` from the socket `typing` payload, completely omitting the `isTyping` boolean sent by the backend (`server.js:584-588`).

Whenever a participant stops typing or sends a message (which emits `{ conversationId, userId, isTyping: false }`), the mobile client receives this event but unconditionally executes `setIsOtherTyping(true)` and starts a 3-second timeout (`otherTypingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), TYPING_TIMEOUT)`). Rather than dismissing the typing indicator, receiving `isTyping: false` actually activates or extends the typing indicator for 3 seconds.

In comparison, the web client in `/Users/tamim/Desktop/Ratedeed/src/lib/message-store.ts` (lines 391–401) correctly inspects `data.isTyping` and branches between `state.setTyping` and `state.clearTyping`. The finding is fully verified and valid at medium severity.

#### Required Remediation
Update handleTyping in MessagesScreen.js to check the isTyping boolean: if (isTyping) { setIsOtherTyping(true); clearTimeout(otherTypingTimeoutRef.current); otherTypingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), TYPING_TIMEOUT); } else { setIsOtherTyping(false); clearTimeout(otherTypingTimeoutRef.current); }.

---

### 28. [MEDIUM] NotificationsScreen Deep Linking Mismatches and Missing Path Handlers for Profiles and Posts
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx:301-402`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
In NotificationsScreen.tsx handleNotificationPress(), path.startsWith('/c/') and path.startsWith('/contractors/') are not handled (unlike usePushNotifications.ts which handles them). Furthermore, /contractor-edit and /contractor-onboarding are omitted, and path.startsWith('/post/') navigates contractors to ContractorDashboard initialTab 'profile' and users to Main Explore without passing the postId param.

#### Impact on Mobile Users & Parity
When users tap notifications in the in-app notification center for contractor profile reviews (/c/:slug), profile updates (/contractor-edit, /contractor-onboarding), or community posts (/post/:id), the taps either fail to navigate or lose the target item context (contractors get routed to dashboard profile tab instead of post detail, and users lose the postId param).

#### Verification Analysis
CONFIRMED: The finding is accurate and verified by inspecting `/Users/tamim/Desktop/ratedeedmobile/src/screens/NotificationsScreen.tsx` (lines 289–402), `/Users/tamim/Desktop/ratedeedmobile/src/hooks/usePushNotifications.ts` (lines 240–254), and backend route notification creators:

1. Missing `/c/` and `/contractors/` Path Handlers:
   - In backend `contractorRoutes.js` (lines 1209, 1303), notifications are created with `link: `/c/${contractor.slug || contractor._id}``.
   - `usePushNotifications.ts` (lines 240–246) explicitly handles `path.startsWith('/c/') || path.startsWith('/contractors/')` by navigating to `BusinessDetail` with `slug`.
   - In `NotificationsScreen.tsx` (lines 330–334), only `/detail/` is handled. Tapping a notification with `/c/:slug` or `/contractors/:slug` fails to match any condition and silently no-ops.

2. Missing `/contractor-edit` and `/contractor-onboarding` Handlers:
   - Backend `adminRoutes.js` (lines 2353, 2579) creates notifications with `link: '/contractor-edit'` and `link: '/contractor-onboarding'`.
   - Neither `NotificationsScreen.tsx` nor `usePushNotifications.ts` handles these paths despite `ContractorEditProfile` and `ContractorOnboarding` existing in `MainNavigator.js` (lines 415–416).

3. Inconsistent and Degraded `/post/` Handling:
   - `NotificationsScreen.tsx` (lines 335–340) routes contractors/admins to `ContractorDashboard` with `initialTab: 'profile'` and users to `navigation.navigate('Main', { screen: 'Explore' })` without passing `postId`.
   - In contrast, `usePushNotifications.ts` (lines 248–254) extracts `postId` and passes `params: { postId }` to `Main -> Explore`.

The finding is confirmed as a real medium-severity deep-linking and parity defect.

#### Required Remediation
Align NotificationsScreen.tsx handleNotificationPress() with usePushNotifications.ts: add handlers for /c/ and /contractors/ navigating to BusinessDetail with slug, handle /contractor-edit and /contractor-onboarding to ContractorEditProfile / ContractorOnboarding, and pass { postId } in navigation.navigate('Main', { screen: 'Explore', params: { postId } }).

---

### 29. [MEDIUM] Socket Reconnection on App Active State Uses Stale Auth Token and updateSocketToken Skips Disconnected Sockets
- **Domain Track:** Realtime Messaging, Sockets, Push Notifications & Deep Linking
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:546-560`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
1) In startAppStateListener (apiClient.ts:546-560), when transitioning to 'active', socket.connect() is called directly without refreshing the token via refreshTokenIfNeeded() or updating socket.auth, unlike startNetworkStatusListener (lines 572-595) which ensures token freshness. 2) In updateSocketToken (lines 882-890), if (socket.connected) { socket.disconnect().connect(); } only reconnects if the socket is already connected. If the socket was in a disconnected or errored state when the new token was received (e.g. after login), socket.connect() is never called.

#### Impact on Mobile Users & Parity
When the mobile app returns to the foreground after being suspended in the background for an extended period, or when a user logs in after socket initialization, Socket.IO reconnection can stall or churn due to stale/expired tokens in socket.auth and missing connect() invocation on disconnected sockets.

#### Verification Analysis
CONFIRMED.
Both parts of the finding are fully verified in `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts`:

1. `startAppStateListener` (lines 546-560):
When the app transitions to `active`, it checks `if (socket?.disconnected && currentSocketUserId)` and calls `socket.connect()` and `socket.emit('register', currentSocketUserId)`. Unlike `startNetworkStatusListener` (lines 572-595), it does not call `await refreshTokenIfNeeded()` or refresh `socket.auth = { token }`. If the app was suspended in the background past the JWT expiry (backend JWT tokens expire), `socket.connect()` attempts connection with the stale token stored in `socket.auth`. While `socket.on('connect_error')` handles auth error recovery, it introduces unnecessary failed connection attempts, latency, and race conditions upon foregrounding.

2. `updateSocketToken` (lines 882-890):
```ts
export const updateSocketToken = (newToken: string) => {
  if (socket) {
    socket.auth = newToken ? { token: newToken } : {};
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }
};
```
If `socket` already exists but is currently disconnected (e.g. after being disconnected in background or failed initial connect before login), `updateSocketToken` updates `socket.auth` but does not invoke `socket.connect()` because `socket.connected` is false.

Both issues represent genuine defects in socket lifecycle and reconnection state management in the mobile application.

#### Required Remediation
1) In startAppStateListener, execute an async block on active state that calls await refreshTokenIfNeeded(), updates socket.auth = { token: freshToken }, and connects. 2) In updateSocketToken, call socket.connect() if socket.disconnected to ensure disconnected sockets immediately connect with the fresh token.

---

### 30. [MEDIUM] Missing Estimate Policy & Completed Jobs Controls in Contractor Dashboard Edit Sheet
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx:879`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
When saving profile updates from `ContractorDashboardScreen.tsx`'s edit bottom sheet (`handleSaveProfile`), the `updateData` payload and UI omit `estimatePolicy` (free estimates, diagnostic service fee, waived if hired, notes) and `showCompletedJobs`, whereas `ContractorEditProfileScreen.tsx` and the Web Contractor Dashboard provide full controls.

#### Impact on Mobile Users & Parity
Contractors editing their profile from the dashboard cannot configure diagnostic fees, free estimate badges, or completed job visibility, causing configuration discrepancies between mobile and web.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx`, tapping 'Edit Profile' opens an inline bottom sheet (`Sheet visible={showEditProfile}`) with sections for banner/avatar, license verification, about us, contact/location, business hours, and services. It completely omits UI controls for `estimatePolicy` (free estimates, service fee amount, fee waived if hired, notes) and `showCompletedJobs`. Furthermore, `handleSaveProfile` (lines 868-938) constructs `updateData` without these fields. In contrast, `ContractorEditProfileScreen.tsx` in mobile and `ContractorEditProfilePage.tsx` on web have dedicated controls and payload handlers for `estimatePolicy` and `showCompletedJobs`. Contractors editing their profile via the dashboard edit sheet cannot configure these options.

#### Required Remediation
Add `estimatePolicy` and `showCompletedJobs` fields to `ContractorDashboardScreen.tsx` edit sheet and include them in the `handleSaveProfile` payload, or consolidate the dashboard edit action to navigate directly to `ContractorEditProfileScreen`.

---

### 31. [MEDIUM] Missing Authentication Prompt on Support Case Tracker for Guest Users
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/MyTicketsScreen.tsx:112`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
When an unauthenticated user opens `MyTicketsScreen`, `fetchTickets()` is skipped and `loading` is set to `false`. The screen then displays the generic empty state: 'No Support Tickets / You have no active support requests' with a '+ New Ticket' button instead of prompting the user to sign in to retrieve their cases from the authenticated endpoint `GET /api/help/my-tickets`.

#### Impact on Mobile Users & Parity
Unauthenticated users viewing the support ticket screen are told they have no tickets rather than being prompted to log in to access their cases.

#### Verification Analysis
CONFIRMED: The audit finding is accurate. 

1. Code Mechanism in `/Users/tamim/Desktop/ratedeedmobile/src/screens/MyTicketsScreen.tsx`:
- At line 72, `const { isAuthenticated } = useAuth()` is extracted.
- In `useEffect` (lines 110-116), if `!isAuthenticated`, `fetchTickets()` is skipped and `setLoading(false)` is called immediately.
- Because `tickets` is initialized to `[]`, the component drops into the empty state at lines 285–303: rendering "No Support Tickets / You have no active support requests." along with a "+ New Ticket" header button and a "Contact Support Specialists" CTA button.
- There is no `if (!isAuthenticated)` early return or auth prompt anywhere in `MyTicketsScreen.tsx`.

2. Reachability & Navigation:
- In `/Users/tamim/Desktop/ratedeedmobile/src/navigation/MainNavigator.js:436`, `MyTickets` is an unguarded stack route.
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/HelpCenterScreen.tsx:127–137`, the "My Tickets" button in the header is unconditionally available to guest users.
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContactSupportScreen.tsx:135–144`, after submitting a ticket as a guest, the success screen prompts the user to "Track Ticket in My Tickets", navigating them directly to `MyTicketsScreen`.

3. Parity & Inconsistency:
- Web counterpart (`/Users/tamim/Desktop/Ratedeed/src/app/help/my-tickets/page.tsx:149–165`) explicitly checks `if (!isAuthenticated)` and renders a dedicated "Sign In to View Support Tickets" screen with a redirect to `/login`.
- Other mobile screens (`SavedScreen.tsx:219`, `ActiveJobsScreen.tsx:136`, `ProfileScreen.tsx:516`) all feature dedicated `if (!isAuthenticated)` guest screens with a "Sign In or Create Account" CTA.

Remediation is confirmed: Add an unauthenticated state screen to `MyTicketsScreen.tsx` prompting the user to sign in to view their support cases.

#### Required Remediation
Add an unauthenticated state screen to `MyTicketsScreen.tsx` prompting the user to Sign In to view their support ticket history, matching `SavedScreen` and `ProfileScreen`.

---

## LOW Severity Issues (8)

### 32. [LOW] Non-Existent /contractors/leads Endpoints in apiClient.ts
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:1159-1170`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
apiClient.ts exports getContractorLeads calling 'GET /api/contractors/leads' and updateLeadStatus calling 'PUT /api/contractors/leads/:leadId'. Backend contractorRoutes.js has no /leads sub-route; requests to /contractors/leads match 'GET /api/contractors/:id' with req.params.id = 'leads', which fails CastError validation.

#### Impact on Mobile Users & Parity
Invoking getContractorLeads or updateLeadStatus results in a 404 or Mongoose CastError on the backend because the route does not exist.

#### Verification Analysis
CONFIRMED: The finding is technically accurate.

1. Mechanism & Verification:
- In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 1159-1170), `getContractorLeads` issues a `GET ${API_BASE}/contractors/leads` request and `updateLeadStatus` issues a `PUT ${API_BASE}/contractors/leads/${leadId}` request.
- On the backend in `/Users/tamim/Desktop/Ratedeed/api/backend/routes/contractorRoutes.js`, there are no `/leads` routes mounted:
  - `GET /api/contractors/leads` falls through earlier specific GET routes and matches the parameterized route `GET /api/contractors/:id` (line 1530) with `req.params.id = 'leads'`. `mongoose.Types.ObjectId.isValid('leads')` returns `false`, causing the route handler to return a 404 status ("Contractor not found").
  - `PUT /api/contractors/leads/:leadId` does not match any route (the only PUT route is `PUT /profile` at line 654), resulting in an Express 404 Route Not Found.

2. Severity Adjustment:
- While the defect is confirmed and calling either method in production fails with 404, there are currently zero call sites invoking `getContractorLeads` or `updateLeadStatus` across `ratedeedmobile/src/`. In `ContractorContext.tsx` (line 49), `setLeads([])` is hardcoded.
- Therefore, this is a latent/vestigial API client bug rather than an active crash in the current UI, justifying an adjustment from Medium to Low severity.

#### Required Remediation
Implement dedicated leads endpoints in backend contractorRoutes.js or update mobile apiClient.ts to use the correct quote/conversation endpoints for lead management.

---

### 33. [LOW] getTopRatedContractors zipCode Query Ignored by Backend Endpoint
- **Domain Track:** API Client, Data Normalization & Web Parity
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts:475-479`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
getTopRatedContractors in apiClient.ts sends '?zipCode=${zipCode}&limit=${limit}' to '/contractors/top-rated'. Backend contractorRoutes.js line 217 (GET /top-rated) queries Contractor.find({ status: 'Active' }) globally without filtering by the provided zipCode parameter. Localized search is only supported on GET /contractors (with zip parameter) or GET /contractors/nearby.

#### Impact on Mobile Users & Parity
Mobile top-rated contractor query passes zipCode to an endpoint that ignores location parameters, returning global rather than localized contractors.

#### Verification Analysis
CONFIRMED: The audit finding is accurate. 

1. In `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 475-479), `getTopRatedContractors` requires a `zipCode: string` parameter and issues a GET request to `${API_BASE}/contractors/top-rated?zipCode=${zipCode}&limit=${limit}`.
2. In the backend implementation `/Users/tamim/Desktop/Ratedeed/api/backend/routes/contractorRoutes.js` (lines 217-224), `GET /top-rated` only reads `req.query.limit` (`Math.min(parseInt(req.query.limit || '10', 10), 50)`). It executes `Contractor.find({ status: 'Active' })` across the entire database without inspecting or applying `req.query.zipCode` or `req.query.zip`.
3. In contrast, `/Users/tamim/Desktop/ratedeedmobile/src/utils/demoApiClient.ts` (lines 220-227) filters contractors by `matchesZip(c, zipCode)`, causing a discrepancy between demo and production behavior.
4. Furthermore, while backend `GET /contractors/nearby` handles `zip`/`zipCode`, `GET /contractors/top-rated` completely ignores location filtering.

Severity remains Low as this is an API parameter mismatch returning global top-rated results rather than location-filtered results when this helper is used.

#### Required Remediation
Update getTopRatedContractors in apiClient.ts to query '/contractors?zip=' + encodeURIComponent(zipCode) + '&sortBy=rating&limit=' + limit to ensure location-aware top-rated filtering.

---

### 34. [LOW] VerifyEmailChangeScreen discards rotated authentication tokens on verification success
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/VerifyEmailChangeScreen.tsx:31-48`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
Backend /api/users/verify-email-change increments emailChangeTokenVersion (invalidating existing tokens) and returns a new { token, socketToken, refreshToken }. VerifyEmailChangeScreen.tsx calls verifyEmailChange(token) but discards the returned tokens without calling updateBackendToken(res.token, true, res). When navigating back to Main, the mobile app continues using the revoked token.

#### Impact on Mobile Users & Parity
After successfully verifying an email change via deep link, subsequent API requests fail with 401 Unauthorized because the backend rotated token versions.

#### Verification Analysis
CONFIRMED WITH CORRECTIONS:

1. What is CONFIRMED (Code Defect & Disparity):
- In `/Users/tamim/Desktop/ratedeedmobile/src/screens/VerifyEmailChangeScreen.tsx` (lines 31-48), `verifyEmailChange(token)` is invoked upon deep-link navigation, but the response object `res` (which contains `{ token, socketToken, refreshToken, email }`) is discarded without calling `updateBackendToken(...)` from `useAuth()`.
- In contrast, the web implementation (`/Users/tamim/Desktop/Ratedeed/src/app/verify-email-change/page.tsx:32-54`) explicitly captures the returned tokens, persists them via `setStoredToken` and `setStoredRefreshToken`, and reloads the session with `useAuthStore.getState().initializeAuth()`.
- On mobile, if a user verifies their email change while logged out (or after `ProfileScreen.tsx:454` logged them out during change request), tapping "Return to App" leaves them in an unauthenticated state despite the backend having issued valid session tokens.

2. What is REFUTED (Mechanistic Claim & Consequence):
- The finding claims that incrementing `emailChangeTokenVersion` invalidates existing session tokens and causes all subsequent API requests to fail with 401 Unauthorized.
- This is factually incorrect. In `/Users/tamim/Desktop/Ratedeed/api/backend/routes/userRoutes.js:790`, the endpoint increments `user.emailChangeTokenVersion`, which is a dedicated single-use counter checked only against the email-verification JWT (`purpose: 'email-change'`).
- Active session JWTs track `user.tokenVersion` (`authMiddleware.js:40`), which is NOT bumped during `verify-email-change`. Therefore, an existing active session is not revoked and does not fail with 401.

Severity is adjusted from Medium to Low due to the absence of the claimed 401 session revocation cascade.

#### Required Remediation
Update VerifyEmailChangeScreen.tsx to extract token and refreshToken from verifyEmailChange response and call updateBackendToken(res.token, true, res) before navigating to the main app.

---

### 35. [LOW] Plaintext storage of sensitive user profile PII in unencrypted AsyncStorage instead of SecureStore
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `security`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx:41-54`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
While JWT tokens (auth_token and refresh_token) are correctly stored in expo-secure-store, user profile data (USER_DATA_KEY = 'ratedeed-user-data') is persisted in plaintext using @react-native-async-storage/async-storage in AuthContext.tsx and apiClient.ts.

#### Impact on Mobile Users & Parity
User PII (name, email, role, address) is stored unencrypted on mobile device storage, exposing sensitive user data on rooted/jailbroken devices or unencrypted device backups.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx` (lines 41-54, 83, 177, 308) and `src/utils/apiClient.ts` (lines 404, 450, 1381), `USER_DATA_KEY` ('ratedeed-user-data') is persisted in unencrypted plaintext using `@react-native-async-storage/async-storage` via `JSON.stringify(userData)`. While sensitive session tokens (`auth_token` and `refresh_token`) are properly isolated and stored in `expo-secure-store` via `setSecureItem()`, user profile PII (including name, email, role, and address fields) is stored unencrypted in AsyncStorage. On Android and iOS, AsyncStorage stores data without hardware-backed or application-level encryption (raw SQLite/plist in app sandbox), making the profile PII accessible via unencrypted device backups or rooted/jailbroken physical access. Low severity is accurate given OS sandboxing and the fact that credentials/JWTs are properly protected in SecureStore.

#### Required Remediation
Migrate USER_DATA_KEY persistence to expo-secure-store via secureStore.ts (getSecureItem / setSecureItem) or apply client-side encryption before writing user profile data to AsyncStorage.

---

### 36. [LOW] Incomplete multi-store cache cleanup on mobile logout allows cross-session state retention
- **Domain Track:** Mobile Auth, Session Lifecycle & Secure Storage
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx:138-161`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
On mobile logout, only auth_token, refresh_token, and ratedeed-user-data are deleted. Other per-user caches stored in AsyncStorage (e.g., ratedeed_favorite_ids in favoritesStore.ts, unreadNotifications in NotificationsContext.tsx) are retained. If another user signs in on the same device, the previous user's favorite IDs and notification counts persist until overwritten.

#### Impact on Mobile Users & Parity
Signing out does not clear cached favorites or notification counts, leaking previous user data into subsequent sessions on the same device.

#### Verification Analysis
Confirmed. 

1. Code Inspection:
- In `/Users/tamim/Desktop/ratedeedmobile/src/context/AuthContext.tsx` (lines 138–161) and `/Users/tamim/Desktop/ratedeedmobile/src/utils/apiClient.ts` (lines 409–420), `logout()` only removes `'auth_token'`, `'refresh_token'`, and `USER_DATA_KEY` (`'ratedeed-user-data'`).
- The persistent favorites cache stored under `FAVORITES_KEY` (`'ratedeed_favorites'`) in `/Users/tamim/Desktop/ratedeedmobile/src/utils/favoritesStore.ts` is never cleared on logout.
- In `favoritesStore.ts` (`getFavorites`, lines 46–53), when a user is unauthenticated (`token` is null, such as immediately after logout in guest mode) or when offline, the function falls back to reading `AsyncStorage.getItem('ratedeed_favorites')`. As a consequence, the previous user's saved contractors are displayed in guest mode and remain until overwritten by a new authenticated server sync.
- Additional per-user AsyncStorage keys like `unreadNotifications` (`NotificationsContext.tsx`) and `@stripe_approved_alert_shown` (`ContractorDashboardScreen.tsx`) are also left unpurged on logout. Note that while `unreadNotifications` is written by `NotificationsContext`, it is not read back via `getItem` because `NotificationsContext` resets in-memory React state on logout.

2. Verdict:
The finding is real. Severity is low because impact is confined to local device state retention (favorites leaking to guest mode/offline sessions on the shared physical device) without privilege escalation or token leakage.

#### Required Remediation
Implement a comprehensive storage purge in apiClient.ts logout() and AuthContext.tsx logout() that clears ratedeed_favorite_ids, unreadNotifications, and other user-specific AsyncStorage keys.

---

### 37. [LOW] Unpopulated User ID in BusinessDetail Online Status Listener Aborts Socket Check
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/BusinessDetailScreen.tsx:270`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
The `useEffect` for real-time online status checks `const targetUserId = contractor?.user?._id;`. When contractor data contains `contractor.user` as an ObjectId string rather than a populated User object, `contractor.user._id` evaluates to `undefined`, aborting `checkOnlineStatus` and socket status subscription.

#### Impact on Mobile Users & Parity
The contractor's real-time online badge permanently displays offline whenever contractor.user is returned as an unpopulated ObjectId string.

#### Verification Analysis
CONFIRMED: In BusinessDetailScreen.tsx (line 270), the online status listener directly accesses `contractor?.user?._id` and depends on `[contractor?.user?._id]`. When `contractor.user` is an unpopulated ObjectId string (or when only `contractor.userId` is available), `contractor?.user?._id` evaluates to `undefined`. This causes the effect to immediately abort and set `isOnline(false)`, bypassing `checkOnlineStatus` and the real-time `onUserOnlineStatus` socket subscription. Elsewhere in the same screen (e.g. lines 311, 538, 1492), defensive resolution like `extractId(c.user)` or `typeof contractor?.user === 'string'` is used, confirming that `extractId(contractor?.user) || contractor?.userId` is the intended pattern.

#### Required Remediation
Use `const targetUserId = extractId(contractor?.user);` to resolve both string IDs and populated User objects.

---

### 38. [LOW] BusinessDetail Native Share Dialog Omits Profile URL
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `parity`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/BusinessDetailScreen.tsx:302`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
`handleShare` invokes `Share.share({ message: 'Check out ' + name + ' on RateDeed!', title: name })` without appending `https://www.ratedeed.com/c/${c.slug || ''}` or passing the `url` property in `Share.share`.

#### Impact on Mobile Users & Parity
Shared messages sent via the native iOS/Android Share Sheet contain plain text with no link, preventing recipients from opening the contractor's profile.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/BusinessDetailScreen.tsx` (lines 300–304), `handleShare` directly invokes React Native's `Share.share`:

```tsx
const handleShare = async () => {
  try {
    await Share.share({
      message: `Check out ${contractor?.companyName || contractor?.businessName} on RateDeed!`,
      title: contractor?.companyName || contractor?.businessName
    });
  } catch {}
};
```

Neither the web profile URL (e.g. `https://www.ratedeed.com/c/${contractor?.slug || contractor?._id || id}`) nor any deep link is included in `message` or passed via the `url` option in `Share.share`. Consequently, on both iOS and Android, tapping the share button shares only the plain text string without a clickable link to view or contact the business profile. Adding the profile URL to `message` (and `url` for iOS) resolves this issue.

#### Required Remediation
Include `url: 'https://www.ratedeed.com/c/' + (contractor.slug || '')` and append the link to `message` in `Share.share`.

---

### 39. [LOW] Contractor Dashboard Calls Non-Existent GET /api/contractors/:id/portfolio Endpoint
- **Domain Track:** Contractor Dashboard, Help Center & Production Readiness
- **Category:** `reliability`
- **Location:** `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx:528`
- **Verification Status:** Verified (certain)

#### Defect Mechanism
`getPortfolio(cid)` executes `GET ${API_BASE_URL}/api/contractors/${id}/portfolio`. In backend `contractorRoutes.js`, no GET route exists for `/api/contractors/:id/portfolio` (portfolio items are returned directly inside the Contractor profile document). The call always returns 404.

#### Impact on Mobile Users & Parity
Generates unnecessary 404 errors on every contractor dashboard load and refresh.

#### Verification Analysis
CONFIRMED: In `/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx` (lines 527-530 & 560), `loadData()` calls `getPortfolio(cid)`, which executes `GET ${API_BASE_URL}/api/contractors/${id}/portfolio`. In backend `/Users/tamim/Desktop/Ratedeed/api/backend/routes/contractorRoutes.js`, only `POST /api/contractors/portfolio` (line 128) and `DELETE /api/contractors/portfolio/:itemId` (line 154) are defined; no `GET /api/contractors/:id/portfolio` route exists. The request always yields an HTTP 404. Although line 529 catches the rejection and returns `[]`, this causes redundant network calls and 404 log noise on every dashboard load/refresh, while `profile.portfolio` is already loaded via `getContractorProfile()`.

#### Required Remediation
Remove `getPortfolio` and rely directly on `profile.portfolio` from `getContractorProfile()`.

---
