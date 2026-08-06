/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  demoContractors,
  demoReviews,
  demoPosts,
  demoQuotes,
  demoJobs,
  demoConversations,
  demoMessages,
  demoNotifications,
  demoEarnings,
  demoStripeStatus,
  demoContractorJobs,
  demoContractorQuotes,
  demoUser,
  demoContractorUser,
  demoContractorProfileData,
  DEMO_USER_ID,
  DEMO_CONTRACTOR_2_ID,
} from './demoData';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const hoursAgo = (n: number) => {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
};

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const reviewsByContractor: Record<string, any[]> = {};
demoContractors.forEach((c) => {
  const seed = c._id;
  const pool = demoReviews.filter((r) => !reviewsByContractor[seed] || reviewsByContractor[seed].length < 3);
  const count = 2 + (c._id.charCodeAt(c._id.length - 1) % 3);
  reviewsByContractor[seed] = pool.slice(0, count);
});

const contractorBySlug: Record<string, any> = {};
demoContractors.forEach((c) => { if (c.slug) contractorBySlug[c.slug] = c; });
const contractorById: Record<string, any> = {};
demoContractors.forEach((c) => { contractorById[c._id] = c; });

const jobById: Record<string, any> = {};
demoJobs.forEach((j) => { jobById[j._id] = j; });
demoContractorJobs.forEach((j) => { jobById[j._id] = j; });

const quoteById: Record<string, any> = {};
demoQuotes.forEach((q) => { quoteById[q._id] = q; });
demoContractorQuotes.forEach((q) => { quoteById[q._id] = q; });

let mutableJobs = clone(demoJobs);
let mutableQuotes = clone(demoQuotes);
let mutableContractorJobs = clone(demoContractorJobs);
let mutableContractorQuotes = clone(demoContractorQuotes);
let mutableNotifications = clone(demoNotifications);
let mutableMessages = clone(demoMessages);
let mutableConversations = clone(demoConversations);
let mutablePosts = clone(demoPosts);
let mutableReviews = clone(demoReviews);

const matchesZip = (c: any, zip?: string) => {
  if (!zip) return true;
  return Array.isArray(c.zipCodesCovered) && c.zipCodesCovered.includes(zip);
};

const matchesCategory = (c: any, type?: string) => {
  if (!type) return true;
  if (!c.category) return false;
  return c.category.toLowerCase() === type.toLowerCase();
};

const matchesSearch = (c: any, search?: string) => {
  if (!search) return true;
  const q = search.toLowerCase();
  const name = (c.companyName || c.businessName || '').toLowerCase();
  const desc = (c.description || '').toLowerCase();
  return name.includes(q) || desc.includes(q);
};

