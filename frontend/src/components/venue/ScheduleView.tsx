import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Clock,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  X,
  User,
  Phone,
  DollarSign,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QuickBookingModal, type BookingFormData } from "./QuickBookingModal";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchCourts } from "@/api/courtApi";
// @ts-expect-error: API lacks TypeScript definitions
import { createBooking } from "@/api/bookingApi";
// @ts-expect-error: API lacks TypeScript definitions
import apiClient from "@/api/axiosConfig";

interface CourtData {
  _id: string;
  name: string;
  status: string;
  pricePerHour: number;
  sportType?: string;
}

interface BookingData {
  _id: string;
  startTime: string;
  bookingType: string;
  status: string;
  totalPrice?: number;
  deposit?: number;
  guestData?: { name: string; phone?: string };
  user?: { name: string; phone?: string };
  court?: { _id: string; name: string } | string;
}

const KIND_LABEL: Record<string, string> = {
  app: "حجز من التطبيق",
  manual: "حجز يدوي",
  maintenance: "صيانة",
};

const kindClass: Record<string, string> = {
  app: "bg-success/15 border-success/40 text-success",
  manual: "bg-info/15 border-info/40 text-info",
  maintenance: "bg-muted border-border text-muted-foreground",
};

const MORNING_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const EVENING_HOURS = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

