// Core interfaces matching backend models

export interface LocationData {
  zip: string;
  city: string;
  state: string;
}

export interface ContactInfo {
  city?: string;
  state?: string;
  zipCode?: string;
  zip?: string;
  phoneNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  streetAddress?: string;
}

export interface Tag {
  name?: string;
}

export interface Service {
  name: string;
  description?: string;
  priceEstimate?: string;
  priceRange?: string;
}

export interface ContractorUser {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  email: string;
  createdAt?: string;
}

export interface Contractor {
  _id: string;
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  businessName?: string;
  companyName?: string;
  name?: string;
  slug?: string;
  profilePicture?: string;
  profileImage?: string;
  bannerImage?: string;
  coverImage?: string;
  bannerUrl?: string;
  imageUrl?: string;
  licenseDocumentUrl?: string;
  category?: string;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  businessAddress?: string;
  location?: string;
  contactInfo?: ContactInfo;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
  zipCodesCovered?: string[];
  zipCodes?: string[];
  zipCode?: string;
  serviceArea?: string;
  averageRating?: number;
  numReviews?: number;
  rating?: number;
  reviews?: number;
  isVerified?: boolean;
  isSponsored?: boolean;
  isPremium?: boolean;
  distance?: number | string;
  tags?: Array<Tag | string>;
  servicesOffered?: Array<Service | string>;
  services?: string[];
  description?: string;
  bio?: string;
  pricing?: string;
  certifications?: string[];
  yearsInBusiness?: number;
  businessHours?: Record<string, any>;
  licenseNumber?: string;
  licenseStatus?: string;
  licenseDocument?: string;
  verificationNotes?: string;
  status?: string;
  onboardingComplete?: boolean;
  portfolio?: PortfolioItem[];
  posts?: Post[];
  reviewsList?: Review[];
}

export interface PortfolioItem {
  imageUrl: string;
  caption?: string;
  name?: string;
  description?: string;
  images?: string[];
}

export interface ContractorsResponse {
  contractors: Contractor[];
  page: number;
  pages: number;
  total: number;
  limit: number;
}

export interface Review {
  _id: string;
  user?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
  };
  rating: number;
  title?: string;
  comment?: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  caption: string;
  images: string[];
  likes: Array<{ _id: string } | string>;
  comments: PostComment[];
  contractor: {
    _id: string;
    user: ContractorUser;
    contactInfo?: ContactInfo;
    slug?: string;
    businessName?: string;
    companyName?: string;
  };
  createdAt: string;
}

export interface PostComment {
  _id?: string;
  user?: {
    _id?: string;
    profilePicture?: string;
    firstName?: string;
    lastName?: string;
  };
  userName?: string;
  text: string;
  createdAt?: string;
}

export interface Notification {
  _id: string;
  message: string;
  link?: string;
  read: boolean;
  type?: 'new_message' | 'new_review' | 'admin_alert' | 'system_update' | 'new_quote' | 'quote_accepted' | 'quote_rejected' | 'new_lead' | 'job_update' | 'job_funded';
  createdAt?: string;
}

export interface AuthInfo {
  _id?: string;
  id?: string;
  token?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  profilePicture?: string;
  bannerImage?: string;
  address?: string;
  zipCode?: string;
  createdAt?: string;
  companyName?: string;
}

export interface User extends AuthInfo {
  phone?: string;
  dateOfBirth?: string;
  isVerified?: boolean;
  referralCode?: string;
  referralPoints?: number;
}

export interface Category {
  name: string;
  icon: string;
  bgImage: string;
}

// Quote/Job/Lead types - matching backend models

export interface QuoteLineItem {
  description: string;
  amount?: number; // in cents (backend stores cents)
  quantity?: number;
  unitPrice?: number;
}

export type ProjectPhase = "quoted" | "accepted" | "scheduled" | "in_progress" | "completed" | "reviewed";
export type QuoteStatus = "pending" | "accepted" | "declined" | "expired" | "withdrawn" | "revised";
export type ChangeOrderStatus = "pending" | "accepted" | "declined";
export type DocType = "contract" | "permit" | "invoice" | "warranty" | "other";
export type VoiceState = "idle" | "recording" | "paused" | "sent";

export interface ProjectQuote {
  id: string;
  projectName: string;
  category: string;
  description: string;
  checkIn: string;
  estimatedDuration: string;
  laborCost: number;
  materialsCost: number;
  subtotal: number;
  platformFee: number;
  taxes: number;
  total: number;
  deposit: number;
  status: QuoteStatus;
  createdAt: number | string;
  expiresAt: number | string;
  revisions?: number;
  contractorName?: string;
  contractorAvatar?: string;
  contractorRating?: number;
  contractorReviewCount?: number;
  contractorLocation?: string;
  contractorVerified?: boolean;
  contractorMessage?: string;
}

export interface PhotoAttachment {
  id: string;
  url: string;
  caption?: string;
  label?: string;
  phase?: "before" | "during" | "after";
}

