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

  const refreshContractorData = async () => {
    if (!isAuthenticated || userRole !== 'contractor') return;
    
    setIsLoading(true);
    try {
      const [leadsData, quotesData, jobsData, earningsData] = await Promise.all([
        apiClient.getContractorLeads(),
        apiClient.getContractorQuotes(),
        apiClient.getContractorJobs(),
        apiClient.getContractorEarnings()
      ]);
      setLeads(leadsData);
      setQuotes(quotesData);
      setJobs(jobsData);
      setEarnings(earningsData);
    } catch (error) {
      console.error('Error fetching contractor data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userRole === 'contractor') {
      refreshContractorData();
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