const paginate = (arr: any[], page = 1, limit = 30) => {
  const start = (page - 1) * limit;
  return {
    items: arr.slice(start, start + limit),
    page,
    pages: Math.max(1, Math.ceil(arr.length / limit)),
    total: arr.length,
    limit,
  };
};

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b64url = (s: string) => {
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const c1 = s.charCodeAt(i);
    const c2 = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
    const c3 = i + 2 < s.length ? s.charCodeAt(i + 2) : 0;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = ((c2 & 15) << 2) | (c3 >> 6);
    const e4 = c3 & 63;
    out += B64_CHARS[e1] + B64_CHARS[e2];
    out += i + 1 < s.length ? B64_CHARS[e3] : '';
    out += i + 2 < s.length ? B64_CHARS[e4] : '';
  }
  return out.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const buildDemoJwt = (payload: any) => {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.demo-signature-not-verified`;
};

export const generateDemoToken = (userId: string, role: 'user' | 'contractor' = 'user', email: string = demoUser.email) => {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return buildDemoJwt({ id: userId, _id: userId, role, emailVerified: true, exp, iat: Math.floor(Date.now() / 1000) });
};

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const ensureConversation = (recipientId: string) => {
  let conv = mutableConversations.find((c: any) => {
    return c.participants.some((p: any) => p._id === recipientId);
  });
  if (conv) return conv;
  const recipient = contractorById[recipientId] || { _id: recipientId, firstName: 'Unknown', lastName: 'User', profilePicture: '' };
  const newConv = {
    conversationId: newId('conv'),
    participants: [
      { _id: DEMO_USER_ID, firstName: 'Alex', lastName: 'Morgan', profilePicture: demoUser.profilePicture },
      { _id: recipientId, firstName: recipient.firstName, lastName: recipient.lastName, profilePicture: recipient.profilePicture, businessName: recipient.companyName, companyName: recipient.companyName },
    ],
    otherParticipant: { _id: recipientId, firstName: recipient.firstName, lastName: recipient.lastName, profilePicture: recipient.profilePicture, businessName: recipient.companyName, companyName: recipient.companyName },
    lastMessage: null,
    unreadCount: 0,
  };
  mutableConversations = [newConv, ...mutableConversations];
  mutableMessages[newConv.conversationId] = [];
  return newConv;
};

// ===== AUTH =====
export const demoLogin = async (email: string, password: string) => {
  await delay(600);
  if (email.includes('contractor') || email.includes('marcus')) {
    return {
      token: generateDemoToken(DEMO_CONTRACTOR_2_ID, 'contractor', email),
      refreshToken: generateDemoToken(DEMO_CONTRACTOR_2_ID, 'contractor', email),
      emailVerified: true,
      user: clone({ ...demoContractorUser, _id: DEMO_CONTRACTOR_2_ID, userId: DEMO_CONTRACTOR_2_ID }),
    };
  }
  return {
    token: generateDemoToken(DEMO_USER_ID, 'user', email || demoUser.email),
    refreshToken: generateDemoToken(DEMO_USER_ID, 'user', email || demoUser.email),
    emailVerified: true,
    user: clone(demoUser),
  };
};

export const demoLogout = async () => {
  await delay(200);
  return { success: true };
};

export const demoRegister = async (data: any) => {
  await delay(800);
  return { success: true, message: 'Account created! Please check your email to verify.' };
};

export const demoVerifyEmailBackend = async () => ({ success: true });
export const demoForgotPassword = async () => ({ success: true, message: 'Password reset email sent.' });
export const demoContractorSignup = async (_data?: any) => ({ success: true, message: 'Application received. We will be in touch within 24 hours.' });
export const demoBackendLoginFirebase = async () => demoLogin('', '');
export const demoSyncEmailVerificationStatus = async () => ({ success: true });
export const demoAppleSignIn = async () => demoLogin('', '');

// ===== CONTRACTORS =====
export const demoBrowseContractors = async (params: any = {}): Promise<any> => {
  await delay(300);
  let list = demoContractors.filter((c) => matchesZip(c, params.zip || params.zipCode));
  if (params.ids) {
    const ids = String(params.ids).split(',');
    list = demoContractors.filter((c) => ids.includes(c._id));
  }
  if (params.type || params.category) {
    list = list.filter((c) => matchesCategory(c, params.type || params.category));
  }
  if (params.search) list = list.filter((c) => matchesSearch(c, params.search));
  if (params.name) list = list.filter((c) => matchesSearch(c, params.name));
  if (params.minRating) list = list.filter((c) => (c.averageRating || 0) >= Number(params.minRating));
  if (params.isVerified !== undefined) list = list.filter((c) => Boolean(c.isVerified) === Boolean(params.isVerified));
  if (params.sortBy === 'rating') list = [...list].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

  if (list.length < 6 && !params.ids) {
    const missing = demoContractors.filter((c) => !list.find((l) => l._id === c._id));
    list = [...list, ...missing].slice(0, Math.max(list.length, 12));
  }

  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 30;
  const { items } = paginate(list, page, limit);
  return {
    contractors: items,
    page,
    pages: Math.max(1, Math.ceil(list.length / limit)),
    total: list.length,
    limit,
  };
};

export const demoGetTopRatedContractors = async (zipCode: string, limit = 6) => {
  await delay(200);
  const list = [...demoContractors]
    .filter((c) => matchesZip(c, zipCode))
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    .slice(0, limit);
  return list;
};

export const demoGetNearbyTopRatedContractors = async (zipCode: string, excludeId?: string) => {
  await delay(200);
  return demoContractors
    .filter((c) => matchesZip(c, zipCode) && c._id !== excludeId)
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    .slice(0, 6);
};

export const demoGetContractorBySlug = async (slug: string) => {
  await delay(200);
  const c = contractorBySlug[slug];
  if (!c) throw new Error('Contractor not found');
  return c;
};

export const demoGetContractorProfile = async () => {
  await delay(300);
  return clone(demoContractorProfileData);
};

export const demoGetContractorDetails = async (id: string) => {
  await delay(200);
  return contractorById[id] || clone(demoContractorProfileData);
};

export const demoUpdateContractorProfile = async (data: any) => {
  await delay(400);
  return { ...clone(demoContractorProfileData), ...data, user: { ...demoContractorProfileData.user, ...(data.user || {}) } };
};

export const demoRequestVerification = async (_data?: any) => ({ success: true, message: 'Verification request submitted.' });

export const demoAiSearchContractors = async (query: string) => {
  await delay(500);
  const q = query.toLowerCase();
  return demoContractors.filter((c) => (c.description || '').toLowerCase().includes(q) || (c.companyName || '').toLowerCase().includes(q)).slice(0, 5);
};

// ===== MESSAGING =====
export const demoFetchConversations = async () => {
  await delay(150);
  return clone(mutableConversations);
};

export const demoFetchMessages = async (conversationId: string) => {
  await delay(150);
  return clone(mutableMessages[conversationId] || []);
};

export const demoSendMessage = async (conversationId: string, recipientId: string, messageText: string) => {
  await delay(200);
  const msg = {
    _id: newId('m'),
    conversationId,
    senderId: DEMO_USER_ID,
    recipientId,
    messageText,
    createdAt: new Date().toISOString(),
  };
  if (!mutableMessages[conversationId]) mutableMessages[conversationId] = [];
  mutableMessages[conversationId] = [...mutableMessages[conversationId], msg];

  const conv = mutableConversations.find((c: any) => c.conversationId === conversationId);
  if (conv) {
    conv.lastMessage = { messageText, createdAt: msg.createdAt, senderId: DEMO_USER_ID };
    conv.unreadCount = 0;
  }

  setTimeout(() => {
    const replies = [
      'Got it, thanks!',
      'Sounds good — I\'ll take a look and get back to you shortly.',
      'Great, I have that on my schedule for tomorrow.',
      'I appreciate the message. Let me check with my team and respond soon.',
      'Perfect, see you then!',
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    const replyMsg = {
      _id: newId('m'),
      conversationId,
      senderId: recipientId,
      recipientId: DEMO_USER_ID,
      messageText: reply,
      createdAt: new Date().toISOString(),
    };
    mutableMessages[conversationId] = [...mutableMessages[conversationId], replyMsg];
    if (conv) {
      conv.lastMessage = { messageText: reply, createdAt: replyMsg.createdAt, senderId: recipientId };
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }
  }, 2500);

  return msg;
};

export const demoFindOrCreateConversation = async (participantIds: string[]) => {
  await delay(150);
  const recipient = participantIds.find((id) => id !== DEMO_USER_ID);
  if (recipient) return ensureConversation(recipient);
  return mutableConversations[0];
};

export const demoMarkConversationAsRead = async (conversationId: string) => {
  await delay(100);
  const conv = mutableConversations.find((c: any) => c.conversationId === conversationId);
  if (conv) conv.unreadCount = 0;
};

export const demoDeleteConversation = async (conversationId: string) => {
  await delay(150);
  mutableConversations = mutableConversations.filter((c: any) => c.conversationId !== conversationId);
  delete mutableMessages[conversationId];
  return { success: true };
};

export const demoCreateQuoteFromChat = async (data: any) => {
  await delay(300);
  const q = { _id: newId('quote'), ...data, status: 'pending_user_approval', createdAt: new Date().toISOString() };
  mutableQuotes = [q, ...mutableQuotes];
  return q;
};

// ===== POSTS & REVIEWS =====
export const demoListPosts = async (params: any = {}) => {
  await delay(200);
  return { posts: clone(mutablePosts).filter((p: any) => !params.contractor || p.contractor._id === params.contractor) };
};

export const demoFetchContractorPosts = async (contractorId: string) => {
  await delay(150);
  return { posts: clone(mutablePosts).filter((p: any) => p.contractor._id === contractorId) };
};

export const demoCreatePost = async (data: any) => {
  await delay(400);
  const post = {
    _id: newId('post'),
    ...data,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    contractor: { _id: DEMO_CONTRACTOR_2_ID, user: demoContractorProfileData.user, contactInfo: demoContractorProfileData.contactInfo, slug: demoContractorProfileData.slug, businessName: demoContractorProfileData.companyName, companyName: demoContractorProfileData.companyName },
  };
  mutablePosts = [post, ...mutablePosts];
  return post;
};

export const demoLikePost = async (postId: string) => {
  await delay(100);
  mutablePosts = mutablePosts.map((p: any) => p._id === postId ? { ...p, likes: [...(p.likes || []), DEMO_USER_ID] } : p);
};
export const demoUnlikePost = async (postId: string) => {
  await delay(100);
  mutablePosts = mutablePosts.map((p: any) => p._id === postId ? { ...p, likes: (p.likes || []).filter((id: any) => id !== DEMO_USER_ID) } : p);
};
export const demoCommentOnPost = async (postId: string, data: any) => {
  await delay(150);
  const c = { _id: newId('c'), user: { _id: DEMO_USER_ID, firstName: 'Alex', lastName: 'Morgan', profilePicture: demoUser.profilePicture }, userName: 'Alex M.', text: data.text, createdAt: new Date().toISOString() };
  mutablePosts = mutablePosts.map((p: any) => p._id === postId ? { ...p, comments: [...(p.comments || []), c] } : p);
  return c;
};
export const demoDeletePost = async (postId: string) => {
  await delay(150);
  mutablePosts = mutablePosts.filter((p: any) => p._id !== postId);
};

export const demoFetchContractorReviews = async (contractorId: string) => {
  await delay(150);
  return clone(mutableReviews).slice(0, 12);
};

export const demoSubmitReview = async (contractorId: string, data: any) => {
  await delay(400);
  const r = {
    _id: newId('r'),
    user: { _id: DEMO_USER_ID, firstName: 'Alex', lastName: 'Morgan', profilePicture: demoUser.profilePicture },
    rating: data.rating || 5,
    title: data.title || 'Great experience!',
    comment: data.comment || data.text || '',
    createdAt: new Date().toISOString(),
  };
  mutableReviews = [r, ...mutableReviews];
  return r;
};

export const demoRespondToReview = async (_reviewId?: string, _reply?: string) => ({ success: true });

// ===== NOTIFICATIONS =====
export const demoGetNotifications = async () => {
  await delay(150);
  return clone(mutableNotifications);
};
export const demoMarkNotificationRead = async (id: string) => {
  await delay(80);
  mutableNotifications = mutableNotifications.map((n: any) => n._id === id ? { ...n, read: true } : n);
};
export const demoMarkAllNotificationsRead = async () => {
  await delay(120);
  mutableNotifications = mutableNotifications.map((n: any) => ({ ...n, read: true }));
};
export const demoMarkNotificationUnread = async (id: string) => {
  await delay(80);
  mutableNotifications = mutableNotifications.map((n: any) => n._id === id ? { ...n, read: false } : n);
};
export const demoDeleteNotification = async (id: string) => {
  await delay(100);
  mutableNotifications = mutableNotifications.filter((n: any) => n._id !== id);
};

// ===== USER =====
export const demoGetUserProfile = async () => {
  await delay(200);
  return clone(demoUser);
};
export const demoUpdateUserProfile = async (data: any) => ({ ...clone(demoUser), ...data });
export const demoSavePushToken = async () => ({ success: true });
export const demoUpdateProfilePicture = async (pictureUrl: string) => ({ ...clone(demoUser), profilePicture: pictureUrl });
export const demoUpdateBannerImage = async (imageUrl: string) => ({ ...clone(demoUser), bannerImage: imageUrl });

// ===== STRIPE & PAYMENTS =====
export const demoGetStripeConnectUrl = async () => ({ url: 'https://connect.stripe.com/demo/setup' });
export const demoGetStripeAccountStatus = async () => clone(demoStripeStatus);

export const demoCreateCheckoutSession = async (quoteId: string, _milestoneId?: string) => {
  await delay(300);
  return { url: `demo://checkout/${quoteId}` };
};

