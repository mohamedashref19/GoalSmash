import apiClient from "./axiosConfig";

// 1. جلب الحجوزات لملعب معين في تاريخ معين (عشان نقفل المواعيد المحجوزة)
export const fetchBookedSlots = async (courtId, date) => {
  try {
    const response = await apiClient.get(`/bookings?court=${courtId}&date=${date}`);
    return response.data.data.bookings;
  } catch (error) {
    console.error("Error fetching slots", error);
    return [];
  }
};

// 2. إنشاء الحجز الجديد
export const createBooking = async (bookingData) => {
  try {
    const response = await apiClient.post("/bookings", bookingData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تأكيد الحجز";
  }
};

// جلب حجوزات المستخدم الحالي
export const fetchMyBookings = async () => {
  try {
    const response = await apiClient.get("/bookings");
    return response.data.data.bookings;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب الحجوزات";
  }
};

// إلغاء الحجز
export const cancelBooking = async (id) => {
  try {
    const response = await apiClient.patch(`/bookings/${id}/cancel`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إلغاء الحجز";
  }
};
