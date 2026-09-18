import { useState, useEffect, useRef } from "react";
import {
  Clock,
  Copy,
  CheckCircle2,
  X,
  Upload,
  FileImage,
  Loader2,
  Info,
  AlertTriangle, // +++ أضفنا هذه الأيقونات للتنبيهات +++
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { io } from "socket.io-client";
// @ts-expect-error API lack types
import { uploadPaymentProof } from "@/api/paymentApi";

const SOCKET_URL = "http://localhost:3000";

interface PaymentData {
  id: string;
  method: string;
  amount: number;
  expiresAt: string;
  instructions: { vodafoneCashNumber: string; instaPayAddress: string };
}

interface PaymentModalProps {
  open: boolean;
  paymentData: PaymentData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ open, paymentData, onClose, onSuccess }: PaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  // حالات الإثبات اليدوي
  const [showProofForm, setShowProofForm] = useState(false);
  const [manualTrxId, setManualTrxId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !paymentData) return;
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiration = new Date(paymentData.expiresAt).getTime();
      const difference = expiration - now;
      if (difference <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        return;
      }
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimeLeft(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    calculateTimeLeft();
    const timerInterval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timerInterval);
  }, [open, paymentData]);

  useEffect(() => {
    if (!open) return;
    const userDataStr = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (!userDataStr) return;
    const user = JSON.parse(userDataStr);
    const userId = user._id || user.id;
    const socket = io(SOCKET_URL);
    socket.on(`booking-confirmed-${userId}`, () => {
      toast.success("تم تأكيد دفعك وحجزك بنجاح! 🎉");
      onSuccess();
    });
    return () => {
      socket.disconnect();
    };
  }, [open, onSuccess]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم النسخ بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadProof = async () => {
    if (!paymentData || !manualTrxId || !proofFile) {
      toast.error("يرجى إدخال رقم المعاملة وإرفاق صورة الإثبات");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("manualTransactionId", manualTrxId);
    formData.append("proofImage", proofFile);

    try {
      await uploadPaymentProof(paymentData.id, formData);
      toast.success("تم إرسال الإثبات للإدارة بنجاح!");
      onSuccess(); // قفل الشاشة والتوجه لحجوزاتي
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsUploading(false);
    }
  };

  if (!open || !paymentData) return null;

  const isInstapay = paymentData.method === "instapay";
  const targetAddress = isInstapay
    ? paymentData.instructions.instaPayAddress
    : paymentData.instructions.vodafoneCashNumber;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={isExpired ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-2xl border border-border animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4 sticky top-0 z-20">
          <h3 className="font-display text-lg font-extrabold text-foreground">إتمام الدفع</h3>
          {isExpired && (
            <button
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* مؤقت الانتهاء */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center gap-2 rounded-full px-5 py-2 font-bold text-lg transition-colors",
                isExpired ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
              )}
            >
              <Clock className={cn("size-5", isExpired ? "" : "animate-pulse")} />
              <span className="tracking-widest">{timeLeft}</span>
            </div>
            {!isExpired && (
              <p className="text-[11px] font-semibold text-muted-foreground">
                يرجى إتمام التحويل قبل انتهاء الوقت لتجنب إلغاء الحجز
              </p>
            )}
          </div>

          {!isExpired && !showProofForm && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
              {/* صندوق المبلغ المطلوب */}
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-0.5 rounded-bl-xl text-[10px] font-bold">
                  هام جداً
                </div>
                <p className="text-sm font-bold text-foreground mt-2">
                  المبلغ المطلوب تحويله (بالكسور)
                </p>
                <div
                  className="flex items-center justify-center gap-1 font-display text-4xl font-black text-primary"
                  dir="ltr"
                >
                  <span>EGP</span>
                  <span>{paymentData.amount.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5 mt-2">
                  <AlertTriangle className="size-3.5 text-warning" />
                  يجب تحويل المبلغ بالكسور لضمان التأكيد الآلي للحجز
                </p>
              </div>

              {/* تفاصيل التحويل */}
              <div className="space-y-3">
                <p className="text-sm font-bold flex items-center gap-1.5">
                  طريقة الدفع المختارة:
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {isInstapay ? "إنستا باي" : "فودافون كاش"}
                  </span>
                </p>
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 transition hover:border-primary/30">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {isInstapay ? "عنوان إنستا باي (IPA)" : "رقم المحفظة للتحويل"}
                    </span>
                    <span className="font-bold text-lg" dir="ltr">
                      {targetAddress}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(targetAddress)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-background border border-border px-3 py-2 text-xs font-bold transition hover:bg-muted"
                  >
                    {copied ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copied ? "تم النسخ" : "نسخ"}
                  </button>
                </div>
              </div>

              {/* +++ صندوق سياسة الإلغاء والتعليمات +++ */}
              <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                  <Info className="size-4 text-primary" /> تعليمات الحجز وسياسة الإلغاء:
                </h4>
                <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside font-semibold leading-relaxed">
                  <li>
                    يتم إلغاء الحجز تلقائياً إذا لم يتم التحويل خلال{" "}
                    <span className="text-foreground">10 دقائق</span>.
                  </li>
                  <li>
                    عند الإلغاء قبل موعد الحجز بـ{" "}
                    <span className="text-foreground">24 ساعة فأكثر</span>، يتم خصم{" "}
                    <span className="text-destructive font-bold">50%</span> من المبلغ المدفوع.
                  </li>
                  <li>
                    لا يمكن استرداد أي مبلغ في حالة الإلغاء قبل موعد الحجز بمدة{" "}
                    <span className="text-destructive font-bold">أقل من 24 ساعة</span>.
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setShowProofForm(true)}
                className="w-full text-xs font-bold text-muted-foreground hover:text-primary transition underline decoration-dashed underline-offset-4"
              >
                هل واجهت مشكلة في التأكيد التلقائي؟ ارفع الإثبات يدوياً
              </button>
            </div>
          )}

          {!isExpired && showProofForm && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  رقم المعاملة (Reference Number)
                </label>
                <input
                  type="text"
                  placeholder="أدخل رقم المعاملة من رسالة البنك"
                  value={manualTrxId}
                  onChange={(e) => setManualTrxId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  صورة الإثبات (Screenshot)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <FileImage
                    className={cn("size-8", proofFile ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="text-xs font-bold text-muted-foreground">
                    {proofFile ? proofFile.name : "اضغط لاختيار صورة الإثبات من جهازك"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setProofFile(e.target.files[0]);
                  }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowProofForm(false)}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition"
                >
                  رجوع
                </button>
                <button
                  onClick={handleUploadProof}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  إرسال للإدارة
                </button>
              </div>
            </div>
          )}

          {isExpired && (
            <div className="animate-in fade-in space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
                <p className="font-bold text-sm text-foreground">
                  انتهى وقت الدفع المخصص لهذا الحجز
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  برجاء العودة وبدء عملية الحجز من جديد.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition"
              >
                العودة للملعب
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
