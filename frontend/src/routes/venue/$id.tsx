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
  Info,
  X,
  Hourglass,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type MosqueIconProps = {
  className?: string;
};

const MosqueIcon = ({ className }: MosqueIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 21h18" />
    <path d="M5 21v-7h14v7" />
    <path d="M4 14c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2" />
    <path d="M7 12c.5-3 2.4-5 5-5s4.5 2 5 5" />
    <path d="M12 7V4" />
    <path d="M10.8 4h2.4" />
    <path d="M8 14v7" />
    <path d="M12 14v7" />
    <path d="M16 14v7" />
    <path d="M5 12V7h2v5" />
    <path d="M5 7h2" />
    <path d="M19 12V7h-2v5" />
    <path d="M17 7h2" />
  </svg>
);

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
  priceMorning?: number;
  priceEvening?: number;
  pricePerHour?: number;
  status?: string;
  image?: string;
}

interface VenueType {
  _id: string;
  name: string;
  description?: string;
  openTime?: string;
  closeTime?: string; // +++ تمت الإضافة +++
  eveningStartTime?: string;
  workingDays?: number[]; // +++ تمت الإضافة +++
  phone?: string;
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
  endTime: string;
  status: string;
}

interface PaymentDataType {
  id: string;
  method: string;
  amount: number;
  expiresAt: string;
  instructions: {
    identifier: string;
    accountName: string;
  } | null;
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

type AmenityIcon = typeof Car | typeof MosqueIcon;

const AMENITY_ICONS: Record<string, AmenityIcon> = {
  "موقف سيارات": Car,
  دش: ShowerHead,
  "واي فاي": Wifi,
  كافيتيريا: Coffee,
  "غرف تغيير": Shirt,
  "كرات وليات": Dumbbell,
  مدربين: Dumbbell,
  مسجد: MosqueIcon,
};

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

  const [bookingDetails, setBookingDetails] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"vodafone_cash" | "instapay">(
    "vodafone_cash",
  );

  const [showInfoModal, setShowInfoModal] = useState(false);

  const days = useMemo(getDays, []);
  const [selectedCourt, setSelectedCourt] = useState<CourtType | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");

  const [selectedDuration, setSelectedDuration] = useState<60 | 120>(60);

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

    const durationText = selectedDuration === 60 ? "ساعة" : "ساعتين";

    return {
      dayText: `${weekday}، ${label}`,
      mobileText: `${weekday} · ${selectedSlot} (${durationText})`,
      timeText: `${selectedSlot} (${durationText})`,
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

        const newBookedSlots: string[] = [];

        bookingsArray.forEach((b: BookingResponse) => {
          if (!b || !b.startTime || !b.endTime) return;
          if (b.status === "cancelled" || b.status === "expired") return;

          const start = new Date(b.startTime);
          const end = new Date(b.endTime);

          if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

          const current = new Date(start);
          while (current < end) {
            newBookedSlots.push(`${String(current.getHours()).padStart(2, "0")}:00`);
            current.setHours(current.getHours() + 1);
          }
        });

        setBookedSlots(Array.from(new Set(newBookedSlots)));
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

  // +++ توليد الساعات ديناميكياً استناداً إلى بيانات النادي +++
  const slots = useMemo(() => {
    if (!days || !days[selectedDay] || !days[selectedDay].dateObj || !venue) return [];

    const openHr = parseInt((venue.openTime || "08:00").split(":")[0] ?? "08", 10);
    const closeHr = parseInt((venue.closeTime || "02:00").split(":")[0] ?? "02", 10);
    const eveningHr = parseInt((venue.eveningStartTime || "18:00").split(":")[0] ?? "18", 10);

    const generatedSlots = [];
    let currentHr = timeTab === "morning" ? openHr : eveningHr;
    const endLimit = timeTab === "morning" ? eveningHr : closeHr;

    let iters = 0;
    while (currentHr !== endLimit && iters < 24) {
      const timeStr = `${String(currentHr).padStart(2, "0")}:00`;
      generatedSlots.push(timeStr);
      currentHr = (currentHr + 1) % 24;
      iters++;
    }

    const realNow = new Date();
    const selectedDate = new Date(days[selectedDay].dateObj);

    return generatedSlots.map((time) => {
      const hourNum = parseInt(time.split(":")[0] || "0", 10);
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hourNum, 0, 0, 0);
      if (hourNum < 8) slotTime.setDate(slotTime.getDate() + 1);

      const diffInMinutes = (slotTime.getTime() - realNow.getTime()) / (1000 * 60);
      const isPastOrTooClose = diffInMinutes < 30;

      let hasConflict = false;
      const hoursNeeded = Math.ceil(selectedDuration / 60);

      for (let i = 0; i < hoursNeeded; i++) {
        const checkHour = (hourNum + i) % 24;
        const checkTimeStr = `${String(checkHour).padStart(2, "0")}:00`;
        if (bookedSlots.includes(checkTimeStr)) {
          hasConflict = true;
          break;
        }
      }

      return { time, booked: hasConflict || isPastOrTooClose || bookedSlots.includes(time) };
    });
  }, [bookedSlots, timeTab, selectedDay, days, selectedDuration, venue]);

