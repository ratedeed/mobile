import { get, post, put, del, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';
import { Quote, Job, StripeConnectStatus, Earnings, QuoteLineItem } from '../types';

export const getStripeConnectUrl = async (): Promise<{ url: string }> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/stripe/connect`, authHeaders);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/stripe/status`, authHeaders);
};

export const createQuote = async (quoteData: {
  clientId: string;
  clientName: string;
  lineItems: QuoteLineItem[];
  estimatedCompletion?: string;
  notes?: string;
}): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/quotes`, quoteData, authHeaders);
};

export const getContractorQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/quotes`, authHeaders);
};

export const getClientQuotes = async (): Promise<Quote[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/quotes`, authHeaders);
};

export const getQuoteById = async (quoteId: string): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/quotes/${quoteId}`, authHeaders);
};

export const acceptQuote = async (quoteId: string): Promise<{ quote: Quote; job: Job }> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/quotes/${quoteId}/accept`, {}, authHeaders);
};

export const rejectQuote = async (quoteId: string): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/quotes/${quoteId}/reject`, {}, authHeaders);
};

export const updateQuoteStatus = async (
  quoteId: string,
  status: 'pending_user_approval' | 'accepted' | 'rejected' | 'expired'
): Promise<Quote> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/quotes/${quoteId}/status`, { status }, authHeaders);
};

export const deleteQuote = async (quoteId: string): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/quotes/${quoteId}`, authHeaders);
};

export const getContractorJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/jobs/contractor`, authHeaders);
};

export const getClientJobs = async (): Promise<Job[]> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/jobs/client`, authHeaders);
};

export const getJobById = async (jobId: string): Promise<Job> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/jobs/${jobId}`, authHeaders);
};

export const updateJobStatus = async (
  jobId: string,
  status: 'funded_in_progress' | 'completed_paid' | 'awaiting_payment' | 'cancelled' | 'disputed'
): Promise<Job> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/jobs/${jobId}/status`, { status }, authHeaders);
};

export const fundJob = async (jobId: string): Promise<Job> => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/jobs/${jobId}/fund`, {}, authHeaders);
};

export const createJobCheckoutSession = async (quoteId: string): Promise<{ url: string }> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/jobs/checkout`, { quoteId }, authHeaders);
};

export const releaseJobFunds = async (jobId: string): Promise<{ message: string; job: Job }> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/jobs/${jobId}/release`, {}, authHeaders);
};

export const completeJob = async (jobId: string, completionNotes?: string): Promise<{ message: string; job: Job }> => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/jobs/${jobId}/complete`, { completionNotes }, authHeaders);
};

export const getContractorEarnings = async (): Promise<Earnings> => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/contractors/earnings`, authHeaders);
};

// Lead functions
export const createLead = async (leadData: {
  contractorId: string;
  projectTitle: string;
  description: string;
  contactPreference?: string;
}) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/leads`, leadData, authHeaders);
};

export const getContractorLeads = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/leads`, authHeaders);
};

export const getLeadById = async (leadId: string) => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/leads/${leadId}`, authHeaders);
};

export const updateLeadStatus = async (
  leadId: string,
  status: 'new' | 'contacted' | 'quoted' | 'in_progress' | 'completed' | 'lost'
) => {
  const authHeaders = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/leads/${leadId}/status`, { status }, authHeaders);
};

export const deleteLead = async (leadId: string) => {
  const authHeaders = await getAuthHeaders();
  return del(`${API_BASE_URL}/api/leads/${leadId}`, authHeaders);
};
