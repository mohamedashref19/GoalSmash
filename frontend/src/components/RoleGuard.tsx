import { redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

// دالة مساعدة لقراءة بيانات المستخدم والتوكن من المتصفح
function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, role: null };
  try {
    // نفس منطق login.tsx: الحفظ يتم في localStorage أو sessionStorage حسب "تذكرني"
    const store = localStorage.getItem("token") ? localStorage : sessionStorage;
    const token = store.getItem("token");
    const userStr = store.getItem("userData"); // ← كان "user" وده سبب المشكلة
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, role: user?.role?.toString().toLowerCase() || null };
  } catch {
    return { token: null, role: null };
  }
}

// الصفحة الرئيسية المناسبة لكل دور (عشان نتجنب لوب التحويل)
function getHomeForRole(role: string): string {
  if (role === "admin") return "/admin-dashboard";
  if (role === "customer") return "/explore";
  return "/";
}

// 1. حارس مسارات TanStack Router (يُستخدم داخل beforeLoad)
// This helper must remain exported from this module for route guards.
// eslint-disable-next-line react-refresh/only-export-components
export function requireRole(allowedRoles: string[]) {
  if (typeof window === "undefined") return; // تخطي فحص localStorage أثناء الـ SSR

  const { token, role } = getStoredAuth();

  if (!token || !role) {
    throw redirect({ to: "/login" });
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw redirect({ to: getHomeForRole(role) });
  }
}

// 2. غلاف حماية الـ Component (يمنع ظهور الصفحة أو إرسال طلبات 401 أثناء التحميل)
export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const rolesKey = allowedRoles.join(",");

  useEffect(() => {
    const { token, role } = getStoredAuth();

    if (!token || !role) {
      navigate({ to: "/login", replace: true });
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      navigate({ to: getHomeForRole(role), replace: true });
      return;
    }

    setIsAuthorized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, navigate]);

  // عدم رسم الصفحة أو تشغيل أي useEffect بداخلها حتى يتم التأكد من الصلاحية
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
