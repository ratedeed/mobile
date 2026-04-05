// Core interfaces matching web js/script.ts

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
  companyName: string;
  slug?: string;
  profilePicture?: string;
  bannerImage?: string;
  category?: string;
  contactInfo?: ContactInfo;
  zipCodesCovered?: string[];
  averageRating?: number;
  numReviews?: number;
  isVerified?: boolean;
  isSponsored?: boolean;
  tags?: Array<Tag | string>;
  servicesOffered?: Array<Service | string>;
  description?: string;
  pricing?: string;
  certifications?: string[];
  businessHours?: Record<string, { start: string; end: string }>;
  licenseNumber?: string;
  licenseStatus?: string;
  status?: string;
  portfolio?: PortfolioItem[];
  user?: ContractorUser;
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
  likes: string[];
  comments: PostComment[];
  contractor: {
    user: ContractorUser;
    contactInfo?: ContactInfo;
    slug?: string;
  };
  createdAt: string;
}

export interface PostComment {
  user: {
    profilePicture?: string;
    firstName?: string;
    lastName?: string;
  };
  userName: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  message: string;
  link?: string;
  read: boolean;
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

// Stripe/Payment types from js/stripe-contractor.ts

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  _id: string;
  contractorId: string;
  clientId: string;
  clientName: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  platformFee: number;
  total: number;
  status: 'pending_user_approval' | 'accepted' | 'rejected';
  estimatedCompletion?: string;
  notes?: string;
  createdAt: string;
}

export interface Job {
  _id: string;
  quoteId: string;
  clientId: string;
  contractorId: string;
  fundedAmount: number;
  status: 'funded_in_progress' | 'completed_paid' | 'awaiting_payment';
  createdAt: string;
}

export interface Lead {
  _id: string;
  contractorId: string;
  user?: ContractorUser;
  projectTitle: string;
  description: string;
  contactPreference?: string;
  createdAt: string;
}

export interface Earnings {
  totalEarnings: number;
  pendingEscrow: number;
  monthlyEarnings: MonthlyEarning[];
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
  category?: string;
  status?: string;
  isVerified?: boolean;
  minRating?: number;
  sortBy?: string;
}

export interface PostQueryParams {
  page?: number;
  limit?: number;
  zip?: string;
}

// Navigation types

export interface RootStackParamList {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Signup: undefined;
  ContractorSignup: undefined;
  Home: undefined;
  Search: undefined;
  Messages: undefined;
  Profile: undefined;
  BusinessDetail: { contractorId: string; slug?: string };
  ContractorDashboard: undefined;
  AdminDashboard: undefined;
  Chat: { recipientId: string; recipientName?: string };
  Notifications: undefined;
  BusinessSearch: { category?: string };
  ReviewForm: { contractorId: string };
  EditProfile: undefined;
  Settings: undefined;
}

export type UserRole = 'user' | 'contractor' | 'admin';
