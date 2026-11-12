import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Facebook,
  Instagram,
  MessageCircle,
  X,
  Home,
  CalendarDays,
  LogOut,
  LayoutDashboard,
  Wallet,
  ClipboardList,
  FileText,
  Settings,
  XCircle,
  Trash2,
  ShieldAlert,
  FileLock2,
  Pencil,
  ReceiptText,
  Trophy,
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { updateUserData, updateUserPassword, logoutUser, deleteUserAccount } from "@/api/authApi";
import { MobileSidebar } from "@/components/venue/Sidebar";
import { requireRole, RoleGuard } from "../components/RoleGuard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "الملف الشخصي | Tigi-Hagz" }],
  }),
  beforeLoad: () => requireRole([]),
  component: () => (
    <RoleGuard allowedRoles={[]}>
      <ProfilePage />
    </RoleGuard>
  ),
});

const roundedField =
  "mt-1.5 w-full rounded-2xl border border-border bg-background/60 py-3 px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const roundedPasswordField =
  "w-full rounded-2xl border border-border bg-background/60 py-3 pr-10 pl-10 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

// =========================================
// +++ مكونات القوائم الجانبية +++
// =========================================
function AdminMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")} dir="rtl">
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-card p-5 shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-primary">
            Tigi-Hagz (الإدارة)
          </span>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2 overflow-y-auto max-h-[75vh] pb-4">
          <Link
            to="/admin-dashboard"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <LayoutDashboard className="h-5 w-5" /> لوحة القيادة
          </Link>
          <Link
            to="/admin-payments"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <Wallet className="h-5 w-5" /> المدفوعات المركزية
          </Link>
          <Link
            to="/admin-daily-closing"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <ClipboardList className="h-5 w-5" /> تقفيل اليومية
          </Link>
          <Link
            to="/admin-reports"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <FileText className="h-5 w-5" /> تقارير المنصة
          </Link>
          <Link
            to="/admin-cancellations"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-destructive/10 hover:text-destructive [&.active]:bg-destructive/10 [&.active]:text-destructive text-muted-foreground"
          >
            <XCircle className="h-5 w-5" /> سجل الإلغاءات
          </Link>
          <Link
            to="/admin-setup"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <Settings className="h-5 w-5" /> إعدادات النظام
          </Link>
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <User className="h-5 w-5" /> الملف الشخصي
          </Link>
        </nav>
      </div>
    </div>
  );
}

function CustomerMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")} dir="rtl">
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-card p-5 shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-primary">Tigi-Hagz</span>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            to="/explore"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary"
          >
            <Home className="h-5 w-5" /> الرئيسية
          </Link>
          <Link
            to="/my-bookings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary"
          >
            <CalendarDays className="h-5 w-5" /> حجوزاتي
          </Link>
          <Link
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary"
          >
            <User className="h-5 w-5" /> الملف الشخصي
          </Link>
        </nav>
      </div>
    </div>
  );
}

const TiktokIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 448 512"
    className={className}
    fill="currentColor"
  >
    <path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14Z" />
  </svg>
);