// =========================================
// +++ نافذة تفاصيل الحجز +++
// =========================================
function BookingDetailsDialog({
  booking,
  onClose,
  onCancelBooking,
}: {
  booking: BookingData | null;
  onClose: () => void;
  onCancelBooking: (id: string) => void;
}) {
  if (!booking) return null;

  const bDate = new Date(booking.startTime);
  const name = booking.guestData?.name || booking.user?.name || "بدون اسم";
  const phone = booking.guestData?.phone || booking.user?.phone || "بدون رقم";

  const price = booking.totalPrice || 0;
  const deposit = booking.deposit || 0;
  const remaining = Math.max(price - deposit, 0);

  const typeLabel = KIND_LABEL[booking.bookingType || "app"];
  const typeClass = kindClass[booking.bookingType || "app"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-3xl bg-card shadow-2xl animate-in fade-in zoom-in-95 border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-lg font-extrabold text-foreground">تفاصيل الحجز</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background border border-border text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex justify-center mb-2">
            <span className={cn("rounded-lg px-4 py-1.5 text-xs font-bold border", typeClass)}>
              {typeLabel}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <User size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground">اسم العميل</p>
                <p className="truncate font-bold text-foreground text-sm">{name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Phone size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground">رقم الهاتف</p>
                <p className="truncate font-bold text-foreground text-sm" dir="ltr">
                  {phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground">تاريخ ووقت الحجز</p>
                <p className="font-bold text-foreground text-sm">
                  {bDate.toLocaleDateString("ar-EG", {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  <br />
                  <span className="text-primary">
                    {bDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">سعر الحجز الإجمالي:</span>
              <span className="font-bold text-foreground">{price} ج.م</span>
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">العربون المدفوع:</span>
              <span className="font-bold text-success">{deposit} ج.م</span>
            </div>
            <div className="border-t border-dashed border-border pt-3 flex items-center justify-between">
              <span className="font-extrabold text-foreground">المتبقي للتحصيل:</span>
              <span className="text-lg font-black text-destructive">{remaining} ج.م</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-border pt-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted transition"
            >
              إغلاق النافذة
            </button>
            <button
              onClick={() => onCancelBooking(booking._id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white hover:bg-destructive/90 transition"
            >
              <Trash2 size={16} />
              إلغاء هذا الحجز
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// =========================================

export function ScheduleView({ venueId }: { venueId: string }) {
  const [courts, setCourts] = useState<CourtData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");
  const [viewBooking, setViewBooking] = useState<BookingData | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [slot, setSlot] = useState<{
    courtId: string;
    courtName: string;
    hour: number;
    price: number;
    sportType?: string | undefined;
  } | null>(null);

  const formatDateForInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const loadData = useCallback(
    async (vId: string, dateObj: Date) => {
      try {
        setLoading(true);
        const courtsData = await fetchCourts(vId);
        const activeCourts = courtsData.filter((c: CourtData) => c.status === "active");
        setCourts(activeCourts);
        if (activeCourts.length > 0 && !selectedCourtId) {
          setSelectedCourtId(activeCourts[0]._id);
        }

        // +++ التعديل 1: جلب 3 أيام لضمان وجود فجر اليوم الحالي اللي بييجي مع اليوم السابق +++
        const prevDay = new Date(dateObj);
        prevDay.setDate(prevDay.getDate() - 1);
        const date0 = formatDateForInput(prevDay);

        const date1 = formatDateForInput(dateObj);

        const nextDay = new Date(dateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const date2 = formatDateForInput(nextDay);

        const [res0, res1, res2] = await Promise.all([
          apiClient.get(`/bookings?venue=${vId}&date=${date0}`),
          apiClient.get(`/bookings?venue=${vId}&date=${date1}`),
          apiClient.get(`/bookings?venue=${vId}&date=${date2}`),
        ]);

        const allBookings = [
          ...(res0.data?.data?.bookings || []),
          ...(res1.data?.data?.bookings || []),
          ...(res2.data?.data?.bookings || []),
        ];
        const uniqueBookings = Array.from(new Map(allBookings.map((b) => [b._id, b])).values());

        setBookings(uniqueBookings);
      } catch (err) {
        toast.error("حدث خطأ في جلب بيانات الجدول");
      } finally {
        setLoading(false);
      }
    },
    [selectedCourtId],
  );

  useEffect(() => {
    if (venueId) {
      loadData(venueId, selectedDate);
    }
  }, [venueId, selectedDate, loadData]);

  const getBookingForCell = (courtId: string, hour: number) => {
    return bookings.find((b) => {
      if (!b || !b.startTime) return false;
      const bDate = new Date(b.startTime);
      const startHour = bDate.getHours();
      const bCourtId = typeof b.court === "object" ? b.court?._id : b.court;

      const cellDate = new Date(selectedDate);

      // التعديل 2: الاعتماد على التطابق التقويمي لليوم فقط
      const isSameDay =
        bDate.getDate() === cellDate.getDate() &&
        bDate.getMonth() === cellDate.getMonth() &&
        bDate.getFullYear() === cellDate.getFullYear();

      return bCourtId === courtId && startHour === hour && b.status !== "cancelled" && isSameDay;
    });
  };

  const handleQuickBookClick = (
    courtId: string,
    courtName: string,
    hour: number,
    price: number,
    sportType?: string | undefined,
  ) => {
    setSlot({ courtId, courtName, hour, price, sportType });
    setIsModalOpen(true);
  };

  const confirmManualBooking = async (data: BookingFormData) => {
    if (!slot || !venueId) return;

    const startDateTime = new Date(selectedDate);

    // +++ التعديل 3: إزالة شرط إضافة اليوم، ليتم حجز الساعة في اليوم المختار مباشرة +++
    startDateTime.setHours(slot.hour, 0, 0, 0);

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1);

    try {
      await createBooking({
        venue: venueId,
        court: slot.courtId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        totalPrice: slot.price,
        deposit: data.deposit,
        bookingType: "manual",
        guestData: { name: data.name, phone: data.phone },
      });

      toast.success("تم تسجيل الحجز اليدوي بنجاح!");
      setIsModalOpen(false);
      loadData(venueId, selectedDate);
    } catch (err) {
      toast.error(err as string);
      throw err;
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من إلغاء هذا الحجز؟")) return;

    try {
      await apiClient.patch(`/bookings/${id}/cancel`);
      toast.success("تم إلغاء الحجز بنجاح");
      setViewBooking(null);
      loadData(venueId, selectedDate);
    } catch (err) {
      toast.error("حدث خطأ أثناء الإلغاء");
    }
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="p-10 text-center">
        <Clock className="inline h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeHours = timeTab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  return (
    <div className="flex flex-col gap-5">
      <section className="card-surface p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold">الجدول</h2>

            <div className="mt-3 flex items-center gap-1 rounded-xl bg-muted/50 p-1 w-fit">
              <button
                onClick={() => changeDate(-1)}
                className="rounded-lg p-1.5 hover:bg-background hover:shadow-sm transition"
              >
                <ChevronRight size={18} />
              </button>
              <input
                type="date"
                value={formatDateForInput(selectedDate)}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(new Date(e.target.value));
                }}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer text-center"
              />
              <button
                onClick={() => changeDate(1)}
                className="rounded-lg p-1.5 hover:bg-background hover:shadow-sm transition"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs mt-2 sm:mt-0">
            {(["app", "manual"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-[4px] border", kindClass[k])} />
                <span className="font-semibold">{KIND_LABEL[k]}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-2 rounded-xl border border-border bg-muted/50 p-1 md:max-w-sm">
          <button
            onClick={() => setTimeTab("morning")}
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
            onClick={() => setTimeTab("evening")}
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

        {/* --- نسخة الكمبيوتر --- */}
        <div className="mt-5 hidden overflow-x-auto md:block">
          <div className="min-w-[900px]">
            <div
              className="grid text-xs text-muted-foreground"
              style={{
                gridTemplateColumns: `130px repeat(${activeHours.length}, minmax(60px, 1fr))`,
              }}
            >
              <div />
              {activeHours.map((h) => (
                <div key={h} className="pb-2 text-center font-semibold">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {courts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد ملاعب نشطة في هذا المكان
              </p>
            ) : (
              courts.map((court) => (
                <div
                  key={court._id}
                  className="grid border-t border-border"
                  style={{
                    gridTemplateColumns: `130px repeat(${activeHours.length}, minmax(60px, 1fr))`,
                  }}
                >
                  <div className="flex items-center py-2 pl-1 text-sm font-bold">{court.name}</div>

                  {activeHours.map((hour) => {
                    const b = getBookingForCell(court._id, hour);
                    if (b) {
                      const kind = b.bookingType || "app";
                      return (
                        <div
                          key={hour}
                          onClick={() => setViewBooking(b)}
                          className={cn(
                            "m-1 overflow-hidden rounded-xl border p-2 text-right transition-transform hover:scale-[1.02] cursor-pointer",
                            kindClass[kind],
                          )}
                        >
                          <p className="truncate text-[11px] font-bold">
                            {b.guestData?.name || b.user?.name || "بدون اسم"}
                          </p>
                          <p className="truncate text-[10px] opacity-80">
                            {String(hour).padStart(2, "0")}:00
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={hour}
                        className="group relative m-1 rounded-xl border border-dashed border-border bg-surface/60"
                      >
                        <button
                          onClick={() =>
                            handleQuickBookClick(
                              court._id,
                              court.name,
                              hour,
                              court.pricePerHour,
                              court.sportType,
                            )
                          }
                          className="absolute inset-0 grid place-items-center rounded-xl text-[11px] font-bold text-primary opacity-0 transition-opacity duration-200 group-hover:bg-primary/10 group-hover:opacity-100"
                        >
                          حجز
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- نسخة الموبايل --- */}
        <div className="mt-5 md:hidden">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
            {courts.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCourtId(c._id)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                  c._id === selectedCourtId
                    ? "gradient-primary text-primary-foreground"
                    : "border border-border bg-surface text-muted-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {activeHours.map((hour) => {
              const currentCourt = courts.find((c) => c._id === selectedCourtId);
              if (!currentCourt) return null;

              const b = getBookingForCell(selectedCourtId, hour);

              return (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                  {b ? (
                    <div
                      onClick={() => setViewBooking(b)}
                      className={cn(
                        "min-w-0 rounded-xl border p-3 cursor-pointer transition hover:opacity-90",
                        kindClass[b.bookingType || "app"],
                      )}
                    >
                      <p className="truncate text-sm font-bold">
                        {b.guestData?.name || b.user?.name || "بدون اسم"}
                      </p>
                      <p className="truncate text-[11px] opacity-80">
                        {KIND_LABEL[b.bookingType || "app"]}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        handleQuickBookClick(
                          selectedCourtId,
                          currentCourt.name,
                          hour,
                          currentCourt.pricePerHour,
                          currentCourt.sportType,
                        )
                      }
                      className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface/60 p-3 text-xs font-bold text-primary"
                    >
                      <Plus className="h-4 w-4" /> حجز سريع
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <BookingDetailsDialog
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
        onCancelBooking={handleCancelBooking}
      />

      <QuickBookingModal
        open={isModalOpen}
        slotLabel={
          slot ? `${slot.courtName} · الساعة ${String(slot.hour).padStart(2, "0")}:00` : undefined
        }
        slotPrice={slot?.price ?? 0}
        defaultSport={slot?.sportType}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmManualBooking}
      />
    </div>
  );
}
