import apiClient from "./axiosConfig";

// جلب إحصائيات اليوم
export const fetchTodayStats = async (venueId) => {
  try {
    const response = await apiClient.get(`/dashboard/today-stats?venue=${venueId}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب الإحصائيات";
  }
};

// جلب أفضل العملاء
export const fetchTopCustomers = async (venueId) => {
  try {
    const response = await apiClient.get(`/dashboard/top-customers?venue=${venueId}`);
    return response.data.data.topCustomers;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب العملاء";
  }
};
