import apiClient from "./axiosConfig";

export const fetchAllPayments = async (filters = {}, venueId = "") => {
  try {
    const queryObj = { ...filters };
    if (venueId) queryObj.venue = venueId;

    const queryParams = new URLSearchParams(queryObj).toString();
    const response = await apiClient.get(`/payments?${queryParams}`);
    return response.data.data.payments;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب المدفوعات";
  }
};

export const fetchUnmatchedPayments = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await apiClient.get(`/payments/unmatched?${queryParams}`);
    return response.data.data.unmatched;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء جلب المدفوعات غير المطابقة";
  }
};

export const manuallyVerifyPayment = async (id, notes = "") => {
  try {
    const response = await apiClient.patch(`/payments/${id}/verify`, { notes });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تأكيد الدفع";
  }
};

export const processUnmatchedPayment = async (id, adminNote) => {
  try {
    const response = await apiClient.patch(`/payments/unmatched/${id}/process`, { adminNote });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء معالجة التحويل";
  }
};

export const addPaymentNote = async (id, note) => {
  try {
    const response = await apiClient.patch(`/payments/${id}/note`, { note });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إضافة الملاحظة";
  }
};

// +++ الدالة اللي كانت ناقصة ورجعناها +++
export const uploadPaymentProof = async (id, formData) => {
  try {
    const response = await apiClient.patch(`/payments/${id}/proof`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء رفع الإثبات";
  }
};

export const submitPaymentProof = async (paymentId, file, transactionId, senderPhone) => {
  const formData = new FormData();
  formData.append("proofImage", file);
  if (transactionId) formData.append("manualTransactionId", transactionId);
  if (senderPhone) formData.append("senderPhone", senderPhone);

  try {
    const response = await apiClient.patch(`/payments/${paymentId}/proof`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || error.message || "حدث خطأ أثناء رفع الإثبات";
  }
};
// +++ جلب التقارير المالية للمالك (تصفية الحسابات) +++
export const fetchFinancialReports = async (startDate, endDate, venueId) => {
  try {
    const response = await apiClient.get(
      `/payments/reports?startDate=${startDate}&endDate=${endDate}&venue=${venueId}`,
    );
    return response.data.data.report;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء استخراج التقرير المالي";
  }
};
