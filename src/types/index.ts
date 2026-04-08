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
}

export interface Tag {
  name?: string;
}

export interface Service {
  name: string;
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
  slug?: string;
  profilePicture?: string;
  bannerImage?: string;
  licenseDocumentUrl?: string;
  category?: string;
  contactInfo?: ContactInfo;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
  zipCodesCovered?: string[];
  zipCode?: string;
  averageRating?: number;
  numReviews?: number;
  rating?: number;
  reviews?: number;
  isVerified?: boolean;
  isSponsored?: boolean;
  isPremium?: boolean;
  tags?: Array<Tag | string>;
  servicesOffered?: Array<Service | string>;
  services?: string[];
  description?: string;
  bio?: string;
  pricing?: string;
  certifications?: string[];
  yearsInBusiness?: number;
  businessHours?: Record<string, { start: string; end: string }>;
  licenseNumber?: string;
  licenseStatus?: string;
  status?: string;
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
  status: 'awaiting_payment' | 'funded_in_progress' | 'completed_pending_release' | 'completed_paid' | 'cancelled' | 'disputed';
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
  JobDetail: { jobId: string };
  LeadDetail: { leadId: string };
};

export type UserRole = 'user' | 'contractor' | 'admin';
