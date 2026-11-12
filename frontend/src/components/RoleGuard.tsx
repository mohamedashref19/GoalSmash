import { redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

// دالة مساعدة لقراءة بيانات المستخدم والتوكن من المتصفح
function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, role: null };
  try {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const userStr =
      localStorage.getItem("userData") ||
      sessionStorage.getItem("userData") ||
      localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role ? String(user.role).toLowerCase().trim() : null;
    return { token, role };
  } catch {
    return { token: null, role: null };
  }
}

// الصفحة الرئيسية المناسبة لكل دور (لتوجيه كل مستخدم للوحته الصحيحة وتجنب لوب التحويل)
function getHomeForRole(role: string): string {
  if (role === "admin" || role === "super_admin") return "/admin-dashboard";
  if (role === "owner" || role === "employee") return "/";
  return "/explore";
}

// 1. حارس مسارات TanStack Router (يُستخدم داخل beforeLoad)
// eslint-disable-next-line react-refresh/only-export-components
export function requireRole(allowedRoles: string[]) {
  if (typeof window === "undefined") return; // تخطي فحص التخزين أثناء الـ SSR

  const { token, role } = getStoredAuth();

  if (!token || !role) {
    throw redirect({ to: "/login" });
  }

  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase().trim());

  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(role)) {
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
  const rolesKey = allowedRoles.map((r) => r.toLowerCase().trim()).join(",");

  useEffect(() => {
    const { token, role } = getStoredAuth();

    if (!token || !role) {
      navigate({ to: "/login", replace: true });
      return;
    }

    const normalizedAllowed = rolesKey ? rolesKey.split(",") : [];

    if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(role)) {
      navigate({ to: getHomeForRole(role), replace: true });
      return;
    }

    setIsAuthorized(true);
  }, [rolesKey, navigate]);

  // عدم رسم الصفحة أو تشغيل أي useEffect بداخلها حتى يتم التأكد من الصلاحية
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
