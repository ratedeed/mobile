export interface MobileHelpArticle {
  slug: string;
  category: string;
  title: string;
  description: string;
  audience: 'both' | 'homeowners' | 'contractors';
  readTime: string;
  icon: string;
  summary: string;
  sections: {
    heading: string;
    body: string;
    callout?: {
      type: 'info' | 'warning' | 'success';
      text: string;
    };
  }[];
  faqs?: { q: string; a: string }[];
}

export interface MobileHelpCategory {
  slug: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  audience: 'both' | 'homeowners' | 'contractors';
}

export const HELP_CATEGORIES: MobileHelpCategory[] = [
  {
    slug: 'payments',
    title: 'Payments & Escrow',
    description: 'Milestone escrow holds, credit cards, diagnostic fees, and refund protections.',
    icon: 'credit-card',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: '#059669',
    audience: 'both',
  },
  {
    slug: 'disputes',
    title: 'Disputes & Claims',
    description: 'Evidence submission, 48h direct negotiation, and binding resolutions.',
    icon: 'balance-scale',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: '#D97706',
    audience: 'both',
  },
  {
    slug: 'trust-safety',
    title: 'Trust & Safety',
    description: 'State license audits, verified badges, and off-platform protection.',
    icon: 'shield-alt',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: '#2563EB',
    audience: 'both',
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'How Ratedeed works for homeowners, comparing quotes, and hiring pros.',
    icon: 'home',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    iconColor: '#4F46E5',
    audience: 'homeowners',
  },
  {
    slug: 'payouts',
    title: 'Contractor Payouts',
    description: 'Stripe Connect Express, bank deposits, instant transfers, and 1099 taxes.',
    icon: 'wallet',
    iconBg: 'bg-purple-50 dark:bg-purple-950/40',
    iconColor: '#7C3AED',
    audience: 'contractors',
  },
  {
    slug: 'contractor-services',
    title: 'Contractor Growth',
    description: 'Ranking in local zip codes, getting verified, and closing quotes.',
    icon: 'chart-line',
    iconBg: 'bg-teal-50 dark:bg-teal-950/40',
    iconColor: '#0D9488',
    audience: 'contractors',
  },
  {
    slug: 'jobs',
    title: 'Milestones & Jobs',
    description: 'Project contracts, digital change orders, and deliverable sign-offs.',
    icon: 'hammer',
    iconBg: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: '#EA580C',
    audience: 'both',
  },
  {
    slug: 'reviews',
    title: 'Verified Reviews',
    description: 'Tamper-proof ratings from completed escrow jobs and responses.',
    icon: 'star',
    iconBg: 'bg-yellow-50 dark:bg-yellow-950/40',
    iconColor: '#CA8A04',
    audience: 'both',
  },
  {
    slug: 'account',
    title: 'Account & Security',
    description: 'Profile settings, notifications, 2FA, and password management.',
    icon: 'user-cog',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    iconColor: '#E11D48',
    audience: 'both',
  },
];

