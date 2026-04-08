import { post, get, getAuthHeaders } from '../utils/apiClient';
import { API_BASE_URL } from '../config';

/**
 * Submits a report for a contractor
 * @param {Object} reportData - Data for the report.
 * @param {string} reportData.contractorId - The ID of the contractor being reported.
 * @param {string} reportData.reason - The reason for reporting.
 * @param {string} [reportData.additionalDetails] - Optional additional details.
 * @returns {Promise<Object>} The created report object.
 */
export const submitContractorReport = async (reportData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/reports/contractor`, reportData, authHeaders);
};

/**
 * Submits a report for a post
 * @param {Object} reportData - Data for the report.
 * @param {string} reportData.postId - The ID of the post being reported.
 * @param {string} reportData.reason - The reason for reporting.
 * @param {string} [reportData.additionalDetails] - Optional additional details.
 * @returns {Promise<Object>} The created report object.
 */
export const submitPostReport = async (reportData) => {
  const authHeaders = await getAuthHeaders();
  return post(`${API_BASE_URL}/api/reports/post`, reportData, authHeaders);
};

/**
 * Gets all reports (Admin only).
 * @returns {Promise<Array>} A list of reports.
 */
export const getReports = async () => {
  const authHeaders = await getAuthHeaders();
  return get(`${API_BASE_URL}/api/reports`, authHeaders);
};
