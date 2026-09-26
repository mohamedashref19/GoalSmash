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

// +++ جلب بيانات تقفيل اليومية +++
export const fetchDailyClosing = async (date = null, venueId = "all") => {
  try {
    let url = "/admin/daily-closing";
    const params = new URLSearchParams();

    if (date) params.append("date", date);
    if (venueId && venueId !== "all") params.append("venue", venueId);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await apiClient.get(url);
    return response.data.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب تفاصيل اليومية";
  }
};

// --- دوال إدارة حسابات الدفع ---

// جلب جميع حسابات الدفع
export const fetchPaymentAccounts = async () => {
  try {
    const response = await apiClient.get("/payments/accounts");
    return response.data.data.accounts;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب حسابات الدفع";
  }
};

// إنشاء حساب دفع جديد
export const createPaymentAccount = async (accountData) => {
  try {
    const response = await apiClient.post("/payments/accounts", accountData);
    return response.data.data.account;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إنشاء حساب الدفع";
  }
};

// تفعيل/إيقاف حساب دفع
export const togglePaymentAccount = async (id) => {
  try {
    const response = await apiClient.patch(`/payments/accounts/${id}/toggle`);
    return response.data.data.account;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تغيير حالة الحساب";
  }
};
// تعديل بيانات حساب دفع
export const updatePaymentAccount = async (id, accountData) => {
  try {
    const response = await apiClient.patch(`/payments/accounts/${id}`, accountData);
    return response.data.data.account;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تعديل الحساب";
  }
};

// حذف حساب دفع
export const deletePaymentAccount = async (id) => {
  try {
    await apiClient.delete(`/payments/accounts/${id}`);
    return true;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء حذف الحساب";
  }
};

// +++ جلب سجل الإلغاءات الشامل للأدمن +++
export const fetchCancelledBookings = async () => {
  try {
    // نجلب الحجوزات الملغية ونرتبها من الأحدث للأقدم
    const response = await apiClient.get("/bookings?status=cancelled&sort=-updatedAt");
    return response.data.data.bookings;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب سجل الإلغاءات";
  }
};
