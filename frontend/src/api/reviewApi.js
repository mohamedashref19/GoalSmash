import apiClient from "./axiosConfig";

// 1. جلب تقييمات ملعب معين
export const fetchVenueReviews = async (venueId) => {
  const response = await apiClient.get(`/venues/${venueId}/reviews`);
  return response.data.data.reviews;
};

// 2. إضافة تقييم جديد
export const submitReview = async (venueId, reviewData) => {
  try {
    const response = await apiClient.post(`/venues/${venueId}/reviews`, reviewData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إرسال التقييم";
  }
};

// +++ 3. تعديل التقييم (يستخدم الرابط المباشر للتقييم) +++
export const updateReview = async (reviewId, reviewData) => {
  try {
    const response = await apiClient.patch(`/review/${reviewId}`, reviewData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تعديل التقييم";
  }
};

// +++ 4. حذف التقييم (يستخدم الرابط المباشر للتقييم) +++
export const deleteReview = async (reviewId) => {
  try {
    const response = await apiClient.delete(`/review/${reviewId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء حذف التقييم";
  }
};
