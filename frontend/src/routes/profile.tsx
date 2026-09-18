import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, Phone, Mail, Lock, Eye, EyeOff, Save, KeyRound } from "lucide-react";
import { Header } from "@/components/venue/Header";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { updateUserData, updateUserPassword } from "@/api/authApi";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "الملف الشخصي | GoalSmash" }],
  }),
  component: ProfilePage,
});

const field =
  "mt-1.5 w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

function ProfilePage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // جلب البيانات من المتصفح عند التحميل
  useEffect(() => {
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setPhone(user.phone || "");
        setEmail(user.email || "");
        setRole(user.role === "customer" ? "عميل" : "مالك/مدير");
      } catch (e) {
        console.error("Error parsing user data:", e); // إصلاح no-empty
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
      return; // إصلاح خطأ TS7030
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

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground">
      <Header title="الملف الشخصي" onMenu={() => window.history.back()} />

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
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
              {role}
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
              className="gradient-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:col-span-2"
            >
              {savingInfo ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        </div>

        <div className="card-surface p-5 sm:p-6">
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
              className="gradient-primary mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:col-span-2"
            >
              {savingPassword ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
