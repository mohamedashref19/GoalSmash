import apiClient from "./axiosConfig";

export const fetchCourts = async (venueId) => {
  try {
    const response = await apiClient.get(`/courts?venue=${venueId}`);
    return response.data.data.courts;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب الملاعب";
  }
};

export const createCourt = async (courtData) => {
  try {
    const response = await apiClient.post("/courts", courtData);
    return response.data.data.court;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إضافة الملعب";
  }
};

export const updateCourt = async (courtId, courtData) => {
  try {
    const response = await apiClient.patch(`/courts/${courtId}`, courtData);
    return response.data.data.court;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تعديل الملعب";
  }
};