export const demoCreatePaymentIntent = async (quoteId: string, milestoneId?: string) => {
  await delay(300);
  const q = quoteById[quoteId];
  const baseAmount = q ? q.totalAmount : 250000;
  const processingFee = Math.round(baseAmount * 0.029) + 30;
  return {
    clientSecret: `pi_demo_${newId('pi')}_secret_demo`,
    amount: baseAmount + processingFee,
  };
};

export const demoGetPlatformFeePercent = async () => ({ platformFeePercent: 10 });

export const demoReleaseFunds = async (jobId: string, milestoneId?: string) => {
  await delay(500);
  mutableJobs = mutableJobs.map((j: any) => {
    if (j._id !== jobId) return j;
    if (milestoneId && j.milestones) {
      const updated = { ...j, milestones: j.milestones.map((m: any) => m._id === milestoneId ? { ...m, status: 'released' } : m) };
      const allReleased = updated.milestones.every((m: any) => m.status === 'released');
      if (allReleased) updated.status = 'completed_paid';
      return updated;
    }
    return { ...j, status: 'completed_paid' };
  });
  return { success: true, message: 'Funds released successfully' };
};

export const demoMarkJobComplete = async (jobId: string, _completionNotes?: string) => {
  await delay(400);
  mutableJobs = mutableJobs.map((j: any) => j._id === jobId ? { ...j, status: 'completed_pending_release' } : j);
  return { success: true };
};

