import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trophy, User, Phone, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error authApi is a JavaScript module without TypeScript declarations.
import { signupUser } from "@/api/authApi";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب | Tigi-Hagz" },
      {
        name: "description",
        content: "أنشئ حسابًا جديدًا في لوحة إدارة ملاعب Tigi-Hagz.",
      },
      { property: "og:title", content: "إنشاء حساب | Tigi-Hagz" },
      {
        property: "og:description",
        content: "أنشئ حسابًا جديدًا في لوحة إدارة ملاعب Tigi-Hagz.",
      },
    ],
  }),
  component: SignUpPage,
});

const field =
  "w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

const passwordField =
  "w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-11 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

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

    // +++ تنظيف البيانات من المسافات والرموز المخفية قبل التحقق والإرسال +++
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\s+/g, "").trim();
    const cleanEmail = email.replace(/[\s\u200B-\u200D\uFEFF\u200E\u200F]/g, "").toLowerCase();

    if (cleanName.length < 3) {
      toast.error("أدخل اسمك الكامل (3 أحرف على الأقل).");
      return;
    }
    if (!/^[0-9]{8,15}$/.test(cleanPhone)) {
      toast.error("أدخل رقم هاتف صحيح من 8 إلى 15 رقمًا.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
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
      // +++ إرسال البيانات النظيفة للباك إند +++
      await signupUser({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        password,
        passwordConfirm: confirm,
      });
      sessionStorage.setItem("verifyEmail", cleanEmail);

      toast.success("تم إنشاء الحساب بنجاح! يرجى إدخال كود التفعيل");
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
          <p className="mt-1 text-sm text-muted-foreground">انضم إلى Tigi-Hagz لإدارة ملاعبك</p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-sm font-semibold">
                الاسم الكامل
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-name"
                  className={field}
                  value={name}
                  required
                  placeholder="مثال: محمد اشرف "
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-phone" className="mb-1.5 block text-sm font-semibold">
                رقم الهاتف
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-phone"
                  className={field}
                  value={phone}
                  required
                  inputMode="tel"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-semibold">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-email"
                  className={field}
                  type="email"
                  value={email}
                  required
                  dir="ltr"
                  placeholder="name@gmail.com"
                  onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ""))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-semibold">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-password"
                  className={passwordField}
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
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
            </div>

            <div>
              <label htmlFor="signup-confirm" className="mb-1.5 block text-sm font-semibold">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  id="signup-confirm"
                  className={`${passwordField} ${confirm && confirm !== password ? "border-destructive focus:border-destructive focus:ring-destructive/40" : ""}`}
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              {confirm && confirm !== password && (
                <span className="mt-1 block text-xs font-semibold text-destructive">
                  كلمتا المرور غير متطابقتين
                </span>
              )}
            </div>

            <p className="text-[11px] text-center text-muted-foreground mt-2 leading-relaxed">
              بالضغط على "إنشاء الحساب"، فإنك توافق على{" "}
              <Link to="/privacy-policy" className="font-bold text-primary hover:underline">
                سياسة الخصوصية
              </Link>{" "}
              الخاصة بنا.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
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
