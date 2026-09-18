import apiClient from "./axiosConfig";

export const fetchPlatformOverview = async () => {
  try {
    const response = await apiClient.get("/admin/overview");
    return response.data.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب إحصائيات المنصة";
  }
};

export const fetchVenuesPerformance = async () => {
  try {
    const response = await apiClient.get("/admin/venues-performance");
    return response.data.data.venuesPerformance;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب أداء الأندية";
  }
};

// +++ الدوال الجديدة لإدارة الملاك والأندية +++

export const createOwnerAccount = async (ownerData) => {
  try {
    const response = await apiClient.post("/admin/owners", ownerData);
    return response.data.data.user;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إنشاء حساب المالك";
  }
};

export const fetchAllOwners = async () => {
  try {
    const response = await apiClient.get("/admin/owners");
    return response.data.data.owners;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب قائمة الملاك";
  }
};

// هنا بنستخدم FormData لأن إنشاء النادي فيه رفع صورة
export const createVenueByAdmin = async (venueFormData) => {
  try {
    const response = await apiClient.post("/venues", venueFormData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data.venue;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إنشاء النادي";
  }
};
// +++ جلب كل الأندية عشان نختار منها وإحنا بنضيف الملعب +++
export const fetchAllVenues = async () => {
  try {
    const response = await apiClient.get("/venues");
    return response.data.data.venues;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب الأندية";
  }
};

// +++ إنشاء ملعب جديد بواسطة الأدمن +++
export const createCourtByAdmin = async (courtFormData) => {
  try {
    const response = await apiClient.post("/courts", courtFormData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data.court;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إضافة الملعب";
  }
};
// +++ جلب جميع العملاء وإحصائيات حجوزاتهم +++
export const fetchAllCustomers = async () => {
  try {
    const response = await apiClient.get("/admin/customers");
    return response.data.data.customers;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب العملاء";
  }
};

// +++ تعديل بيانات النادي (وصورته) بواسطة الإدارة +++
export const updateVenueByAdmin = async (id, formData) => {
  try {
    const response = await apiClient.patch(`/venues/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data.venue;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تحديث النادي";
  }
};

// +++ تعديل بيانات الملعب والسعر (وصورته) بواسطة الإدارة +++
export const updateCourtByAdmin = async (id, formData) => {
  try {
    // هنستخدم FormData عشان نقدر نرفع الصورة الجديدة لو المالك اختارها
    const response = await apiClient.patch(`/courts/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data.court;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تحديث الملعب";
  }
};
