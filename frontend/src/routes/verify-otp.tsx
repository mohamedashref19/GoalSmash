import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { verifyUserOTP, resendUserOTP, forgetPassword } from "@/api/authApi";

export const Route = createFileRoute("/verify-otp")({
  head: () => ({
    meta: [{ title: "التحقق من الرمز | GoalSmash" }],
  }),
  component: VerifyOtpPage,
});

const OTP_LENGTH = 6;

function VerifyOtpPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(59);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // سحب الإيميل من المتصفح أول ما الصفحة تفتح
  useEffect(() => {
    const savedEmail = sessionStorage.getItem("verifyEmail");
    if (!savedEmail) {
      navigate({ to: "/signup" });
    } else {
      setEmail(savedEmail);
    }
  }, [navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const setDigit = (i: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    setDigits((prev) => prev.map((_, i) => text[i] ?? ""));
    inputsRef.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const resend = async () => {
    try {
      const isResetFlow = sessionStorage.getItem("isResetFlow");

      if (isResetFlow) {
        // لو المستخدم جاي من نسيت كلمة السر، نبعت كود الاسترجاع تاني
        await forgetPassword(email);
      } else {
        // لو المستخدم بيعمل حساب جديد، نبعت كود التفعيل
        await resendUserOTP(email);
      }

      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(59);
      inputsRef.current[0]?.focus();
      toast.success("تم إرسال رمز جديد إلى بريدك الإلكتروني");
    } catch (error) {
      toast.error((error as string) || "حدث خطأ أثناء الإرسال");
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const otpCode = digits.join("");
    if (otpCode.length !== OTP_LENGTH) {
      toast.error(`أدخل رمز التحقق المكوّن من ${OTP_LENGTH} أرقام.`);
      return;
    }

    setLoading(true);
    try {
      const isResetFlow = sessionStorage.getItem("isResetFlow");

      if (isResetFlow) {
        // مسار استرجاع كلمة المرور: نحفظ الكود في المتصفح وننتقل لصفحة كتابة الباسورد الجديد
        sessionStorage.setItem("resetOTP", otpCode);
        toast.success("تم تأكيد الكود، يرجى إدخال كلمة المرور الجديدة");
        navigate({ to: "/reset-password" });
        setLoading(false);
        return; // بنوقف تنفيذ الدالة هنا عشان ميكلمش الـ API
      }

      // مسار إنشاء حساب جديد: نكلم الباك إند عشان نفعل الحساب ونعمل Login
      const response = await verifyUserOTP(email, otpCode);

      localStorage.setItem("token", response.token);
      localStorage.setItem("userData", JSON.stringify(response.data.user));
      sessionStorage.removeItem("verifyEmail");

      toast.success("تم التحقق بنجاح!");

      const userRole = response.data.user.role;
      if (userRole === "admin") {
        window.location.href = "/admin-dashboard";
      } else if (userRole === "customer") {
        window.location.href = "/explore";
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      toast.error((error as string) || "رمز التحقق غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 -top-32 right-auto h-96 w-96 rounded-full opacity-20 blur-3xl gradient-primary"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="gradient-primary grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">التحقق من الرمز</h1>
          <p className="mt-1 text-sm text-muted-foreground">أدخل الرمز المرسل إلى {email}</p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div dir="ltr" className="flex justify-center gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  value={d}
                  inputMode="numeric"
                  maxLength={1}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={onPaste}
                  className="h-12 w-11 rounded-xl border border-input bg-background text-center font-display text-lg font-extrabold outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "جارٍ التحقق..." : "تحقق"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {secondsLeft > 0 ? (
              <>
                إعادة إرسال الرمز خلال{" "}
                <span dir="ltr" className="font-display font-bold text-foreground">
                  {mm}:{ss}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={resend}
                className="font-bold text-primary hover:underline"
              >
                إعادة إرسال الرمز
              </button>
            )}
          </p>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
