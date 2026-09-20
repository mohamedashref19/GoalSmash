import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trophy, User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error authApi is a JavaScript module without TypeScript declarations.
import { signupUser } from "@/api/authApi";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب | GoalSmash" },
      {
        name: "description",
        content: "أنشئ حسابًا جديدًا في لوحة إدارة ملاعب GoalSmash.",
      },
      { property: "og:title", content: "إنشاء حساب | GoalSmash" },
      {
        property: "og:description",
        content: "أنشئ حسابًا جديدًا في لوحة إدارة ملاعب GoalSmash.",
      },
    ],
  }),
  component: SignUpPage,
});

const field =
  "mt-1.5 w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      toast.error("أدخل اسمك الكامل (3 أحرف على الأقل).");
      return;
    }
    if (!/^[0-9]{8,15}$/.test(phone.trim())) {
      toast.error("أدخل رقم هاتف صحيح من 8 إلى 15 رقمًا.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      // الاتصال الفعلي بالباك إند وإرسال البيانات
      await signupUser({ name, phone, email, password, passwordConfirm: confirm });
      sessionStorage.setItem("verifyEmail", email);

      toast.success("تم إنشاء الحساب بنجاح! يرجى إدخال كود التفعيل");
      // التوجيه التلقائي لصفحة إدخال الـ OTP
      navigate({ to: "/verify-otp" });
    } catch (error) {
      toast.error(
        (error as string) || "حدث خطأ أثناء إنشاء الحساب، قد يكون البريد أو الرقم مستخدماً بالفعل",
      );
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    if (password.length === 0) return { label: "", pct: 0, color: "bg-muted" };
    if (password.length < 6) return { label: "ضعيفة", pct: 25, color: "bg-destructive" };
    if (password.length < 9) return { label: "متوسطة", pct: 55, color: "bg-warning" };
    return { label: "قوية", pct: 100, color: "bg-success" };
  })();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl gradient-primary"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-20 blur-3xl gradient-primary"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="gradient-primary grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-soft)]">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">إنشاء حساب جديد</h1>
          <p className="mt-1 text-sm text-muted-foreground">انضم إلى GoalSmash لإدارة ملاعبك</p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <label className="block text-sm font-semibold">
              الاسم الكامل
              <div className="relative">
                <User className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  className={field}
                  value={name}
                  required
                  placeholder="مثال: أحمد سمير"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </label>

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
              البريد الإلكتروني
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  className={field}
                  type="email"
                  value={email}
                  required
                  dir="ltr"
                  placeholder="name@example.com"
                  onChange={(e) => setEmail(e.target.value)}
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
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              {strength.label && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${strength.color}`}
                      style={{ width: `${strength.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {strength.label}
                  </span>
                </div>
              )}
            </label>

            <label className="block text-sm font-semibold">
              تأكيد كلمة المرور
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${field} ${confirm && confirm !== password ? "border-destructive focus:border-destructive focus:ring-destructive/40" : ""}`}
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {confirm && confirm !== password && (
                <span className="mt-1 block text-xs font-semibold text-destructive">
                  كلمتا المرور غير متطابقتين
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
