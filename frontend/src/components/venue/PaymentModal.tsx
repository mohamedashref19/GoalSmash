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
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { io } from "socket.io-client";
// @ts-expect-error API lack types
import { uploadPaymentProof } from "@/api/paymentApi";
// @ts-expect-error: until axiosConfig.js is migrated to TypeScript or has typings.
import { BACKEND_URL } from "@/api/axiosConfig";

const SOCKET_URL = BACKEND_URL;

interface PaymentData {
  id: string;
  method: string;
  amount: number;
  expiresAt: string;
  instructions: {
    identifier: string;
    accountName: string;
  } | null;
}

export interface BookingDetails {
  startTime: string;
  endTime: string;
}

interface PaymentModalProps {
  open: boolean;
  paymentData: PaymentData | null;
  bookingDetails?: BookingDetails | null;
  // ساعة فتح النادي: أي ساعة قبلها تعتبر بعد منتصف الليل (الافتراضي 8)
  openHour?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({
  open,
  paymentData,
  bookingDetails,
  openHour = 8,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  useEffect(() => {
    if (!open) return;

    const userDataStr = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (!userDataStr) return;

    try {
      const user = JSON.parse(userDataStr);
      const userId = user._id || user.id;

      if (!userId) return;

      const socket = io(SOCKET_URL, {
        transports: ["polling"],
        withCredentials: true,
        // التوكن عشان السيرفر يدخّل الاتصال في غرفة المستخدم ويبعتله إشعاراته هو بس
        auth: (cb) =>
          cb({ token: localStorage.getItem("token") || sessionStorage.getItem("token") }),
      });

      const eventName = `booking-confirmed-${userId}`;

      socket.on(eventName, () => {
        toast.success("مبروك! حجزك اتأكد.. جهّز فريقك 🎉");
        if (onSuccessRef.current) onSuccessRef.current();
        if (onCloseRef.current) onCloseRef.current();
      });

      return () => {
        socket.off(eventName);
        socket.disconnect();
      };
    } catch (e) {
      console.error("خطأ في قراءة بيانات المستخدم للسوكت", e);
      return undefined;
    }
  }, [open]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("اتنسخ خلاص!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadProof = async () => {
    if (!paymentData || !manualTrxId || !proofFile) {
      toast.error("اكتب رقم العملية وارفع صورة السكرين شوت الأول");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("manualTransactionId", manualTrxId);
    formData.append("proofImage", proofFile);

    try {
      await uploadPaymentProof(paymentData.id, formData);
      toast.success("وصلت صورة التحويل للإدارة وهيتأكد حجزك فوراً!");
      onSuccess();
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsUploading(false);
    }
  };

  if (!open || !paymentData) return null;

  const isInstapay = paymentData.method === "instapay";
  const targetAddress = paymentData.instructions?.identifier || "الرقم غير متاح حالياً";
  const targetName = paymentData.instructions?.accountName || "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={isExpired ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-2xl border border-border animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4 sticky top-0 z-20">
          <h3 className="font-display text-lg font-extrabold text-foreground">
            دفع العربون وتأكيد الحجز
          </h3>
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
                حوّل العربون قبل ما الوقت يخلص عشان الحجز ميتلغيش
              </p>
            )}
          </div>

          {!isExpired && !showProofForm && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
              {bookingDetails && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <CalendarDays className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground">يوم الماتش</p>
                        <p className="text-xs font-bold text-foreground">
                          {new Date(bookingDetails.startTime).toLocaleDateString("ar-EG", {
                            weekday: "long",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-border"></div>
                    <div className="flex items-center gap-2.5">
                      <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <Clock className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground">الميعاد</p>
                        <p className="text-xs font-bold text-foreground" dir="ltr">
                          {new Date(bookingDetails.startTime).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {new Date(bookingDetails.endTime).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const startDate = new Date(bookingDetails.startTime);
                    const endDate = new Date(bookingDetails.endTime);
                    const startHour = startDate.getHours();

                    // بعد منتصف الليل = أي ساعة قبل ميعاد فتح النادي
                    const isAfterMidnight = startHour < openHour;

                    // الحجز بيعدّي منتصف الليل لو آخر دقيقة فيه في يوم تاني غير يوم البداية
                    // (23:00 -> 00:00 مش بيعدّي، لأنه بيخلص عند منتصف الليل بالظبط)
                    const lastMinute = new Date(endDate.getTime() - 60 * 1000);
                    const crossesMidnight = lastMinute.toDateString() !== startDate.toDateString();

                    if (isAfterMidnight || crossesMidnight) {
                      if (isAfterMidnight) {
                        const displayDate = new Date(startDate);
                        displayDate.setDate(displayDate.getDate() - 1);

                        return (
                          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex gap-3 items-start animate-in fade-in">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-foreground">
                                خلي بالك: الميعاد ده بعد نص الليل
                              </p>
                              <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">
                                إنت اخترت سهرة يوم{" "}
                                <strong className="text-foreground">
                                  {displayDate.toLocaleDateString("ar-EG", { weekday: "long" })}
                                </strong>
                                ، وعشان الساعات دي بعد الساعه 12 بالليل فبتكون تبع فجر يوم{" "}
                                <strong className="text-foreground">
                                  {startDate.toLocaleDateString("ar-EG", { weekday: "long" })}
                                </strong>
                                . اتأكد إن ده الميعاد الصح قبل ما تحوّل.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (crossesMidnight) {
                        return (
                          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex gap-3 items-start animate-in fade-in">
                            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-foreground">
                                خلي بالك: الحجز مكمل لبعد نص الليل
                              </p>
                              <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">
                                الحجز هيبدأ يوم{" "}
                                <strong className="text-foreground">
                                  {startDate.toLocaleDateString("ar-EG", { weekday: "long" })}
                                </strong>{" "}
                                بالليل، وهيخلص فجر يوم{" "}
                                <strong className="text-foreground">
                                  {endDate.toLocaleDateString("ar-EG", { weekday: "long" })}
                                </strong>
                                . اتأكد من الميعاد قبل ما تحوّل.
                              </p>
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              )}

              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 text-center space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-0.5 rounded-bl-xl text-[10px] font-bold">
                  مهم جداً
                </div>
                <p className="text-sm font-bold text-foreground mt-2">
                  حوّل المبلغ ده بالظبط (بالقروش)
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
                  لازم تحوّل المبلغ بالقروش زي ما هو مكتوب عشان الحجز يتأكد تلقائياً في ثواني
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold flex items-center gap-1.5">
                  هتحوّل عن طريق:
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {isInstapay ? "إنستا باي" : "محفظة إلكترونية"}
                  </span>
                </p>
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 transition hover:border-primary/30">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {isInstapay ? "عنوان / رقم إنستا باي للتحويل" : "رقم المحفظة للتحويل"}
                    </span>
                    <span className="font-bold text-lg" dir="ltr">
                      {targetAddress}
                    </span>
                    {targetName && (
                      <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
                        باسم: {targetName}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(targetAddress)}
                    disabled={!paymentData.instructions}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-background border border-border px-3 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
                  >
                    {copied ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copied ? "اتنسخ" : "نسخ الرقم"}
                  </button>
                </div>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5 text-foreground">
                  <Info className="size-4 text-primary" /> نظام الحجز والإلغاء:
                </h4>
                <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside font-semibold leading-relaxed">
                  <li>
                    الحجز بيتلغي تلقائياً لو مكملتش التحويل خلال{" "}
                    <span className="text-foreground">10 دقايق</span>.
                  </li>
                  <li>
                    لو لغيت قبل ميعاد الحجز بـ{" "}
                    <span className="text-foreground">24 ساعة أو أكتر</span>، بيتخصم{" "}
                    <span className="text-destructive font-bold">50%</span> من العربون المدفوع.
                  </li>
                  <li>
                    العربون مبيرجعش في حالة الإلغاء قبل ميعاد الحجز بـ{" "}
                    <span className="text-destructive font-bold">أقل من 24 ساعة</span>.
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setShowProofForm(true)}
                className="w-full text-xs font-bold text-muted-foreground hover:text-primary transition underline decoration-dashed underline-offset-4"
              >
                حصلت مشكلة في التأكيد التلقائي؟ ارفع سكرين شوت التحويل من هنا
              </button>
            </div>
          )}

          {!isExpired && showProofForm && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  رقم العملية (المرجع في رسالة التحويل)
                </label>
                <input
                  type="text"
                  placeholder="اكتب رقم العملية هنا"
                  value={manualTrxId}
                  onChange={(e) => setManualTrxId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  صورة التحويل (سكرين شوت)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <FileImage
                    className={cn("size-8", proofFile ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="text-xs font-bold text-muted-foreground">
                    {proofFile ? proofFile.name : "دوس هنا واختار صورة السكرين شوت من موبايلك"}
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
                  إرسال للتأكيد
                </button>
              </div>
            </div>
          )}

          {isExpired && (
            <div className="animate-in fade-in space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
                <p className="font-bold text-sm text-foreground">وقت الدفع للحجز ده خلص</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ارجع لصفحة الملعب واختار الساعة من الأول عشان تحجزها.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition"
              >
                رجوع للملعب
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
