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
];
