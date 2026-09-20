import { useMemo, useState, useEffect } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  MapPin,
  Star,
  Trophy,
  Car,
  ShowerHead,
  Wifi,
  Coffee,
  Shirt,
  Dumbbell,
  CalendarDays,
  Clock,
  AlertCircle,
  Sun,
  Moon,
  Wallet,
  Info, // +++ إضافة أيقونة Info +++
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

// @ts-expect-error APIs without TS definitions
import { fetchVenueById } from "@/api/venueApi";
// @ts-expect-error APIs without TS definitions
import { fetchBookedSlots, createBooking } from "@/api/bookingApi";
import { PaymentModal } from "@/components/venue/PaymentModal";
// @ts-expect-error API has no TypeScript declaration
import { BACKEND_URL } from "@/api/axiosConfig";

interface CourtType {
  _id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
  status?: string;
  image?: string;
}

interface VenueType {
  _id: string;
  name: string;
  description?: string;
  address?: {
    city: string;
    area: string;
    details?: string;
  };
  courts?: CourtType[];
  owner?: string;
  image?: string;
}

interface BookingResponse {
  startTime: string;
  status: string;
}

interface PaymentDataType {
  id: string;
  method: string;
  amount: number;
  expiresAt: string;
  instructions: {
    vodafoneCashNumber: string;
    instaPayAddress: string;
  };
}

const getImageUrl = (imagePath?: string) => {
  if (!imagePath) return "/default-placeholder.png";
  if (imagePath.startsWith("http")) return imagePath;
  return `${BACKEND_URL}${imagePath}`;
};

export const Route = createFileRoute("/venue/$id")({
  head: () => ({
    meta: [{ title: "تفاصيل الملعب | GoalSmash" }],
  }),
  component: VenueDetailsPage,
});

const AMENITY_ICONS: Record<string, typeof Car> = {
  "موقف سيارات": Car,
  دش: ShowerHead,
  "واي فاي": Wifi,
  كافيتيريا: Coffee,
  "غرف تغيير": Shirt,
  "كرات وليات": Dumbbell,
  مدربين: Dumbbell,
};

const MORNING_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];
const EVENING_SLOTS = [
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
];
const DAYS_COUNT = 7;

function getDays() {
  const now = new Date();
  const logicalToday = new Date(now);
  logicalToday.setHours(logicalToday.getHours() - 8);

  return Array.from({ length: DAYS_COUNT }, (_, i) => {
    const d = new Date(logicalToday);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return {
      index: i,
      dateObj: d,
      weekday: d.toLocaleDateString("ar-EG", { weekday: "long" }),
      label: d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" }),
    };
  });
}