export const demoRaiseDispute = async (_jobId?: string, _reason?: string, _milestoneId?: string, _evidence?: string[]) => ({ success: true, message: 'Dispute filed. Our team will review within 24 hours.' });
export const demoCancelJob = async (_jobId?: string, _reason?: string) => ({ success: true });
export const demoRefundJob = async (_jobId?: string, _amount?: number, _reason?: string) => ({ success: true });
export const demoCreateChangeOrder = async (_jobId?: string, _data?: any) => ({ success: true, changeOrder: { _id: newId('co') } });
export const demoAcceptChangeOrder = async (_jobId?: string, _changeOrderId?: string) => ({ success: true });
export const demoDeclineChangeOrder = async (_jobId?: string, _changeOrderId?: string) => ({ success: true });
export const demoResolveDispute = async () => ({ success: true });
export const demoCancelDispute = async () => ({ success: true });
export const demoGetContractorEarnings = async () => clone(demoEarnings);
export const demoRequestPayout = async (amount?: number) => ({ success: true, amount, message: `Payout of $${(amount || 5000) / 100} requested.` });
export const demoUploadProgressPhoto = async () => ({ success: true });
export const demoSubmitClaim = async () => ({ success: true, message: 'Claim submitted successfully.' });
export const demoReportConversation = async () => ({ success: true, message: 'Report submitted. Our team will review.' });

