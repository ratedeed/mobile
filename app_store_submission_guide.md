# App Store Submission Requirements & Guide: RateDeed

This guide provides the exact details and instructions you need to complete the required App Store Connect sections to submit **RateDeed** for review.

---

## 1. Content Rights Information (in App Information)
* **Requirement**: You must set up Content Rights Information.
* **Instruction**: App Store Connect asks if your app contains, displays, or accesses third-party content.
* **Suggested Action**: Select **"No"** (or select **"Yes, but I have the rights"** if you show any licensed elements). RateDeed is a platform for home services where users upload their own contractor images/profiles, and standard User Generated Content (UGC) is covered under the Terms of Service.

---

## 2. Privacy Policy URL (in App Privacy)
* **Requirement**: You must enter a Privacy Policy URL.
* **Suggested URL**: 
  ```text
  https://ratedeed.com/legal/privacy
  ```
  *(This is the official privacy policy link referenced in the login, registration, and signup screens of the app)*

---

## 3. Age Rating Questions (in App Information)
* **Requirement**: You must respond to the required age rating questions.
* **Instructions**: Complete the questionnaire. For each category (Violence, Fear, Sexual Content, etc.), select **"None"** or **"No"**.
* **UGC/Social Features Warning**: Because the app supports direct messaging, user photos, and contractor reviews:
  * Check **"Yes"** for questions regarding whether your app contains user-generated content or allows users to communicate.
  * Apple will likely give the app a **12+** rating (due to unrestricted web access/communication features), which is standard and expected for service-matching apps.

---

## 4. Primary & Secondary Categories (in App Information)
* **Requirement**: You must select a primary category.
* **Recommended Categories**:
  * **Primary Category**: **Lifestyle** (matches home improvement, contractor booking, and local services).
  * **Secondary Category** (Optional): **Business** (due to the contractor management, bidding, and invoices) or **Utilities**.

---

## 5. App Privacy Practices / Data Collection (in App Privacy)
* **Requirement**: An Admin must provide information about the app's privacy practices.
* **Instruction**: Click **"Get Started"** under App Privacy. Declare that the app collects the following data types:
  1. **Contact Info**: Name, Email Address, Phone Number, Physical Address (used for accounts, locating contractors, and contractor service areas).
  2. **Financial Info**: Payment Info and Transaction History (Stripe is integrated in the app for payment processing).
  3. **User Content**: Photos or Videos (used for contractor portfolios, profile pictures, and chat attachments).
  4. **Identifiers**: User ID and Device ID (used for user authentication and sending push notifications).
  5. **Diagnostics**: Crash Data and Performance Data (Sentry is integrated in the app to log performance and crash statistics).
  6. **Usage Data**: Product Interaction (used for basic usage metrics and app improvement).
* **For all data types**: Select that data is **not** used for tracking purposes and is linked to the user's identity (except for diagnostics, which can be configured as not linked).

---

## 6. Choose a Build
* **Requirement**: You must choose a build.
* **Instruction**: Once your EAS Build finishes uploading and processing:
  * Scroll down to the **Build** section in App Store Connect.
  * Click the `+` button or **"Choose a build"**.
  * Select **Build number 63** (which we just configured and incremented).
  * *Note: It may take 5–15 minutes for the build to finish processing after upload before it appears in the list.*

---

## 7. Contact Information (in App Store Review Information)
* **Requirement**: You must complete the Contact Information section.
* **Action**: Enter the contact details of the person Apple should reach out to if they have issues during review:
  * **First Name**: *(Your First Name)*
  * **Last Name**: *(Your Last Name)*
  * **Email Address**: *(Your Email)*
  * **Phone Number**: *(Your Phone, in international format e.g., +1 555-555-5555)*

---

## 8. Pricing and Availability
* **Requirement**: You must choose a price tier.
* **Recommended Action**: Select **Free** (there is no download cost for the RateDeed app, and payment transactions are handled through inside-app service fees or Stripe invoicing).

---

## 9. Version Metadata (English U.S.)
* **Requirement**: Set up description, keywords, and support URL.

### Description:
```text
Connect with trusted, verified local home service contractors with RateDeed! Whether you need a kitchen remodel, bathroom renovation, leak repair, electrical wiring, or landscaping, RateDeed makes finding the right professional simple and secure.

Features:
- Verified Contractors: Browse local professionals with verified licenses, insurance, and authentic reviews.
- Secure Escrow Payments: Pay securely through the app. Payments are held in escrow and only released once the work is completed to your satisfaction.
- Real-Time Chat & Media: Communicate directly with contractors, share photos, and track project updates in real time.
- Custom Quotes: Describe your project and get custom quotes tailored to your needs.
- Portfolios & Reviews: Explore detailed portfolios and what real clients say before hiring.

Get started today and complete your home improvement projects with peace of mind!
```

### Keywords (under 100 character limit):
```text
contractor,handyman,plumber,electrician,remodel,renovation,hvac,painter,landscape,repair,services
```

### Support URL:
```text
https://ratedeed.com
```
*(Or if you have a specific contact page, use: `https://ratedeed.com/contact`)*

### Marketing URL (Optional):
```text
https://ratedeed.com
```


### Promotional Text (Optional, max 170 characters):
```text
Hire verified local contractors for home remodels, repairs & landscaping. Pay safely with escrow protection—payments are only released when the job is done!
```
*(Alternative: "Find, hire, and pay verified local contractors securely. Protect your payments in escrow until you're satisfied with the work. Get started today!")*

---

## 10. Routing App Coverage File
* **What it is**: If your app is registered as a "Routing App" (provides turn-by-turn navigation or transit maps), Apple requires a GeoJSON `.geojson` file defining your coverage region.
* **Is this required for RateDeed?**
  * **No (Recommended)**: RateDeed is a home services matching app, not a navigation or public transit app. If Apple is asking you for this file, you likely have the **"Routing" or "Maps" capability** checked by mistake in your Xcode settings or App Store profile. 
  * **How to remove it**: Go to your Apple Developer Account or Xcode target settings, look under **Capabilities**, and uncheck **Maps / Routing**. This will remove the requirement entirely.
* **If you actually need to upload it**:
  * I have created a valid US coverage bounding box GeoJSON file for you at: [routing_coverage.geojson](file:///Users/tamim/Desktop/ratedeedmobile/routing_coverage.geojson)
  * Upload this `routing_coverage.geojson` file in the Routing App Coverage File section, and Apple will accept it as the coverage zone (Contiguous United States).



