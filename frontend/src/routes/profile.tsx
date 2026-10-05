import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  User,
  Phone,
  Mail,
  KeyRound,
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
  AlertTriangle,
  Trash2, // +++ أيقونة الحذف +++
  ShieldAlert, // +++ أيقونة الحماية +++
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { updateUserData, updateUserPassword, logoutUser, deleteUserAccount } from "@/api/authApi";
// @ts-expect-error: apiClient is a JavaScript module without TypeScript declarations
import apiClient from "@/api/axiosConfig"; // +++ لجلب الـ endpoint الخاص بالحذف +++
import { MobileSidebar } from "@/components/venue/Sidebar";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "الملف الشخصي | Tigi-Hagz" }],
  }),
  component: ProfilePage,
});

const field =
  "mt-1.5 w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

// =========================================
// +++ مكونات القوائم الجانبية (لم تتغير) +++
// =========================================
function AdminMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
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
  const navigate = useNavigate();
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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [rawRole, setRawRole] = useState("");

  const [savingInfo, setSavingInfo] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // +++ حالات حذف الحساب +++
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setPhone(user.phone || "");
        setEmail(user.email || "");
        setRawRole(user.role || "customer");
        setRoleLabel(
          user.role === "customer" ? "عميل" : user.role === "owner" ? "مالك/مدير" : "إدارة مركزية",
        );
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    } else {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const onSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const res = await updateUserData({ name, email });
      localStorage.setItem("userData", JSON.stringify(res.data.user));
      toast.success("تم تحديث البيانات الشخصية بنجاح");
    } catch (err) {
      toast.error(err as string);
    } finally {
      setSavingInfo(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateUserPassword({
        passwordCurrent: currentPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("تم تغيير كلمة المرور بنجاح");
    } catch (err) {
      toast.error(err as string);
    } finally {
      setSavingPassword(false);
    }
  };

  // +++ دالة حذف الحساب +++
  // +++ دالة حذف الحساب باستخدام الدالة الجديدة +++
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount(); // استدعاء دالة الحذف من API
      toast.success("تم حذف حسابك نهائياً.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsDeleting(false);
    }
  };

  const isAdmin = rawRole === "admin" || rawRole === "super_admin";
  const isOwner = rawRole === "owner";

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

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6 pb-24">
        <div className="card-surface mb-5 flex items-center gap-4 p-5 sm:p-6">
          <div className="gradient-primary grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold text-primary-foreground">
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-extrabold">{name}</h2>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              {email}
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-primary">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="card-surface mb-5 p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-extrabold">
            <User className="h-5 w-5 text-primary" /> البيانات الشخصية
          </h3>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSaveInfo}>
            <label className="block text-sm font-semibold sm:col-span-2">
              الاسم الكامل
              <input
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              البريد الإلكتروني
              <input
                className={field}
                type="email"
                value={email}
                dir="ltr"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              رقم الهاتف (غير قابل للتعديل)
              <input
                className={`${field} cursor-not-allowed bg-muted text-muted-foreground`}
                value={phone}
                disabled
                dir="ltr"
              />
            </label>
            <button
              type="submit"
              disabled={savingInfo}
              className="gradient-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:col-span-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingInfo ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        </div>

        <div className="card-surface mb-5 p-5 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 font-display text-base font-extrabold">
            <KeyRound className="h-5 w-5 text-primary" /> تغيير كلمة المرور
          </h3>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onChangePassword}>
            <label className="block text-sm font-semibold sm:col-span-2">
              كلمة المرور الحالية
              <input
                className={field}
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                dir="ltr"
              />
            </label>
            <label className="block text-sm font-semibold">
              الجديدة
              <input
                className={field}
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                dir="ltr"
              />
            </label>
            <label className="block text-sm font-semibold">
              تأكيد الجديدة
              <input
                className={field}
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                dir="ltr"
              />
            </label>
            <button
              type="submit"
              disabled={savingPassword}
              className="gradient-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:col-span-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingPassword ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>

        <div className="card-surface mb-5 p-5 sm:p-6 space-y-4">
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
            <MessageCircle className="h-5 w-5 text-primary" /> تواصل مع دعم الابليكشن
          </h3>
          <p className="text-xs text-muted-foreground mb-1">
            لديك استفسار أو واجهت مشكلة؟ نحن هنا لمساعدتك.
          </p>
          <div className="flex gap-2">
            <a
              href="https://wa.me/201000000000"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 py-3 rounded-xl transition"
            >
              <MessageCircle className="size-5" />
              <span className="text-[11px] font-bold">واتساب</span>
            </a>
            <a
              href="https://facebook.com/YourPageHere"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 py-3 rounded-xl transition"
            >
              <Facebook className="size-5" />
              <span className="text-[11px] font-bold">فيسبوك</span>
            </a>
            <a
              href="https://instagram.com/YourPageHere"
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-[#E1306C]/10 text-[#E1306C] hover:bg-[#E1306C]/20 py-3 rounded-xl transition"
            >
              <Instagram className="size-5" />
              <span className="text-[11px] font-bold">إنستجرام</span>
            </a>
          </div>
        </div>

        {/* +++ قسم إدارة الحساب (تسجيل خروج / حذف) +++ */}
        <div className="card-surface p-5 sm:p-6 space-y-4 border border-destructive/20">
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-destructive">
            <ShieldAlert className="h-5 w-5" /> إدارة الحساب
          </h3>
          <p className="text-xs text-muted-foreground mb-1">
            يمكنك تسجيل الخروج من جهازك الحالي، أو حذف حسابك نهائياً من النظام.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={() => {
                logoutUser();
                navigate({ to: "/login" });
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground hover:bg-muted/80 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <LogOut className="size-4" /> تسجيل الخروج
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <Trash2 className="size-4" /> حذف الحساب نهائياً
            </button>
          </div>
        </div>
      </main>

      {/* استدعاء نافذة الحذف */}
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
