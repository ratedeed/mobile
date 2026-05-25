import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Contractor, Job, Lead, Quote, Earnings } from '../types';
import * as apiClient from '../utils/apiClient';

interface ContractorContextType {
  contractorProfile: Contractor | null;
  jobs: Job[];
  leads: Lead[];
  quotes: Quote[];
  earnings: Earnings | null;
  isLoading: boolean;
  error: string | null;
  refreshContractorData: () => Promise<void>;
}

const ContractorContext = createContext<ContractorContextType | undefined>(undefined);

export const ContractorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { userRole, isAuthenticated } = useAuth();
  const [contractorProfile, setContractorProfile] = useState<Contractor | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshContractorData = async () => {
    if (!isAuthenticated || userRole !== 'contractor') return;
    
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        apiClient.getContractorProfile(),
        apiClient.getContractorLeads(),
        apiClient.getContractorQuotes(),
        apiClient.getContractorJobs(),
        apiClient.getContractorEarnings()
      ]);

      const [profileResult, leadsResult, quotesResult, jobsResult, earningsResult] = results;

      if (profileResult.status === 'fulfilled') {
        setContractorProfile(profileResult.value);
      } else {
        setError(profileResult.reason?.message || 'Failed to load profile');
      }
      if (leadsResult.status === 'fulfilled') setLeads(leadsResult.value);
      if (quotesResult.status === 'fulfilled') setQuotes(quotesResult.value);
      if (jobsResult.status === 'fulfilled') setJobs(jobsResult.value);
      if (earningsResult.status === 'fulfilled') setEarnings(earningsResult.value);
    } catch {
      setError('Failed to load contractor data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userRole === 'contractor') {
      refreshContractorData();
    } else {
      setContractorProfile(null);
      setJobs([]);
      setLeads([]);
      setQuotes([]);
      setEarnings(null);
      setError(null);
    }
  }, [isAuthenticated, userRole]);

  return (
    <ContractorContext.Provider
      value={{
        contractorProfile,
        jobs,
        leads,
        quotes,
        earnings,
        isLoading,
        error,
        refreshContractorData,
      }}
    >
      {children}
    </ContractorContext.Provider>
  );
};

export const useContractor = () => {
  const context = useContext(ContractorContext);
  if (context === undefined) {
    throw new Error('useContractor must be used within a ContractorProvider');
  }
  return context;
};