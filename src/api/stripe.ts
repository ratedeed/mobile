import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { Quote, Job, StripeConnectStatus, Earnings, QuoteLineItem } from '../types';

const getAuthHeaders = async () => {
  const userInfo = JSON.parse(await AsyncStorage.getItem('userInfo') || '{}');
  return {
    'Content-Type': 'application/json',
    ...(userInfo.token ? { Authorization: `Bearer ${userInfo.token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  return data;
};

export const getStripeConnectUrl = async (): Promise<{ url: string }> => {
  const res = await fetch(`${API_BASE_URL}/api/stripe/connect`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getStripeAccountStatus = async (): Promise<StripeConnectStatus> => {
  const res = await fetch(`${API_BASE_URL}/api/stripe/status`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createQuote = async (quoteData: {
  clientId: string;
  clientName: string;
  lineItems: QuoteLineItem[];
  estimatedCompletion?: string;
  notes?: string;
}): Promise<Quote> => {
  const res = await fetch(`${API_BASE_URL}/api/quotes`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(quoteData),
  });
  return handleResponse(res);
};

export const getContractorQuotes = async (): Promise<Quote[]> => {
  const res = await fetch(`${API_BASE_URL}/api/quotes/contractor`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateQuoteStatus = async (
  quoteId: string,
  status: 'accepted' | 'rejected'
): Promise<Quote> => {
  const res = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}/status`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
};

export const getContractorJobs = async (): Promise<Job[]> => {
  const res = await fetch(`${API_BASE_URL}/api/jobs/contractor`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateJobStatus = async (
  jobId: string,
  status: 'completed_paid'
): Promise<Job> => {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
};

export const getContractorEarnings = async (): Promise<Earnings> => {
  const res = await fetch(`${API_BASE_URL}/api/contractors/earnings`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse(res);
};