export const HELP_ARTICLES: MobileHelpArticle[] = [
  {
    slug: 'how-ratedeed-escrow-works',
    category: 'payments',
    title: 'How Ratedeed Milestone Escrow Protects Your Money',
    description: 'Learn how funds are held in secure escrow until deliverables are inspected and approved.',
    audience: 'both',
    readTime: '3 min read',
    icon: 'shield-alt',
    summary: 'Never pay cash deposits upfront. Ratedeed locks funds in secure escrow and only disburses payment upon your explicit sign-off.',
    sections: [
      {
        heading: 'What is Milestone Escrow?',
        body: 'In traditional home improvement, contractors often demand large upfront deposits before work starts—leaving homeowners vulnerable to abandonment. On Ratedeed, 100% of project funds are placed into an encrypted escrow vault managed with Stripe.',
        callout: {
          type: 'success',
          text: 'No contractor receives direct milestone disbursement until you inspect the work on-site and tap "Release Payment".',
        },
      },
      {
        heading: 'The 4-Step Escrow Lifecycle',
        body: '1. Contractor submits itemized quote with clear phases.\n2. Homeowner funds milestone into escrow.\n3. Contractor executes work and uploads completion photos.\n4. Homeowner inspects on-site and releases payment.',
      },
      {
        heading: 'What If Something Goes Wrong?',
        body: 'If work is defective or the contractor ceases communication, you can open a dispute. Disputed escrow funds are frozen immediately while our mediation specialists review the contract.',
      },
    ],
    faqs: [
      {
        q: 'When does the contractor get the money?',
        a: 'Standard bank payouts arrive in 1-3 business days after homeowner approval. Contractors with instant payout enabled receive funds in 30 minutes.',
      },
      {
        q: 'Can a contractor withdraw without my approval?',
        a: 'No. Escrowed funds cannot be withdrawn without digital approval from the homeowner or a formal resolution from Ratedeed mediation.',
      },
    ],
  },
  {
    slug: 'diagnostic-fee-and-estimate-policy',
    category: 'payments',
    title: 'Diagnostic Fees & Free Estimates Policy',
    description: 'Understand free estimates, Roman profile badges, and credited diagnostic trip fees.',
    audience: 'both',
    readTime: '3 min read',
    icon: 'tag',
    summary: 'Every contractor displays transparent pricing badges: Free Estimates or Credited Diagnostic Fees applied 100% to your repair.',
    sections: [
      {
        heading: 'The Two Upfront Policy Badges',
        body: '1. 🌿 Free Estimates: The contractor provides 100% complimentary consultations and sizing quotes.\n2. ⚖️ Credited Diagnostic Fee ($49-$99): Covers troubleshooting and equipment testing. 100% of the diagnostic fee is credited against your repair invoice.',
        callout: {
          type: 'info',
          text: 'Example: $75 diagnostic fee + $250 repair quote = You pay $175 balance. The diagnostic visit costs $0 extra.',
        },
      },
      {
        heading: '100% No-Show Guarantee',
        body: 'If a contractor fails to arrive during your scheduled diagnostic appointment window, 100% of your dispatch fee is automatically refunded to your original card.',
      },
    ],
  },
  {
    slug: 'what-happens-during-a-dispute',
    category: 'disputes',
    title: 'What Happens During a Project Dispute',
    description: 'A complete walkthrough of dispute filing, evidence submission, and binding resolutions.',
    audience: 'both',
    readTime: '3 min read',
    icon: 'balance-scale',
    summary: 'Opening a dispute instantly freezes escrow funds, opening a 48-hour negotiation window followed by neutral platform review.',
    sections: [
      {
        heading: 'When to File a Dispute',
        body: 'File a dispute if work is abandoned, materially violates building codes, deviates from written quote specifications, or suffers unexcused delays.',
        callout: {
          type: 'warning',
          text: 'Tapping "Open Dispute" locks all funds in escrow instantly. Neither party can transfer or withdraw funds during mediation.',
        },
      },
      {
        heading: 'The 4 Resolution Steps',
        body: '1. Instant Escrow Freeze\n2. 48-Hour Direct Negotiation Window in Job Chat\n3. Evidence Review (Quotes, Photos, Inspection Reports)\n4. Binding Determination (Full Refund, Milestone Release, or Prorated Division).',
      },
    ],
  },
  {
    slug: 'license-verification-process',
    category: 'trust-safety',
    title: 'Trade License & Identity Verification',
    description: 'How Ratedeed audits state trade licenses and business registrations.',
    audience: 'both',
    readTime: '2 min read',
    icon: 'certificate',
    summary: 'The Roman Temple Verified Pro badge signifies that active state trade licenses and business standing were authenticated by compliance.',
    sections: [
      {
        heading: 'Verification Standards',
        body: 'We verify state trade licenses directly with official state licensing boards (e.g. CSLB, TDLR, DBPR) to confirm active good standing and matching trade classifications.',
      },
      {
        heading: 'Benefits for Homeowners',
        body: 'Hiring verified pros ensures code compliance, building permit eligibility, and active insurance coverage backing your project.',
      },
    ],
  },
  {
    slug: 'why-you-should-never-pay-outside-ratedeed',
    category: 'trust-safety',
    title: 'Why You Should Never Pay Outside Ratedeed',
    description: 'Protecting yourself from contractor fraud and disappearing cash deposits.',
    audience: 'both',
    readTime: '3 min read',
    icon: 'exclamation-triangle',
    summary: 'Paying via Cash, Zelle, or Venmo voids all escrow guarantees, dispute mediation, and refund protections.',
    sections: [
      {
        heading: 'The Risks of Off-Platform Cash',
        body: 'If a contractor asks for cash or direct wire, decline firmly. Off-platform payments strip away 100% of escrow and dispute safeguards.',
        callout: {
          type: 'warning',
          text: 'Soliciting off-platform payments violates Terms of Service. Report requests using the "Report Pro" button.',
        },
      },
    ],
  },
  {
    slug: 'stripe-connect-bank-payouts',
    category: 'payouts',
    title: 'Stripe Connect Bank Payouts for Pros',
    description: 'How contractors connect bank accounts, receive instant payouts, and download 1099s.',
    audience: 'contractors',
    readTime: '3 min read',
    icon: 'wallet',
    summary: 'Connect your business checking account via Stripe Express to receive automatic milestone disbursements and annual 1099 tax summaries.',
    sections: [
      {
        heading: 'Connecting Your Bank Account',
        body: 'Go to Contractor Dashboard -> Earnings -> Set Up Payout Account. Complete Stripe identity verification and link your checking account.',
      },
      {
        heading: 'Payout Timelines',
        body: 'Standard ACH payouts arrive in 1-3 business days. Instant debit transfers arrive in under 30 minutes.',
      },
    ],
  },
  {
    slug: 'project-milestones-and-change-orders',
    category: 'jobs',
    title: 'Managing Milestones & Digital Change Orders',
    description: 'How to structure contracts, approve deliverables, and issue in-app change orders.',
    audience: 'both',
    readTime: '3 min read',
    icon: 'hammer',
    summary: 'Never rely on verbal agreements. Use Ratedeed digital change orders to adjust project scope, pricing, and milestone deadlines safely.',
    sections: [
      {
        heading: 'Why Milestone Phasing Works',
        body: 'Breaking large projects into 3-5 verifiable milestones (e.g. Demolition 30%, Core Installation 40%, Final Trim 30%) ensures smooth progress and security.',
      },
      {
        heading: 'Creating an In-App Change Order',
        body: 'When hidden repairs or scope upgrades occur, the contractor creates a Change Order. The homeowner reviews and approves in 1 tap, updating the contract and escrow automatically.',
      },
    ],
  },
  {
    slug: 'how-verified-reviews-work',
    category: 'reviews',
    title: 'How Verified Customer Reviews Work',
    description: 'Authentic ratings from real escrow projects and guidelines for contractor responses.',
    audience: 'both',
    readTime: '2 min read',
    icon: 'star',
    summary: 'Only homeowners who completed and released payment for a real escrow job can post public reviews on Ratedeed.',
    sections: [
      {
        heading: 'Tamper-Proof Verification',
        body: 'No fake reviews or paid bots. Every star rating and review photo is tied to an authenticated milestone contract.',
      },
      {
        heading: 'Responding to Feedback',
        body: 'Contractors can post professional public replies from their dashboard to answer customer comments and demonstrate quality service.',
      },
    ],
  },
  {
    slug: 'managing-your-profile-and-notifications',
    category: 'account',
    title: 'Managing Your Profile, Security & Alerts',
    description: 'Updating contact details, configuring SMS alerts, and resetting passwords.',
    audience: 'both',
    readTime: '2 min read',
    icon: 'user-cog',
    summary: 'Keep your contact information up-to-date and customize real-time SMS and email notifications for active jobs.',
    sections: [
      {
        heading: 'Notification Settings',
        body: 'Configure real-time SMS, email invoices, and push alerts in Profile -> Settings -> Notifications.',
      },
      {
        heading: 'Account Security',
        body: 'Use unique passwords and never disclose SMS verification codes. Ratedeed encrypts all records with AES-256.',
      },
    ],
  },
  {
    slug: 'how-ratedeed-works-for-homeowners',
    category: 'getting-started',
    title: 'How Ratedeed Works for Homeowners',
    description: 'A complete beginner guide to finding licensed contractors, comparing upfront estimates, and paying safely with escrow.',
    audience: 'homeowners',
    readTime: '3 min read',
    icon: 'home',
    summary: 'Search verified trade professionals by ZIP code, compare transparent estimate policies, and never pay upfront cash with milestone escrow.',
    sections: [
      {
        heading: 'The Modern, Safe Way to Hire',
        body: 'Traditional hiring methods often involve unverified contractors and risky cash deposits. Ratedeed transforms home improvement with license-verified pros and 100% milestone escrow protection.',
        callout: {
          type: 'success',
          text: 'Every project is protected: contractors only get paid after you inspect and approve each milestone stage.',
        },
      },
      {
        heading: '4 Simple Steps to Complete Any Project',
        body: '1. Search verified pros in your ZIP code.\n2. Compare Roman estimate policy badges (Free Estimates vs Credited Diagnostic Fees).\n3. Chat and receive itemized digital milestone quotes.\n4. Fund escrow and release payments upon inspection.',
      },
      {
        heading: 'Types of Projects You Can Hire',
        body: 'From emergency plumbing and electrical repairs to kitchen remodels, roofing replacements, painting, and general handyman tasks.',
      },
    ],
    faqs: [
      {
        q: 'Does it cost money to post a request?',
        a: 'No. Searching contractors, chatting, and receiving project quotes is 100% free for homeowners.',
      },
      {
        q: 'What if the contractor does not show up?',
        a: 'Diagnostic and service fees booked through the platform are backed by our 100% automatic refund guarantee.',
      },
    ],
  },
  {
    slug: 'how-to-get-more-jobs-and-boost-visibility',
    category: 'contractor-services',
    title: 'How to Boost Ranking & Win More Jobs',
    description: 'Proven strategies for contractors to increase impressions, earn top local search placement, and close quotes.',
    audience: 'contractors',
    readTime: '3 min read',
    icon: 'chart-line',
    summary: 'Verify your trade license, respond fast, showcase before-and-after photo galleries, and collect verified escrow reviews to dominate local search.',
    sections: [
      {
        heading: 'How the Local Matching Algorithm Works',
        body: 'Ratedeed ranks contractor profiles based on five key signals:\n1. State Trade License Verification (Highest Weight)\n2. Fast Response Times (< 1 hour)\n3. Rich Project Photo Portfolios (6+ photos)\n4. Upfront Roman Estimate Badges\n5. 4.8+ Star Verified Escrow Reviews.',
        callout: {
          type: 'info',
          text: 'Pros with verified trade license badges convert 4x more homeowner inquiries than unverified profiles.',
        },
      },
      {
        heading: 'Actionable Optimization Steps',
        body: '• Verify your state license in Contractor Dashboard -> Edit Profile.\n• Add surrounding ZIP codes in your travel radius (25–40 miles).\n• Send itemized milestone quotes breaking down labor and materials.\n• Request 5-star verified reviews immediately upon final milestone release.',
      },
      {
        heading: 'No Pay-Per-Lead Fees',
        body: 'Unlike competitors that charge $50–$150 per shared lead phone number, Ratedeed charges zero upfront lead fees. You keep your hard-earned margins.',
      },
    ],
    faqs: [
      {
        q: 'How fast do profile updates reflect in search?',
        a: 'Updating your license, adding photos, or receiving new reviews updates your search ranking immediately in real time.',
      },
    ],
  },
  {
    slug: 'contractor-dispute-defense-guide',
    category: 'disputes',
    title: 'Contractor Guide: Responding to a Client Dispute',
    description: 'How contractors can submit milestone proof, protect earned escrow funds, and resolve claims fairly.',
    audience: 'contractors',
    readTime: '3 min read',
    icon: 'balance-scale',
    summary: 'Disputed funds stay locked in escrow while both parties communicate in the 48-hour negotiation window with platform mediation support.',
    sections: [
      {
        heading: 'What Happens During a Dispute',
        body: '1. Earned funds are NOT automatically refunded—they remain secured in escrow.\n2. You receive an instant alert with the client\'s claim details.\n3. You have a 72-hour window to review and submit job site proof.',
      },
      {
        heading: '3 Decisive Defense Best Practices',
        body: '• Upload timestamped before/after and rough-in photos.\n• Use in-app Digital Change Orders for any verbal scope additions.\n• Keep correspondence in Ratedeed Job Chat for verifiable audit logs.',
        callout: {
          type: 'warning',
          text: 'Verbal agreements outside the app cannot be authenticated during mediation. Always log scope changes via Digital Change Orders.',
        },
      },
    ],
  },
  {
    slug: 'how-ratedeed-works-for-pros',
    category: 'getting-started',
    title: 'Getting Started as a Verified Pro',
    description: 'How licensed contractors join, set up upfront estimate policies, and receive guaranteed escrow payouts.',
    audience: 'contractors',
    readTime: '3 min read',
    icon: 'user-tie',
    summary: 'Join as a verified trade contractor, configure your service area ZIP codes, and win high-ticket jobs with guaranteed escrow payments.',
    sections: [
      {
        heading: 'The Contractor Advantage',
        body: 'Ratedeed eliminates non-paying clients and expensive lead fees. Every job is funded into escrow before you lift a tool, guaranteeing that your money is secured.',
        callout: {
          type: 'success',
          text: 'Zero pay-per-lead charges. You only pay standard transaction processing fees when you successfully complete paid jobs.',
        },
      },
      {
        heading: '3 Steps to Start Winning Projects',
        body: '1. Complete your Pro Profile and upload your state trade license.\n2. Choose your estimate badge: Free Estimates or Credited Diagnostic Fee.\n3. Receive direct homeowner inquiries and send phased milestone quotes.',
      },
    ],
  },
  {
    slug: 'instant-payouts-and-1099-taxes',
    category: 'payouts',
    title: 'Instant Bank Transfers & 1099 Tax Documents',
    description: 'Understand instant debit card payouts, processing fees, and annual 1099-K tax reports.',
    audience: 'contractors',
    readTime: '2 min read',
    icon: 'file-invoice-dollar',
    summary: 'Transfer earned milestone funds to your debit card in 30 minutes, or receive standard ACH deposits with automated annual 1099 tax filing.',
    sections: [
      {
        heading: 'Instant vs Standard Payouts',
        body: '• Standard ACH: Transferred automatically to your linked checking account in 1–3 business days with $0 fee.\n• Instant Payout: Available 24/7/365 to eligible debit cards, arriving within 30 minutes for an industry-standard 1.5% fee.',
      },
      {
        heading: 'Year-End 1099-K Tax Forms',
        body: 'Stripe automatically generates and delivers your 1099-K tax document directly to your Contractor Dashboard every January for seamless tax filing.',
      },
    ],
  },
];