// ===== QUOTES =====
export const demoCreateQuote = async (data: any) => {
  await delay(400);
  const q = { _id: newId('quote'), ...data, status: 'pending_user_approval', createdAt: new Date().toISOString() };
  mutableContractorQuotes = [q, ...mutableContractorQuotes];
  return q;
};

export const demoGetContractorQuotes = async () => {
  await delay(150);
  return clone(mutableContractorQuotes);
};

export const demoGetUserQuotes = async () => {
  await delay(150);
  return clone(mutableQuotes);
};

export const demoGetQuote = async (quoteId: string) => {
  await delay(150);
  return quoteById[quoteId] || mutableQuotes[0] || mutableContractorQuotes[0];
};

export const demoUpdateQuoteStatus = async (quoteId: string, status: 'accepted' | 'rejected') => {
  await delay(200);
  mutableQuotes = mutableQuotes.map((q: any) => q._id === quoteId ? { ...q, status } : q);
  mutableContractorQuotes = mutableContractorQuotes.map((q: any) => q._id === quoteId ? { ...q, status } : q);
  if (quoteById[quoteId]) quoteById[quoteId].status = status;
  return { success: true, status };
};

// ===== JOBS =====
export const demoGetContractorJobs = async () => {
  await delay(150);
  return clone(mutableContractorJobs);
};

export const demoGetUserJobs = async () => {
  await delay(150);
  return clone(mutableJobs);
};