  const total = useMemo(() => {
    if (!selectedCourt || !selectedSlot) return 0;

    const eveningStartHour = parseInt(
      (venue?.eveningStartTime || "18:00").split(":")[0] ?? "18",
      10,
    );
    const morningStartHour = parseInt((venue?.openTime || "08:00").split(":")[0] ?? "08", 10);

    const eveningPrice =
      selectedCourt.priceEvening !== undefined
        ? selectedCourt.priceEvening
        : selectedCourt.pricePerHour || 0;
    const morningPrice =
      selectedCourt.priceMorning !== undefined
        ? selectedCourt.priceMorning
        : selectedCourt.pricePerHour || 0;

    let totalPrice = 0;
    const durationBlocks = selectedDuration / 30;

    let currentHour = parseInt(selectedSlot.split(":")[0] || "0", 10);
    let currentMinute = parseInt(selectedSlot.split(":")[1] || "0", 10);

    for (let i = 0; i < durationBlocks; i++) {
      const isCurrentBlockEvening =
        currentHour >= eveningStartHour || currentHour < morningStartHour;

      const blockPrice = isCurrentBlockEvening ? eveningPrice / 2 : morningPrice / 2;
      totalPrice += blockPrice;

      currentMinute += 30;
      if (currentMinute >= 60) {
        currentMinute -= 60;
        currentHour = (currentHour + 1) % 24;
      }
    }

    return totalPrice;
  }, [selectedCourt, selectedSlot, venue, selectedDuration]);

  const deposit = useMemo(() => {
    if (total <= 0) return 0;
    return total / 2;
  }, [total]);

  useEffect(() => {
    if (selectedSlot) {
      const slotObj = slots.find((s) => s.time === selectedSlot);
      if (slotObj && slotObj.booked) {
        setSelectedSlot(null);
      }
    }
  }, [selectedDuration, slots, selectedSlot]);

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
      endDateTime.setMinutes(startDateTime.getMinutes() + selectedDuration);

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
        if (response.data.booking) {
          setBookingDetails({
            startTime: response.data.booking.startTime,
            endTime: response.data.booking.endTime,
          });
        }
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

