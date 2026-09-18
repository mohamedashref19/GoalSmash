import apiClient from "./axiosConfig";

// دالة تسجيل الدخول
export const loginUser = async (phone, password) => {
  try {
    const response = await apiClient.post("/users/login", { phone, password });
    return response.data;
  } catch (error) {
    // لو الباك إند رجع خطأ، بنرميه عشان الـ Frontend يمسكه ويطلعه للعميل
    throw error.response?.data?.message || "حدث خطأ أثناء تسجيل الدخول";
  }
};

// دالة تسجيل الخروج
export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userData");
  sessionStorage.removeItem("token"); // السطر ده جديد
  sessionStorage.removeItem("userData"); // السطر ده جديد
  window.location.href = "/login"; // توجيه لصفحة الدخول
};

// دالة إنشاء حساب جديد (Signup)
export const signupUser = async (userData) => {
  try {
    const response = await apiClient.post("/users/signup", userData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إنشاء الحساب";
  }
};

// تحديث البيانات الشخصية (الاسم، الإيميل، رقم الهاتف)
export const updateUserData = async (data) => {
  try {
    // هنسمي المسار update-me وهنضيفه في الباك إند حالا
    const response = await apiClient.patch("/users/update-me", data);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تحديث البيانات";
  }
};

// تغيير كلمة المرور
export const updateUserPassword = async (data) => {
  try {
    // تم التعديل ليطابق مسار الباك إند بتاعك بالضبط
    const response = await apiClient.patch("/users/update-password", data);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء تغيير كلمة المرور";
  }
};

// طلب استرجاع كلمة المرور (إرسال OTP للإيميل)
export const forgetPassword = async (email) => {
  try {
    const response = await apiClient.post("/users/forget-password", { email });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إرسال الكود";
  }
};

// التحقق من كود الـ OTP
export const verifyUserOTP = async (email, otp) => {
  try {
    const response = await apiClient.post("/users/verify-otp", { email, otp });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "رمز التحقق غير صحيح";
  }
};

// إعادة إرسال الكود
export const resendUserOTP = async (email) => {
  try {
    const response = await apiClient.post("/users/resend-otp", { email });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إعادة الإرسال";
  }
};
// إعادة تعيين كلمة المرور الجديدة
export const resetUserPassword = async (data) => {
  try {
    const response = await apiClient.patch("/users/reset-password", data);
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "حدث خطأ أثناء إعادة التعيين";
  }
};
