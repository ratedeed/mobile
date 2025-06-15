import {
  browseContractors as apiClientBrowseContractors,
  getContractorDetails as apiClientGetContractorDetails,
  updateContractorProfile as apiClientUpdateContractorProfile,
  createPost as apiClientCreatePost,
  listPosts as apiClientListPosts,
  listContractorPosts as apiClientListContractorPosts,
  likePost as apiClientLikePost,
  commentOnPost as apiClientCommentOnPost,
  submitReview as apiClientSubmitReview,
  listContractorReviews as apiClientListContractorReviews, // Import the new function
} from '../utils/apiClient';

// This file will now act as a wrapper or a place for business logic
// that might involve multiple API calls or data transformations before
// calling the generic apiClient functions.

export const fetchContractorDetails = async (contractorId) => {
  return apiClientGetContractorDetails(contractorId);
};

export const fetchFeaturedContractors = async () => {
  return apiClientBrowseContractors({ isFeatured: true });
};

export const searchContractors = async (filters) => {
  return apiClientBrowseContractors(filters);
};

export const submitReview = async (contractorId, reviewData) => {
  return apiClientSubmitReview(contractorId, reviewData);
};

export const fetchContractorPosts = async (contractorId, queryParams = {}) => {
  return apiClientListContractorPosts(contractorId, queryParams);
};

export const fetchContractorReviews = async (contractorId, queryParams = {}) => {
  return apiClientListContractorReviews(contractorId, queryParams);
};

export const updateContractorProfile = async (profileData) => {
  // The backend route for updateContractorProfile is /api/contractors/profile (PUT)
  // It does not take contractorId as a URL param, but infers from JWT.
  return apiClientUpdateContractorProfile(profileData);
};