export interface DocumentAttachment {
  id: string;
  name: string;
  type: DocType;
  size: string;
  url: string;
  signed?: boolean;
}

export interface VoiceAttachment {
  id: string;
  duration: number;
  url: string;
}

export interface ChangeOrder {
  id: string;
  title: string;
  description: string;
  additionalCost: number;
  status: ChangeOrderStatus;
  originalQuoteId: string;
}

export interface MaterialItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  link?: string;
}

export interface MaterialList {
  id: string;
  title: string;
  items: MaterialItem[];
  totalCost: number;
  homeownerPurchases: boolean;
}

export interface EscrowInfo {
  status: "pending" | "deposited" | "in_escrow" | "released" | "refunded";
  amount: number;
  depositedAt?: string;
  releasedAt?: string;
  releasedTo?: string;
  waitingForApproval?: boolean;
}

export interface PaymentUpdateInfo {
  label: string;
  amount: number;
  status: "deposited" | "in_escrow" | "released" | "refunded";
}

export interface ReviewData {
  rating: number;
  text: string;
}

export interface VideoCallInfo {
  link: string;
  duration?: number;
  status: "scheduled" | "completed" | "missed";
  scheduledAt: string;
}

export interface Quote {
  _id: string;
  contractor: string | Contractor;
  user: string | User;
  description?: string;
  lineItems: QuoteLineItem[];
  subtotal: number; // Contractor payout (in cents)
  platformFee: number; // Platform profit (in cents)
  totalAmount: number; // What customer pays (in cents)
  estimatedCompletionDate?: string;
  contractorNotes?: string;
  status: 'pending_user_approval' | 'accepted' | 'rejected' | 'expired';
  isMilestone?: boolean;
  milestones?: Array<{ name: string; percentage: number; amount: number }>;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Job {
  _id: string;
  quote: string | Quote;
  contractor: string | Contractor;
  user: string | User;
  amountFunded: number;
  status: 'awaiting_payment' | 'partially_funded' | 'funded_in_progress' | 'completed_pending_release' | 'completed_paid' | 'cancelled' | 'disputed';
  isMilestone?: boolean;
  milestones?: Array<{
    _id: string;
    name: string;
    amount: number;
    status: 'pending' | 'funded' | 'released';
    stripePaymentIntentId?: string;
    stripeTransferId?: string;
  }>;
  disputeReason?: string;
  disputedMilestoneId?: string;
  stripeTransferId?: string;
  completionNotes?: string;
  completionDate?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Lead {
  _id: string;
  contractor: string | Contractor;
  user: string | User;
  projectTitle: string;
  description: string;
  contactPreference?: 'email' | 'phone' | 'message' | 'any';
  status: 'new' | 'contacted' | 'quoted' | 'in_progress' | 'completed' | 'lost';
  budget?: string;
  timeline?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Earnings {
  totalEarnings: number;
  pendingEscrow: number;
  monthlyEarnings: MonthlyEarning[];
  totalJobs?: number;
  completedJobs?: number;
  pendingJobs?: number;
  totalQuotes?: number;
  acceptedQuotes?: number;
  pendingQuotes?: number;
}

export interface MonthlyEarning {
  month: string;
  amount: number;
}

export interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

// Admin types

export interface UsersResponse {
  users: User[];
  page: number;
  pages: number;
  total: number;
}

export interface FlaggedItem {
  _id: string;
  type: 'review' | 'post';
  item: Review | Post;
  reportReason: string;
  reportedBy: string;
  createdAt: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalContractors: number;
  totalReviews: number;
  totalPosts: number;
  userGrowth: MonthlyCount[];
  contractorGrowth: MonthlyCount[];
}

export interface MonthlyCount {
  month: string;
  count: number;
}

// API Query Params

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export interface ContractorQueryParams {
  ids?: string;
  page?: number;
  limit?: number;
  search?: string;
  zip?: string;
  zipCode?: string;
  category?: string;
  type?: string;
  name?: string;
  status?: string;
  isVerified?: boolean;
  minRating?: number;
  sortBy?: string;
  isFeatured?: boolean;
}

export interface PostQueryParams {
  page?: number;
  limit?: number;
  zip?: string;
  contractor?: string;
}

// Navigation types

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Signup: undefined;
  ContractorSignup: undefined;
  Home: undefined;
  Search: undefined;
  Messages: undefined;
  Profile: undefined;
  BusinessDetail: { id: string; slug?: string };
  ContractorDashboard: undefined;
  ChatScreen: { recipientId?: string; recipientName?: string };
  Notifications: undefined;
  BusinessSearch: { query?: string; searchType?: string; category?: string };
  ReviewForm: { contractorId: string };
  EditProfile: undefined;
  Settings: undefined;
  QuoteDetail: { quoteId: string };
  QuoteReview: { quoteId: string };
  JobDetail: { jobId: string };
  LeadDetail: { leadId: string };
  ResetPassword: { oobCode?: string; token?: string };
  VerifyEmailChange: { token?: string };
};

export type UserRole = 'user' | 'contractor' | 'admin';