// =========================================
// +++ مكون التحذير لحذف الحساب +++
// =========================================
function DeleteAccountModal({
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-sm rounded-3xl border border-destructive/30 shadow-2xl p-6 animate-in fade-in zoom-in-95 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-extrabold text-foreground mb-2">تأكيد حذف الحساب!</h3>
        <p className="text-sm font-bold text-muted-foreground mb-4">
          هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟
        </p>
        <div className="bg-destructive/5 rounded-xl p-4 text-xs text-right space-y-3 border border-destructive/20 mb-6">
          <p className="flex gap-2 items-start font-semibold text-destructive/90">
            <span className="font-black shrink-0 mt-0.5">•</span>
            <span>
              سيتم حذف جميع بياناتك الشخصية وحجوزاتك بشكل نهائي من النظام ولن يمكن التراجع عن هذه
              الخطوة.
            </span>
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted/80 disabled:opacity-50"
          >
            تراجع
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting ? "جاري الحذف..." : "حذف نهائي"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [rawRole, setRawRole] = useState("");

  // حالة فتح وإغلاق وضع التعديل عند الضغط على علامة القلم
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setOriginalName(user.name || "");
        setPhone(user.phone || "");
        setEmail(user.email || "");
        setRawRole(user.role || "customer");
        // +++ تحويل كلمة "عميل" إلى "لاعب" +++
        setRoleLabel(
          user.role === "customer"
            ? "لاعب"
            : user.role === "owner" || user.role === "employee"
              ? "مالك / مدير ملعب"
              : "مدير النظام",
        );
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    } else {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  // دالة حفظ موحدة تحفظ الاسم و/أو كلمة المرور عند الضغط على "حفظ التعديلات"
  const handleSaveAll = async (e: FormEvent) => {
    e.preventDefault();

    const isNameChanged = name.trim() !== "" && name.trim() !== originalName;
    const isPasswordFilled =
      currentPassword.trim() !== "" || newPassword.trim() !== "" || confirmPassword.trim() !== "";

    if (!isNameChanged && !isPasswordFilled) {
      setIsEditing(false);
      return;
    }

    if (isPasswordFilled) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error("يرجى ملء جميع حقول كلمة المرور لتغييرها.");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("كلمتا المرور غير متطابقتين.");
        return;
      }
    }

    setSaving(true);
    try {
      if (isNameChanged) {
        const res = await updateUserData({ name: name.trim(), email });
        const storage = localStorage.getItem("token") ? localStorage : sessionStorage;
        storage.setItem("userData", JSON.stringify(res.data.user));
        setOriginalName(name.trim());
      }

      if (isPasswordFilled) {
        await updateUserPassword({
          passwordCurrent: currentPassword,
          password: newPassword,
          passwordConfirm: confirmPassword,
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      toast.success("تم حفظ التعديلات بنجاح");
      setIsEditing(false);
    } catch (err) {
      toast.error(err as string);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      toast.success("تم حذف حسابك نهائياً.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate({ to: "/login" });
  };

  const isAdmin = rawRole === "admin" || rawRole === "super_admin";
  const isOwner = rawRole === "owner" || rawRole === "employee";

  return (
    <div
      dir="rtl"
      className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground"
    >
      {isAdmin && (
        <AdminMobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      )}

      {isOwner && (
        <MobileSidebar
          open={isMobileMenuOpen}
          activeView="overview"
          onNavigate={(view) => {
            localStorage.setItem("ownerActiveTab", view);
            window.location.href = "/";
          }}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}
      {!isAdmin && !isOwner && (
        <CustomerMobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      )}

      <Header title="الملف الشخصي" onMenu={() => setIsMobileMenuOpen(true)} />

      <main className="mx-auto w-full max-w-md flex-1 p-4 sm:p-6 pb-24 flex flex-col justify-center">
        {/* ======================================================= */}
        {/* 1. وضع العرض الأساسي (الاسم + الرقم + القلم + الأزرار) */}
        {/* ======================================================= */}
        {!isEditing ? (
          <div className="card-surface relative rounded-3xl border border-border/80 p-6 sm:p-8 shadow-xl animate-in fade-in zoom-in-95">
            {/* زر القلم في الزاوية لفتح التعديل والبيانات الكاملة وتسجيل الخروج */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="تعديل البيانات وإعدادات الحساب"
              className="absolute left-5 top-5 rounded-xl p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="size-5" />
            </button>

            {/* الصورة الرمزية ومعلومات المستخدم */}
            <div className="flex flex-col items-center text-center mt-2">
              <div className="grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-inner">
                <User className="size-9" />
              </div>

              <h2 className="mt-4 font-display text-2xl font-extrabold text-primary">
                {name || "لاعب"}
              </h2>

              <p className="mt-1.5 text-sm font-bold tracking-wide text-muted-foreground" dir="ltr">
                {phone || "---"}
              </p>

              <span className="mt-3 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-extrabold text-primary">
                {roleLabel}
              </span>
            </div>

            {/* أزرار التنقل الرئيسية داخل الكارت */}
            <div className="mt-8 flex flex-col gap-3">
              {isAdmin && (
                <Link
                  to="/admin-dashboard"
                  className="gradient-primary flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:opacity-95"
                >
                  <span>لوحة الإدارة</span>
                  <LayoutDashboard className="size-5" />
                </Link>
              )}

              {isOwner && (
                <Link
                  to="/"
                  className="gradient-primary flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:opacity-95"
                >
                  <span>لوحة إدارة الملعب</span>
                  <LayoutDashboard className="size-5" />
                </Link>
              )}

              {!isAdmin && !isOwner && (
                <>
                  <Link
                    to="/explore"
                    className="gradient-primary flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:opacity-95"
                  >
                    <span>تصفح الملاعب</span>
                    <Home className="size-5" />
                  </Link>

                  <Link
                    to="/my-bookings"
                    className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-5 py-3.5 text-sm font-extrabold text-foreground transition hover:bg-muted"
                  >
                    <span>حجوزاتي</span>
                    <ReceiptText className="size-5 text-muted-foreground" />
                  </Link>

                  {/* +++ زر إحصائيات اللاعب (معطل حالياً + بادج قريباً) +++ */}
                  <div className="relative mt-1">
                    <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-warning px-2.5 py-0.5 text-[10px] font-black text-warning-foreground shadow-sm border border-warning/40">
                      قريباً 🔥
                    </span>
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-2xl border border-dashed border-primary/30 bg-muted/40 px-5 py-3 text-right opacity-75 select-none"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-foreground">
                          فورمتي وأرقامي ⚽
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
                          أهدافك · أسيستاتك · كارت الحريفة
                        </span>
                      </div>
                      <Trophy className="size-5 text-warning shrink-0" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================= */
          /* 2. وضع التعديل الكامل (عند الضغط على علامة القلم)        */
          /* ======================================================= */
          <div className="card-surface relative rounded-3xl border border-border/80 p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95">
            {/* زر الإغلاق (X) للعودة للكارت المصغر */}
            <button
              type="button"
              onClick={() => {
                setName(originalName);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setIsEditing(false);
              }}
              title="إغلاق"
              className="absolute left-5 top-5 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <User className="size-8" />
              </div>
            </div>

            <form onSubmit={handleSaveAll} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-muted-foreground">الاسم</label>
                <input
                  className={roundedField}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-muted-foreground">
                  رقم الهاتف (غير قابل للتعديل)
                </label>
                <input
                  className={cn(
                    roundedField,
                    "cursor-not-allowed bg-muted/50 text-muted-foreground",
                  )}
                  value={phone}
                  disabled
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-muted-foreground">
                  البريد الإلكتروني (غير قابل للتعديل)
                </label>
                <input
                  className={cn(
                    roundedField,
                    "cursor-not-allowed bg-muted/50 text-muted-foreground",
                  )}
                  type="email"
                  value={email}
                  disabled
                  dir="ltr"
                />
              </div>

              {/* قسم تغيير كلمة المرور */}
              <div className="border-t border-border pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-primary">تغيير كلمة المرور</h3>
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="size-3.5" /> إخفاء
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> إظهار
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={roundedPasswordField}
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="كلمة المرور الحالية"
                    autoComplete="current-password"
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={roundedPasswordField}
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="كلمة المرور الجديدة"
                    autoComplete="new-password"
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={cn(
                      roundedPasswordField,
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-destructive focus:border-destructive"
                        : "",
                    )}
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تأكيد كلمة المرور الجديدة"
                    autoComplete="new-password"
                  />
                </div>

                {confirmPassword && confirmPassword !== newPassword && (
                  <span className="block text-xs font-bold text-destructive">
                    كلمتا المرور غير متطابقتين
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="gradient-primary w-full rounded-2xl py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50 mt-2"
              >
                {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            </form>

            {/* خيارات الخصوصية وتسجيل الخروج وحذف الحساب داخل نافذة التعديل فقط */}
            <div className="border-t border-border mt-6 pt-4 space-y-2.5">
              <Link
                to="/privacy-policy"
                className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs font-extrabold text-foreground transition hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <FileLock2 className="size-4 text-primary" /> سياسة الخصوصية
                </span>
              </Link>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted/60 py-2.5 text-xs font-extrabold text-foreground transition hover:bg-muted"
                >
                  <LogOut className="size-4" /> تسجيل الخروج
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/10 py-2.5 text-xs font-extrabold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="size-4" /> حذف الحساب
                </button>
              </div>
            </div>
          </div>
        )}

        {/* قسم تواصل مع دعم الأبليكشن */}
        <div className="card-surface mt-5 rounded-3xl p-5 space-y-3 border border-border/60">
          <h3 className="flex items-center gap-2 font-display text-sm font-extrabold">
            <MessageCircle className="h-4 w-4 text-primary" /> تواصل مع دعم الابليكشن
          </h3>
          <div className="flex gap-2 flex-wrap">
            <a
              href="https://wa.me/201035336792"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-2.5 rounded-2xl transition min-w-[65px]"
            >
              <MessageCircle className="size-4" />
              <span className="text-[10px] font-bold">واتساب</span>
            </a>
            <a
              href="https://www.facebook.com/tigihagz"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 py-2.5 rounded-2xl transition min-w-[65px]"
            >
              <Facebook className="size-4" />
              <span className="text-[10px] font-bold">فيسبوك</span>
            </a>
            <a
              href="https://www.instagram.com/tigihagz"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#E1306C]/10 text-[#E1306C] hover:bg-[#E1306C]/20 py-2.5 rounded-2xl transition min-w-[65px]"
            >
              <Instagram className="size-4" />
              <span className="text-[10px] font-bold">إنستجرام</span>
            </a>
            <a
              href="https://www.tiktok.com/@tigihagz"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1 bg-black/10 text-black dark:bg-white/10 dark:text-white hover:bg-black/20 dark:hover:bg-white/20 py-2.5 rounded-2xl transition min-w-[65px]"
            >
              <TiktokIcon className="size-4" />
              <span className="text-[10px] font-bold">تيك توك</span>
            </a>
          </div>
        </div>
      </main>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        isDeleting={isDeleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />

      <Toaster position="top-center" />
    </div>
  );
}
