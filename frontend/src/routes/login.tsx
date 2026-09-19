import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Phone, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error authApi is a JavaScript module without TypeScript declarations.
import { loginUser } from "@/api/authApi";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | GoalSmash" },
      {
        name: "description",
        content: "سجّل دخولك إلى لوحة إدارة ملاعب GoalSmash.",
      },
    ],
  }),
  component: LoginPage,
});

const field =
  "mt-1.5 w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // حالة تذكرني

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{8,15}$/.test(phone.trim())) {
      toast.error("أدخل رقم هاتف صحيح من 8 إلى 15 رقمًا.");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    setLoading(true);
    try {
      // استدعاء دالة الدخول الحقيقية
      const response = await loginUser(phone, password);

      // حفظ التوكن وبيانات المستخدم بناءً على اختيار تذكرني
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("token", response.token);
      storage.setItem("userData", JSON.stringify(response.data.user));

      toast.success("تم تسجيل الدخول بنجاح");

      // التوجيه الذكي: العميل يذهب لتصفح الملاعب، والمالك للوحة التحكم
      const userRole = response.data.user.role;
      if (userRole === "admin") {
        window.location.href = "/admin-dashboard";
      } else if (userRole === "customer") {
        window.location.href = "/explore";
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      toast.error((error as string) || "رقم الهاتف أو كلمة المرور غير صحيحة");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full opacity-20 blur-3xl gradient-primary"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl gradient-primary"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="gradient-primary grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-soft)]">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted-foreground">أهلاً بعودتك إلى GoalSmash</p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <label className="block text-sm font-semibold">
              رقم الهاتف
              <div className="relative">
                <Phone className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  className={field}
                  value={phone}
                  required
                  inputMode="tel"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </label>

            <label className="block text-sm font-semibold">
              كلمة المرور
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  className={field}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                تذكرني
              </label>
              <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "جارٍ الدخول..." : "دخول"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/signup" className="font-bold text-primary hover:underline">
              إنشاء حساب جديد
            </Link>
          </p>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
