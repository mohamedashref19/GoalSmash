import { useEffect, useState, useMemo, useRef } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock,
  Trophy,
  Wallet,
  AlertCircle,
  UploadCloud,
  X,
  AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { fetchMyBookings, cancelBooking } from "@/api/bookingApi";
// @ts-expect-error: paymentApi lacks TypeScript declarations
import { submitPaymentProof } from "@/api/paymentApi";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [{ title: "حجوزاتي | GoalSmash" }],
  }),
  component: MyBookingsPage,
});

type Tab = "upcoming" | "past";

interface BookingType {
  _id: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus?: string;
  totalPrice: number;
  venue?: { name: string };
  court?: { name: string };
  paymentId?: string;
  actualPaymentStatus?: string;
}

// =========================================
// +++ مكون المودال لرفع إثبات الدفع +++
// =========================================
function UploadProofModal({
  paymentId,
  isOpen,
  onClose,
  onSuccess,
}: {
  paymentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!file) {
      toast.error("يرجى إرفاق صورة إيصال التحويل");
      return;
    }
    if (!transactionId) {
      toast.error("يرجى إدخال رقم المعاملة");
      return;
    }
    if (!senderPhone || senderPhone.length < 11) {
      toast.error("يرجى إدخال رقم هاتف المرسل بشكل صحيح");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitPaymentProof(paymentId, file, transactionId, senderPhone);
      toast.success("تم رفع الإثبات بنجاح، جاري المراجعة");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-lg p-5 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">إرفاق إثبات الدفع</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
              رقم الهاتف المحول منه
            </label>
            <input
              type="text"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="مثال: 01012345678"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
              رقم العملية (Transaction ID)
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="اكتب الرقم المرجعي للتحويل"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
              صورة الإيصال (سكرين شوت)
            </label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 text-sm font-bold text-muted-foreground hover:bg-muted transition"
            >
              <UploadCloud className="size-5" />
              {file ? file.name : "اختر صورة من جهازك"}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full gradient-primary text-primary-foreground font-bold py-2.5 rounded-xl transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "جاري الرفع..." : "تأكيد ورفع الإثبات"}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================
// +++ نافذة تأكيد الإلغاء التحذيرية +++
// =========================================
function CancelConfirmModal({
  isOpen,
  isCancelling,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl p-6 animate-in fade-in zoom-in-95 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-extrabold text-foreground mb-2">تنبيه قبل الإلغاء!</h3>
        <p className="text-sm font-bold text-muted-foreground mb-4">
          هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟
        </p>

        <div className="bg-muted/50 rounded-xl p-4 text-xs text-right space-y-3 border border-border mb-6">
          <p className="flex gap-2 items-start font-semibold text-muted-foreground">
            <span className="text-destructive font-black shrink-0 mt-0.5">•</span>
            <span>
              يتم إلغاء الحجز تلقائياً إذا لم يتم إتمام التحويل خلال 10 دقائق من طلب الحجز.
            </span>
          </p>
          <p className="flex gap-2 items-start font-semibold text-muted-foreground">
            <span className="text-destructive font-black shrink-0 mt-0.5">•</span>
            <span>
              عند الإلغاء قبل موعد الحجز بـ <span className="text-foreground">24 ساعة فأكثر</span>،
              يتم خصم 50% من المبلغ المدفوع.
            </span>
          </p>
          <p className="flex gap-2 items-start font-semibold text-muted-foreground">
            <span className="text-destructive font-black shrink-0 mt-0.5">•</span>
            <span>
              <strong className="text-destructive">لا يمكن استرداد أي مبلغ</strong> في حالة الإلغاء
              قبل موعد الحجز بمدة أقل من 24 ساعة.
            </span>
          </p>
          <hr className="border-border my-2" />
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-bold flex items-center gap-1.5 justify-center">
            <Info className="size-3" /> لاسترداد الأموال (حسب الشروط أعلاه)، يرجى التواصل مع الدعم
            الفني للمنصة.
          </p>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted/80 disabled:opacity-50"
          >
            تراجع
          </button>
          <button
            onClick={onConfirm}
            disabled={isCancelling}
            className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white transition hover:bg-destructive/90 disabled:opacity-50"
          >
            {isCancelling ? "جاري الإلغاء..." : "نعم، أؤكد الإلغاء"}
          </button>
        </div>
      </div>
    </div>
  );
}
// +++ نحتاج إضافة أيقونة Info للقائمة فوق +++
import { Info } from "lucide-react";

function MyBookingsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [uploadModalPaymentId, setUploadModalPaymentId] = useState<string | null>(null);

  // +++ حالات نافذة التأكيد +++
  const [cancelModalBookingId, setCancelModalBookingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await fetchMyBookings();
      setBookings(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleConfirmCancel = async () => {
    if (!cancelModalBookingId) return;
    setIsCancelling(true);
    try {
      await cancelBooking(cancelModalBookingId);
      toast.success("تم إلغاء الحجز بنجاح");
      setCancelModalBookingId(null);
      loadBookings();
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter((b) => {
      if (!b || !b.endTime) return false;
      const isCancelledOrExpired =
        b.status === "cancelled" || b.status === "expired" || b.paymentStatus === "expired";
      const isUpcoming = new Date(b.endTime) >= now && !isCancelledOrExpired;
      return tab === "upcoming" ? isUpcoming : !isUpcoming;
    });
  }, [bookings, tab]);

  const getStatusBadge = (
    status: string,
    paymentStatus?: string,
    endTime?: string,
    actualPaymentStatus?: string,
  ) => {
    if (
      status === "cancelled" ||
      status === "expired" ||
      paymentStatus === "expired" ||
      actualPaymentStatus === "expired"
    ) {
      return (
        <span className="rounded-lg bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
          ملغي
        </span>
      );
    }

    if (endTime && new Date(endTime) < new Date()) {
      return (
        <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground border border-border">
          منتهي
        </span>
      );
    }

    if (actualPaymentStatus === "pending_verification") {
      return (
        <span className="rounded-lg bg-info/15 px-2 py-0.5 text-[11px] font-bold text-info">
          قيد المراجعة
        </span>
      );
    }

    switch (status) {
      case "confirmed":
        return (
          <span className="rounded-lg bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
            مؤكد
          </span>
        );
      case "pending":
      case "pending_payment":
        return (
          <span className="rounded-lg bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">
            بانتظار الدفع
          </span>
        );
      default:
        return (
          <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground border border-border">
            {status}
          </span>
        );
    }
  };

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground">
      <Header title="حجوزاتي" onMenu={() => {}} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div className="mb-6 flex gap-2 rounded-2xl border border-border bg-card p-1.5">
          <button
            onClick={() => setTab("upcoming")}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm",
              tab === "upcoming"
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            الحجوزات القادمة
          </button>
          <button
            onClick={() => setTab("past")}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm",
              tab === "past"
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            السابقة
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Clock className="h-8 w-8 animate-spin" />
            <p className="mt-4 font-semibold">جارٍ تحميل حجوزاتك...</p>
          </div>
        ) : error ? (
          <div className="grid place-items-center py-20 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p className="mt-4 font-semibold">{error}</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
            <CalendarDays className="size-12 text-muted-foreground opacity-20" />
            <p className="text-sm font-bold">لا توجد حجوزات في هذه القائمة</p>
            <Link to="/explore" className="mt-2 font-bold text-primary hover:underline">
              احجز ملعبك الآن
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => {
              if (!b || !b.startTime) return null;
              const startDate = new Date(b.startTime);
              const endDate = new Date(b.endTime);
              const isExpired = endDate < new Date();

              const isCancelledOrExpired =
                b.status === "cancelled" ||
                b.status === "expired" ||
                b.paymentStatus === "expired" ||
                b.actualPaymentStatus === "expired";

              const dateStr = startDate.toLocaleDateString("ar-EG", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              const timeStr = startDate.toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <article
                  key={b._id}
                  className="card-surface flex flex-col gap-3 p-4 transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="gradient-primary flex size-12 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
                      <Trophy className="size-6" />
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold sm:text-base">
                          {b.venue?.name || "المكان غير محدد"} -{" "}
                          {b.court?.name || "الملعب غير محدد"}
                        </h2>
                        {getStatusBadge(
                          b.status,
                          b.paymentStatus,
                          b.endTime,
                          b.actualPaymentStatus,
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3.5" /> {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {timeStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 sm:border-0 sm:pt-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
                      <Wallet className="size-4" />
                      {b.totalPrice} ج.م
                    </span>

                    <div className="flex items-center gap-2">
                      {b.paymentId &&
                        b.status === "pending_payment" &&
                        b.actualPaymentStatus === "pending" && (
                          <button
                            onClick={() => setUploadModalPaymentId(b.paymentId!)}
                            className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/20"
                          >
                            <UploadCloud className="size-3.5" />
                            إرفاق إيصال الدفع
                          </button>
                        )}

                      {tab === "upcoming" && !isCancelledOrExpired && !isExpired && (
                        <button
                          onClick={() => setCancelModalBookingId(b._id)}
                          className="rounded-xl border border-destructive/30 px-3 py-1.5 text-[11px] font-bold text-destructive transition hover:bg-destructive/10"
                        >
                          إلغاء الحجز
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {uploadModalPaymentId && (
        <UploadProofModal
          paymentId={uploadModalPaymentId}
          isOpen={!!uploadModalPaymentId}
          onClose={() => setUploadModalPaymentId(null)}
          onSuccess={loadBookings}
        />
      )}

      {/* استدعاء نافذة الإلغاء */}
      <CancelConfirmModal
        isOpen={!!cancelModalBookingId}
        isCancelling={isCancelling}
        onClose={() => setCancelModalBookingId(null)}
        onConfirm={handleConfirmCancel}
      />

      <Toaster position="top-center" />
    </div>
  );
}
