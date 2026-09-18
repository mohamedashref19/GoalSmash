import apiClient from "./axiosConfig";

// جلب جميع الأماكن والملاعب الرياضية
export const fetchAllVenues = async () => {
  try {
    const response = await apiClient.get("/venues");
    return response.data.data.venues;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب الملاعب";
  }
};

// جلب تفاصيل مكان محدد بالملاعب الفرعية التابعة له
export const fetchVenueById = async (id) => {
  try {
    const response = await apiClient.get(`/venues/${id}`);
    return response.data.data.venue;
  } catch (error) {
    throw error.response?.data?.message || "تعذر تحميل تفاصيل الملعب";
  }
};