function VenueDetailsPage() {
  const { id: venueId } = Route.useParams();
  const navigate = useNavigate();

  const [venue, setVenue] = useState<VenueType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentDataType | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"vodafone_cash" | "instapay">(
    "vodafone_cash",
  );

  const [showInfoModal, setShowInfoModal] = useState(false); // +++ حالة ظهور مودال التعليمات +++

  const days = useMemo(getDays, []);
  const [selectedCourt, setSelectedCourt] = useState<CourtType | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");

  const getBookingSummary = () => {
    if (!days || !days[selectedDay]) return { dayText: "", mobileText: "", timeText: "" };
    if (!selectedSlot) {
      return {
        dayText: `${days[selectedDay]!.weekday}، ${days[selectedDay]!.label}`,
        mobileText: "اختر ساعة للمتابعة",
        timeText: "لم تُحدد",
      };
    }

    const hourNum = parseInt(selectedSlot.split(":")[0] || "0", 10);
    const actualDateObj = new Date(days[selectedDay]!.dateObj);

    if (hourNum < 8) actualDateObj.setDate(actualDateObj.getDate() + 1);

    const weekday = actualDateObj.toLocaleDateString("ar-EG", { weekday: "long" });
    const label = actualDateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });

    return {
      dayText: `${weekday}، ${label}`,
      mobileText: `${weekday} · ${selectedSlot}`,
      timeText: selectedSlot,
    };
  };

  const summary = getBookingSummary();

  useEffect(() => {
    const getVenue = async () => {
      try {
        setLoading(true);
        const data = await fetchVenueById(venueId);
        if (data.courts)
          data.courts = data.courts.filter((c: CourtType) => c.status !== "inactive");
        setVenue(data);
        if (data.courts && data.courts.length > 0) setSelectedCourt(data.courts[0]);
      } catch (err) {
        setError(err as string);
      } finally {
        setLoading(false);
      }
    };
    getVenue();
  }, [venueId]);

  useEffect(() => {
    if (!selectedCourt) return;
    let isMounted = true;
    const fetchBookings = async () => {
      try {
        const selectedDate = days[selectedDay]!.dateObj;
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        const response = await fetchBookedSlots(selectedCourt._id, dateString);
        const bookingsArray = Array.isArray(response)
          ? response
          : response?.data?.bookings || response?.bookings || [];

        if (!isMounted) return;

        const bookedHours = bookingsArray
          .filter(
            (b: BookingResponse) =>
              b && b.startTime && typeof b.startTime === "string" && b.status !== "cancelled",
          )
          .map((b: BookingResponse) => {
            try {
              const dateObj = new Date(b.startTime);
              if (isNaN(dateObj.getTime())) return null;
              return `${String(dateObj.getHours()).padStart(2, "0")}:00`;
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);

        setBookedSlots(bookedHours);
      } catch (err) {
        setBookedSlots([]);
      } finally {
        setSelectedSlot(null);
      }
    };

    fetchBookings();
    return () => {
      isMounted = false;
    };
  }, [selectedCourt, selectedDay, days]);

  const slots = useMemo(() => {
    const activeSlots = timeTab === "morning" ? MORNING_SLOTS : EVENING_SLOTS;
    const realNow = new Date();
    if (!days || !days[selectedDay] || !days[selectedDay].dateObj) return [];
    const selectedDate = new Date(days[selectedDay].dateObj);

    return activeSlots.map((time) => {
      const [hours] = time.split(":");
      const hourNum = parseInt(hours || "0", 10);
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hourNum, 0, 0, 0);
      if (hourNum < 8) slotTime.setDate(slotTime.getDate() + 1);

      const diffInMinutes = (slotTime.getTime() - realNow.getTime()) / (1000 * 60);
      const isPastOrTooClose = diffInMinutes < 30;

      return { time, booked: bookedSlots.includes(time) || isPastOrTooClose };
    });
  }, [bookedSlots, timeTab, selectedDay, days]);

  const total = selectedCourt ? selectedCourt.pricePerHour : 0;

  const confirm = async () => {
    if (!selectedSlot || !selectedCourt || !venue || !days || !days[selectedDay]) return;
    setBookingLoading(true);
    try {
      const [hours] = selectedSlot.split(":");
      const hourNum = parseInt(hours || "0", 10);
      const startDateTime = new Date(days[selectedDay]!.dateObj);
      startDateTime.setHours(hourNum, 0, 0, 0);
      if (hourNum < 8) startDateTime.setDate(startDateTime.getDate() + 1);

      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + 1);

      const response = await createBooking({
        venue: venue._id,
        court: selectedCourt._id,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        bookingType: "app",
        paymentMethod: selectedPaymentMethod,
      });

      if (response.data && response.data.payment) {
        setPaymentData(response.data.payment);
        setShowPaymentModal(true);
      } else {
        toast.success(`تم تأكيد الحجز في ${venue.name} بنجاح!`);
        navigate({ to: "/my-bookings" });
      }
    } catch (err) {
      toast.error(err as string);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Clock className="size-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (error || !venue)
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground"
      >
        <AlertCircle className="size-10 text-destructive" />
        <h1 className="text-lg font-bold">الملعب غير موجود أو حدث خطأ</h1>
        <Link
          to="/explore"
          className="gradient-primary rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          العودة لتصفح الملاعب
        </Link>
      </div>
    );

  const dummyAmenities = ["موقف سيارات", "واي فاي", "غرف تغيير"];

  const locationText = [venue.address?.city, venue.address?.area, venue.address?.details]
    .filter(Boolean)
    .join("، ");

  const displayImage = selectedCourt?.image || venue.image;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-32 text-foreground lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted"
          >
            <ArrowRight className="size-4" /> عودة
          </button>
          <span className="truncate text-sm font-bold">{venue.name}</span>
        </div>
      </header>

      <div className="relative flex h-52 items-center justify-center bg-muted overflow-hidden sm:h-72">
        {displayImage ? (
          <img
            src={getImageUrl(displayImage)}
            alt={selectedCourt?.name || venue.name}
            className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500"
            key={displayImage}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-900/40" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        {!displayImage && <Trophy className="relative z-10 size-16 text-primary-foreground/40" />}
        {selectedCourt && (
          <span className="absolute right-4 top-4 rounded-lg bg-background/85 px-3 py-1 text-xs font-bold backdrop-blur">
            {selectedCourt.sportType === "padel" ? "بادل" : "خماسي"}
          </span>
        )}
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card-surface space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-lg font-bold sm:text-xl">{venue.name}</h1>
              <span className="flex items-center gap-1 text-sm font-bold text-warning">
                <Star className="size-4 fill-current" /> 4.8
              </span>
            </div>

            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 mt-0.5 shrink-0" /> <span>{locationText}</span>
            </p>

            {venue.description && (
              <p className="text-sm leading-7 text-muted-foreground">{venue.description}</p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {dummyAmenities.map((a) => {
                const Icon = AMENITY_ICONS[a] ?? Dumbbell;
                return (
                  <span
                    key={a}
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                  >
                    <Icon className="size-3.5" /> {a}
                  </span>
                );
              })}
            </div>
          </section>

          {venue.courts && venue.courts.length > 1 && (
            <section className="card-surface space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
                <Trophy className="size-4 text-primary" /> اختر الملعب
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {venue.courts.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => {
                      setSelectedCourt(c);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition",
                      selectedCourt?._id === c._id
                        ? "gradient-primary border-transparent text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="card-surface space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <CalendarDays className="size-4 text-primary" /> اختر اليوم
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button
                  key={d.index}
                  onClick={() => {
                    setSelectedDay(d.index);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    "flex w-20 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-xs transition",
                    selectedDay === d.index
                      ? "gradient-primary border-transparent text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span className="font-bold">{d.weekday}</span>
                  <span className="text-[11px] opacity-80">{d.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <Clock className="size-4 text-primary" /> اختر الساعة
            </h2>
            <div className="mb-4 flex gap-2 rounded-xl border border-border bg-muted/50 p-1">
              <button
                onClick={() => {
                  setTimeTab("morning");
                  setSelectedSlot(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-bold transition",
                  timeTab === "morning"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="h-4 w-4" />
                الصباح (8 ص - 6 م)
              </button>
              <button
                onClick={() => {
                  setTimeTab("evening");
                  setSelectedSlot(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-bold transition",
                  timeTab === "evening"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="h-4 w-4" />
                المساء (7 م - 7 ص)
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.time}
                  disabled={s.booked}
                  onClick={() => setSelectedSlot(s.time)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-bold transition",
                    s.booked
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground/60 line-through"
                      : selectedSlot === s.time
                        ? "gradient-primary border-transparent text-primary-foreground"
                        : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              الساعات المشطوبة محجوزة مسبقاً أو الوقت لم يعد كافياً للحجز.
            </p>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="card-surface sticky top-20 space-y-4 p-5">
            <h2 className="text-sm font-bold">ملخص الحجز</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex justify-between">
                <span>المكان</span>
                <span className="font-bold text-foreground">{venue.name}</span>
              </p>
              <p className="flex justify-between">
                <span>الملعب</span>
                <span className="font-bold text-foreground">
                  {selectedCourt?.name || "لم يُحدد"}
                </span>
              </p>
              <p className="flex justify-between items-center">
                <span>اليوم</span>
                <span className="font-bold text-foreground text-left">{summary.dayText}</span>
              </p>
              <p className="flex justify-between items-center">
                <span>الساعة</span>
                <span className="font-bold text-foreground text-left" dir="ltr">
                  {summary.timeText}
                </span>
              </p>
              <p className="flex justify-between border-t border-border pt-2">
                <span>الإجمالي</span>
                <span className="font-bold text-primary">{total} ج.م</span>
              </p>
            </div>
            <div className="border-t border-border pt-3">
              {/* +++ زر تعليمات الحجز في نسخة الكمبيوتر +++ */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Wallet className="size-3" /> اختر طريقة الدفع
                </p>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="text-primary hover:bg-primary/20 transition flex items-center gap-1 text-[11px] font-bold bg-primary/10 px-2 py-1 rounded-md"
                >
                  <Info className="size-3" /> تعليمات الحجز
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPaymentMethod("vodafone_cash")}
                  className={cn(
                    "flex-1 py-2 px-2 rounded-lg border text-[11px] font-bold transition",
                    selectedPaymentMethod === "vodafone_cash"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  فودافون كاش
                </button>
                <button
                  onClick={() => setSelectedPaymentMethod("instapay")}
                  className={cn(
                    "flex-1 py-2 px-2 rounded-lg border text-[11px] font-bold transition",
                    selectedPaymentMethod === "instapay"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  إنستا باي
                </button>
              </div>
            </div>
            <button
              onClick={confirm}
              disabled={!selectedSlot || bookingLoading}
              className="gradient-primary w-full rounded-xl py-3 text-sm font-bold text-primary-foreground transition disabled:opacity-40"
            >
              {bookingLoading ? "جارٍ المتابعة..." : "المتابعة للدفع"}
            </button>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-col gap-2 w-full border-b border-border pb-2">
            {/* +++ زر تعليمات الحجز في نسخة الموبايل +++ */}
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-bold text-muted-foreground">اختر طريقة الدفع</span>
              <button
                onClick={() => setShowInfoModal(true)}
                className="text-primary hover:bg-primary/20 transition flex items-center gap-1 text-[11px] font-bold bg-primary/10 px-2 py-1 rounded-md"
              >
                <Info className="size-3" /> التعليمات والسياسات
              </button>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setSelectedPaymentMethod("vodafone_cash")}
                className={cn(
                  "flex-1 py-2 px-2 rounded-lg border text-xs font-bold transition",
                  selectedPaymentMethod === "vodafone_cash"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                فودافون كاش
              </button>
              <button
                onClick={() => setSelectedPaymentMethod("instapay")}
                className={cn(
                  "flex-1 py-2 px-2 rounded-lg border text-xs font-bold transition",
                  selectedPaymentMethod === "instapay"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                إنستا باي
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <p>{summary.mobileText}</p>
              <p className="text-sm font-bold text-primary">{total} ج.م</p>
            </div>
            <button
              onClick={confirm}
              disabled={!selectedSlot || bookingLoading}
              className="gradient-primary rounded-xl px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {bookingLoading ? "متابعة..." : "المتابعة للدفع"}
            </button>
          </div>
        </div>
      </div>

      {/* +++ مودال تعليمات الحجز وسياسة الإلغاء +++ */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          dir="rtl"
        >
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowInfoModal(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-card shadow-2xl border border-border animate-in fade-in zoom-in-95 p-5">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="font-bold flex items-center gap-2 text-foreground">
                <Info className="size-5 text-primary" /> تعليمات الحجز والدفع
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground transition"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="text-sm text-muted-foreground space-y-4 font-semibold leading-relaxed">
              <li className="flex gap-2 items-start">
                <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                <span>
                  يجب تحويل المبلغ <strong className="text-foreground">بالكسور</strong> لضمان
                  التأكيد الآلي والسريع للحجز.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <Clock className="size-4 text-destructive shrink-0 mt-0.5" />
                <span>
                  يتم <strong className="text-foreground">إلغاء الحجز تلقائياً</strong> إذا لم يتم
                  إتمام التحويل خلال 10 دقائق من طلب الحجز.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  عند الإلغاء قبل موعد الحجز بـ{" "}
                  <strong className="text-foreground">24 ساعة فأكثر</strong>، يتم خصم 50% من المبلغ
                  المدفوع.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">لا يمكن استرداد أي مبلغ</strong> في حالة
                  الإلغاء قبل موعد الحجز بمدة أقل من 24 ساعة.
                </span>
              </li>
            </ul>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-6 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        open={showPaymentModal}
        paymentData={paymentData}
        onClose={() => {
          setShowPaymentModal(false);
          navigate({ to: "/my-bookings" });
        }}
        onSuccess={() => {
          setShowPaymentModal(false);
          navigate({ to: "/my-bookings" });
        }}
      />
      <Toaster position="top-center" />
    </div>
  );
}