export const demoGetJobById = async (jobId: string) => {
  await delay(150);
  return jobById[jobId] || mutableJobs[0] || mutableContractorJobs[0];
};

export const demoGetContractorLeads = async (): Promise<any[]> => [
  { _id: 'lead-1', contractor: DEMO_CONTRACTOR_2_ID, user: { _id: 'u-lead-1', firstName: 'Hannah', lastName: 'Wong', profilePicture: '' }, projectTitle: 'Bathroom fan replacement', description: 'Master bathroom exhaust fan stopped working', status: 'new', budget: '$200-500', timeline: 'This week', createdAt: hoursAgo(8) },
  { _id: 'lead-2', contractor: DEMO_CONTRACTOR_2_ID, user: { _id: 'u-lead-2', firstName: 'Steve', lastName: 'Patel', profilePicture: '' }, projectTitle: 'Garage shelving install', description: 'Need 16 ft of heavy-duty shelving installed', status: 'contacted', budget: '$300-800', timeline: 'Next 2 weeks', createdAt: hoursAgo(36) },
  { _id: 'lead-3', contractor: DEMO_CONTRACTOR_2_ID, user: { _id: 'u-lead-3', firstName: 'Anna', lastName: 'Rivera', profilePicture: '' }, projectTitle: 'Doorbell camera install', description: 'Need a smart doorbell installed and wired', status: 'quoted', budget: '$150-400', timeline: 'Flexible', createdAt: daysAgo(2) },
  { _id: 'lead-4', contractor: DEMO_CONTRACTOR_2_ID, user: { _id: 'u-lead-4', firstName: 'David', lastName: 'Chen', profilePicture: '' }, projectTitle: 'Fence repair after storm', description: 'Two sections of fence blown down, need replacement', status: 'new', budget: '$800-2000', timeline: 'Within 2 weeks', createdAt: daysAgo(1) },
];

export const demoUpdateLeadStatus = async (_leadId?: string, _status?: string) => ({ success: true });

// ===== ADMIN =====
export const demoGetAllUsers = async (_params?: any) => ({
  users: [
    clone(demoUser),
    clone(demoContractorUser),
    ...Array.from({ length: 8 }).map((_, i) => ({
      _id: `u-admin-${i}`,
      firstName: ['Olivia', 'Liam', 'Ava', 'Noah', 'Emma', 'Oliver', 'Sophia', 'James'][i],
      lastName: ['Brown', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez'][i],
      email: `user${i}@demo.ratedeed.com`,
      role: i % 3 === 0 ? 'contractor' : 'user',
      profilePicture: `https://i.pravatar.cc/200?img=${i + 30}`,
      createdAt: daysAgo(30 + i * 15),
    })),
  ],
  page: 1,
  pages: 1,
  total: 10,
  limit: 50,
});

export const demoGetAllContractors = async (_params?: any) => ({
  contractors: clone(demoContractors),
  page: 1,
  pages: 1,
  total: demoContractors.length,
  limit: 50,
});

export const demoGetPlatformStats = async () => ({
  totalUsers: 12480,
  totalContractors: 3120,
  totalReviews: 28430,
  totalPosts: 5210,
  userGrowth: Array.from({ length: 6 }).map((_, i) => ({ month: `2026-${String(i + 2).padStart(2, '0')}`, count: 1200 + i * 380 })),
  contractorGrowth: Array.from({ length: 6 }).map((_, i) => ({ month: `2026-${String(i + 2).padStart(2, '0')}`, count: 180 + i * 65 })),
});

export const demoGetCloudinarySignature = async (_folder?: string) => ({
  signature: 'demo-signature',
  timestamp: Math.floor(Date.now() / 1000),
  apiKey: 'demo-key',
  cloudName: 'demo-cloud',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
});

// ===== MISC =====
export const demoChangePassword = async () => ({ success: true });
export const demoDeleteAccount = async () => ({ success: true });
export const demoResetPassword = async () => ({ success: true });
export const demoVerifyEmailChange = async () => ({ success: true });
export const demoRequestEmailChange = async () => ({ success: true });
export const demoBlockUser = async () => ({ success: true });
export const demoUnblockUser = async () => ({ success: true });
export const demoGetBlockedUsers = async () => [];
