import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trophy, Mail, Send } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { forgetPassword } from "@/api/authApi";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "نسيت كلمة المرور | GoalSmash" },
      { name: "description", content: "أدخل بريدك الإلكتروني لإرسال رمز إعادة تعيين كلمة المرور." },
    ],
  }),
  component: ForgotPasswordPage,
});

const field =
  "mt-1.5 w-full rounded-xl border border-input bg-background py-2.5 pr-11 pl-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    setLoading(true);

    try {
      await forgetPassword(email);
      // حفظ الإيميل وعلامة الاسترجاع عشان صفحة الـ OTP تستخدمهم
      sessionStorage.setItem("verifyEmail", email);
      sessionStorage.setItem("isResetFlow", "true");

      toast.success("تم إرسال رمز التحقق إلى بريدك الإلكتروني");
      navigate({ to: "/verify-otp" });
    } catch (error) {
      toast.error((error as string) || "حدث خطأ أثناء إرسال الكود، تأكد من صحة البريد.");
    } finally {
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
          <h1 className="mt-4 font-display text-2xl font-extrabold">نسيت كلمة المرور</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق
          </p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
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

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {loading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            تذكرت كلمة المرور؟{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
