import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock,
  Trophy,
  Wallet,
  AlertCircle,
  UploadCloud,
  X,
  AlertTriangle,
  Info,
  Home,
  User,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  XCircle,
  Hourglass,
  CheckCircle2,
  Star,
  QrCode,
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
// @ts-expect-error: authApi is a JavaScript module without TypeScript declarations
import { fetchMyBookings, cancelBooking } from "@/api/bookingApi";
// @ts-expect-error: paymentApi lacks TypeScript declarations
import { submitPaymentProof } from "@/api/paymentApi";
// @ts-expect-error APIs without TS definitions
import { submitReview, fetchVenueReviews } from "@/api/reviewApi";
import { MobileSidebar } from "@/components/venue/Sidebar";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [{ title: "حجوزاتي | Tigi-Hagz" }],
  }),
  component: MyBookingsPage,
});

type Tab = "upcoming" | "past";

// +++ إضافة واجهة لتقييمات الملعب العائدة من API لحل خطأ type any +++
interface FetchedReview {
  user: {
    _id: string;
  };
}

interface BookingType {
  _id: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus?: string;
  totalPrice: number;
  deposit?: number;
  venue?: { _id?: string; name: string } | string; // تم التعديل لدعم الـ String ID
  court?: { name: string };
  paymentId?: string;
  actualPaymentStatus?: string;
}

// =========================================
// +++ مكون نافذة التقييم (Review Modal) +++
// =========================================
function ReviewModal({
  venueId,
  venueName,
  isOpen,
  onClose,
  onSuccess,
}: {
  venueId: string;
  venueName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitReview(venueId, { review: reviewText, rating });
      toast.success("شكراً لك! تم إضافة تقييمك بنجاح.");
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl p-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 className="font-bold text-lg text-foreground">قيّم تجربتك في {venueName}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted text-muted-foreground transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">كيف كانت تجربتك؟</span>
            <div className="flex items-center gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "size-8 transition-colors",
                      star <= rating ? "fill-warning text-warning" : "text-muted-foreground/30",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">التعليق (اختياري)</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="شاركنا رأيك في أرضية الملعب، الإضاءة، والتعامل..."
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary transition min-h-24 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isSubmitting ? "جاري الحفظ..." : "حفظ التقييم"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// +++ مكون تذكرة الحجز (Booking Ticket Modal) +++
// =========================================
function BookingTicketModal({
  booking,
  isOpen,
  onClose,
}: {
  booking: BookingType | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !booking) return null;

  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const dateStr = startDate.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = startDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  let durationText = `${durationMinutes} دقيقة`;
  if (durationMinutes === 60) durationText = "ساعة";
  else if (durationMinutes === 90) durationText = "ساعة ونصف";
  else if (durationMinutes === 120) durationText = "ساعتين";

  const price = booking.totalPrice || 0;
  const deposit = booking.deposit || price;
  const remaining = Math.max(price - deposit, 0);

  const venueName = typeof booking.venue === "object" ? booking.venue?.name : "مكان غير محدد";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-primary p-5 text-primary-foreground relative text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-white/20 rounded-full transition"
          >
            <X size={18} />
          </button>
          <div className="mx-auto bg-white p-3 rounded-xl w-fit mb-3">
            <QrCode className="size-16 text-primary" />
          </div>
          <h3 className="font-bold text-xl">{venueName}</h3>
          <p className="text-sm opacity-90">{booking.court?.name || "ملعب غير محدد"}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">التاريخ</span>
              <span className="font-bold">{dateStr}</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs text-muted-foreground">الوقت</span>
              <span className="font-bold" dir="ltr">
                {timeStr}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">المدة</span>
              <span className="font-bold">{durationText}</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs text-muted-foreground">حالة الحجز</span>
              <span className="font-bold text-success">
                {booking.status === "confirmed" ? "مؤكد" : booking.status}
              </span>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الإجمالي</span>
              <span className="font-bold">{price} ج.م</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المدفوع (عربون)</span>
              <span className="font-bold text-primary">{deposit} ج.م</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border">
              <span className="font-bold text-destructive">يُدفع في الملعب</span>
              <span className="font-bold text-destructive text-lg">{remaining} ج.م</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================
// +++ مكون قائمة الإدارة المركزية (Admins) +++
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
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("userData");
              onClose();
              navigate({ to: "/login" });
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" /> تسجيل خروج
          </button>
        </nav>
      </div>
    </div>
  );
}

// =========================================
// +++ مكون قائمة العميل (Customers) +++
// =========================================
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
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("userData");
              onClose();
              navigate({ to: "/login" });
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" /> تسجيل خروج
          </button>
        </nav>
      </div>
    </div>
  );
}

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

function MyBookingsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rawRole, setRawRole] = useState("customer");
  // +++ إضافة حالة المستخدم الحالي +++
  const [currentUser, setCurrentUser] = useState<{ _id: string; role: string } | null>(null);

  const [uploadModalPaymentId, setUploadModalPaymentId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cancelModalBookingId, setCancelModalBookingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // +++ حالات النوافذ المنبثقة للتقييم والتذكرة +++
  const [ticketBooking, setTicketBooking] = useState<BookingType | null>(null);
  const [reviewVenueId, setReviewVenueId] = useState<string | null>(null);
  const [reviewVenueName, setReviewVenueName] = useState<string>("");
  const [reviewedVenues, setReviewedVenues] = useState<string[]>([]);

  // +++ تم تغليف دالة loadBookings بـ useCallback لحل مشكلة الاعتمادات +++
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMyBookings();
      setBookings(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setRawRole(user.role || "customer");
        // تعيين المستخدم الحالي بمعرف موحد
        setCurrentUser({ ...user, _id: user._id || user.id });
      } catch (e) {
        console.error(e);
      }
    }
  }, [loadBookings]);

  // +++ جلب تقييمات المستخدم الحقيقية من الخادم لإخفاء زر التقييم للملاعب التي قيمها مسبقاً +++
  useEffect(() => {
    const fetchUserReviews = async () => {
      if (!currentUser || bookings.length === 0) return;

      // استخراج معرفات الملاعب الفريدة من حجوزات المستخدم المؤكدة
      const uniqueVenueIds = Array.from(
        new Set(
          bookings
            .filter((b) => b.status === "confirmed" && b.venue)
            .map((b) => (typeof b.venue === "object" ? b.venue._id : b.venue) as string),
        ),
      );

      const userReviewedVenues: string[] = [];

      // فحص كل ملعب لمعرفة ما إذا كان المستخدم قد قيمه باستخدام الواجهة الصحيحة
      for (const vId of uniqueVenueIds) {
        try {
          if (!vId) continue;
          const venueReviews = await fetchVenueReviews(vId);
          const hasReviewed = venueReviews.some(
            (r: FetchedReview) => r.user._id === currentUser._id,
          );
          if (hasReviewed) {
            userReviewedVenues.push(vId);
          }
        } catch (error) {
          console.error(`خطأ في فحص تقييمات الملعب ${vId}`, error);
        }
      }

      setReviewedVenues(userReviewedVenues);
    };

    fetchUserReviews();
  }, [currentUser, bookings]);

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

  const handleReviewSuccess = () => {
    if (reviewVenueId) {
      setReviewedVenues((prev) => [...prev, reviewVenueId]);
    }
  };

  const filteredBookings = useMemo(() => {
    const now = new Date();
    const filtered = bookings.filter((b) => {
      if (!b || !b.endTime) return false;
      const isCancelledOrExpired =
        b.status === "cancelled" || b.status === "expired" || b.paymentStatus === "expired";
      const isUpcoming = new Date(b.endTime) >= now && !isCancelledOrExpired;
      return tab === "upcoming" ? isUpcoming : !isUpcoming;
    });

    // +++ ترتيب الحجوزات بناءً على التبويب +++
    return filtered.sort((a, b) => {
      const dateA = new Date(a.startTime).getTime();
      const dateB = new Date(b.startTime).getTime();

      if (tab === "upcoming") {
        // القادمة: من الأقرب إلى الأبعد (تصاعدي)
        return dateA - dateB;
      } else {
        // السابقة: من الأحدث إلى الأقدم (تنازلي)
        return dateB - dateA;
      }
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

  const isAdmin = rawRole === "admin" || rawRole === "super_admin";
  const isOwner = rawRole === "owner";

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground">
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

      <Header title="حجوزاتي" onMenu={() => setIsMobileMenuOpen(true)} />

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

              const durationMinutes = Math.round(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60),
              );
              let durationText = `${durationMinutes} دقيقة`;
              if (durationMinutes === 60) durationText = "ساعة";
              else if (durationMinutes === 90) durationText = "ساعة ونصف";
              else if (durationMinutes === 120) durationText = "ساعتين";

              const price = b.totalPrice || 0;
              const deposit = b.deposit || price;
              const remaining = Math.max(price - deposit, 0);

              const venueName = typeof b.venue === "object" ? b.venue?.name : "المكان غير محدد";
              const venueIdStr = typeof b.venue === "object" ? b.venue?._id : b.venue;

              return (
                <article
                  key={b._id}
                  className="card-surface flex flex-col gap-3 p-4 transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                  onClick={() => {
                    if (b.status === "confirmed") {
                      setTicketBooking(b);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="gradient-primary flex size-12 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
                      <Trophy className="size-6" />
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold sm:text-base">
                          {venueName} - {b.court?.name || "الملعب غير محدد"}
                        </h2>
                        {getStatusBadge(
                          b.status,
                          b.paymentStatus,
                          b.endTime,
                          b.actualPaymentStatus,
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" /> {dateStr}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5" /> {timeStr}
                        </span>
                        <span className="flex items-center gap-1.5 text-foreground/80 font-bold">
                          <Hourglass className="size-3.5 text-primary" /> مدة الحجز: {durationText}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 sm:border-0 sm:pt-0">
                    <div className="flex flex-col gap-1 items-start sm:items-end">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground line-through opacity-70">
                        إجمالي الحجز: {price} ج.م
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-md">
                          المدفوع {remaining > 0 ? "(عربون)" : "(كامل)"}
                        </span>
                        <span className="text-sm font-black text-primary">{deposit} ج.م</span>
                      </div>

                      {!isCancelledOrExpired && remaining > 0 && (
                        <span className="text-[10px] font-bold text-destructive flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-sm border border-destructive/20 mt-1">
                          يُدفع في الملعب: {remaining} ج.م
                        </span>
                      )}
                      {!isCancelledOrExpired && remaining === 0 && (
                        <span className="text-[10px] font-bold text-success flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-sm border border-success/20 mt-1">
                          <CheckCircle2 className="size-3" /> مدفوع بالكامل
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {b.paymentId &&
                        b.status === "pending_payment" &&
                        b.actualPaymentStatus === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadModalPaymentId(b.paymentId!);
                            }}
                            className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/20"
                          >
                            <UploadCloud className="size-3.5" /> إرفاق إيصال الدفع
                          </button>
                        )}
                      {tab === "upcoming" && !isCancelledOrExpired && !isExpired && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelModalBookingId(b._id);
                          }}
                          className="rounded-xl border border-destructive/30 px-3 py-1.5 text-[11px] font-bold text-destructive transition hover:bg-destructive/10"
                        >
                          إلغاء الحجز
                        </button>
                      )}

                      {/* +++ التحقق الصحيح من الملاعب المقيّمة مسبقاً باستخدام الواجهة +++ */}
                      {tab === "past" &&
                        b.status === "confirmed" &&
                        venueIdStr &&
                        !reviewedVenues.includes(venueIdStr) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewVenueId(venueIdStr);
                              setReviewVenueName(venueName || "");
                            }}
                            className="flex items-center gap-1 rounded-xl bg-warning/10 px-3 py-1.5 text-[11px] font-bold text-warning border border-warning/20 transition hover:bg-warning hover:text-white"
                          >
                            <Star className="size-3.5" /> قيّم تجربتك
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
      <CancelConfirmModal
        isOpen={!!cancelModalBookingId}
        isCancelling={isCancelling}
        onClose={() => setCancelModalBookingId(null)}
        onConfirm={handleConfirmCancel}
      />

      <ReviewModal
        isOpen={!!reviewVenueId}
        venueId={reviewVenueId!}
        venueName={reviewVenueName}
        onClose={() => setReviewVenueId(null)}
        onSuccess={handleReviewSuccess}
      />

      <BookingTicketModal
        isOpen={!!ticketBooking}
        booking={ticketBooking}
        onClose={() => setTicketBooking(null)}
      />

      <Toaster position="top-center" />
    </div>
  );
}