  const dummyAmenities = ["مسجد", "موقف سيارات", "غرف تغيير"];

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
            {venue.phone && (
              <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
                <Phone className="size-4 shrink-0" />
                <a href={`tel:${venue.phone}`} dir="ltr" className="hover:underline">
                  {venue.phone}
                </a>
              </p>
            )}

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
                      "flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold transition",
                      selectedCourt?._id === c._id
                        ? "gradient-primary border-transparent text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span>{c.name}</span>
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
              {/* +++ تعطيل الأيام المغلقة بناءً على أيام العمل +++ */}
              {days.map((d) => {
                const isWorkingDay = venue.workingDays
                  ? venue.workingDays.includes(d.dateObj.getDay())
                  : true;
                return (
                  <button
                    key={d.index}
                    disabled={!isWorkingDay}
                    onClick={() => {
                      setSelectedDay(d.index);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      "flex w-20 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-xs transition",
                      !isWorkingDay
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : selectedDay === d.index
                          ? "gradient-primary border-transparent text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span className="font-bold">{d.weekday}</span>
                    <span className="text-[11px] opacity-80">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card-surface space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <Hourglass className="size-4 text-primary" /> حدد المدة
            </h2>
            <div className="flex gap-2">
              {[
                { value: 60, label: "ساعة" },
                { value: 120, label: "ساعتين" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDuration(opt.value as 60 | 120)}
                  className={cn(
                    "flex-1 py-2 rounded-xl border text-sm font-bold transition",
                    selectedDuration === opt.value
                      ? "gradient-primary border-transparent text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              سيتم استبعاد الأوقات التي لا تسمح بهذه المدة المحددة.
            </p>
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
                الصباح
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
                المساء
              </button>
            </div>
            {slots.length > 0 ? (
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
            ) : (
              <p className="text-center text-sm font-bold text-muted-foreground border border-dashed rounded-xl py-6">
                لا توجد ساعات متاحة في هذا التوقيت
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
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

              <div className="border-t border-dashed border-border pt-3 mt-2">
                <p className="flex justify-between">
                  <span>الإجمالي</span>
                  <span className="font-bold text-foreground">
                    {total > 0 ? `${total} ج.م` : "--"}
                  </span>
                </p>
                {total > 0 && (
                  <p className="flex justify-between mt-2">
                    <span className="font-bold text-primary">العربون المطلوب الآن</span>
                    <span className="font-black text-primary text-lg">{deposit} ج.م</span>
                  </p>
                )}
                {total > 0 && deposit < total && (
                  <p className="text-[10px] text-muted-foreground mt-1 text-left">
                    يتم سداد باقي المبلغ ({total - deposit} ج.م) في الملعب
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-border pt-3">
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
                  محفظة
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
              {bookingLoading ? "جارٍ المتابعة..." : "المتابعة لدفع العربون"}
            </button>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-col gap-2 w-full border-b border-border pb-2">
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
                محفظة
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
              {total > 0 ? (
                <div className="flex flex-col mt-1">
                  <span className="text-[10px] text-muted-foreground opacity-90">
                    الإجمالي: {total} ج.م
                  </span>
                  <span className="text-sm font-black text-primary">عربون : {deposit} ج.م</span>
                </div>
              ) : (
                <p className="text-sm font-bold text-primary">--</p>
              )}
            </div>
            <button
              onClick={confirm}
              disabled={!selectedSlot || bookingLoading}
              className="gradient-primary rounded-xl px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40 whitespace-nowrap"
            >
              {bookingLoading ? "متابعة..." : "دفع العربون"}
            </button>
          </div>
        </div>
      </div>

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
                <Wallet className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  النظام يتطلب دفع <strong className="text-foreground">عربون</strong> فقط لتأكيد
                  الحجز، وباقي المبلغ يتم سداده في الملعب.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
                <span>
                  يجب تحويل مبلغ العربون <strong className="text-foreground">بالكسور</strong> لضمان
                  التأكيد الآلي والسريع للحجز.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <Clock className="size-4 text-destructive shrink-0 mt-0.5" />
                <span>
                  يتم <strong className="text-foreground">إلغاء طلب الحجز تلقائياً</strong> إذا لم
                  يتم إتمام التحويل خلال 10 دقائق.
                </span>
              </li>
              <li className="flex gap-2 items-start">
                <AlertCircle className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">لا يمكن استرداد العربون</strong> في حالة
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
        bookingDetails={bookingDetails}
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
