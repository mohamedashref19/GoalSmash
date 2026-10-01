import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CalendarDays,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Loader2,
  CheckCircle2, // +++ أيقونة الخالص +++
  User,
  Phone,
  Hourglass,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// @ts-expect-error APIs without TS definitions
import { fetchAllVenues, fetchBookingsForAdminSchedule } from "@/api/adminApi";
// @ts-expect-error API has no TypeScript declaration
import { fetchCourts } from "@/api/courtApi";

interface VenueData {
  _id: string;
  name: string;
}

interface CourtData {
  _id: string;
  name: string;
  status: string;
  sportType?: string;
}

interface BookingData {
  _id: string;
  startTime: string;
  endTime: string;
  bookingType: string;
  status: string;
  totalPrice?: number;
  deposit?: number;
  notes?: string;
  guestData?: { name: string; phone?: string };
  user?: { name: string; phone?: string };
  court?: { _id: string; name: string } | string;
}

const KIND_LABEL: Record<string, string> = {
  app: "تطبيق",
  manual: "يدوي",
};

const kindClass: Record<string, string> = {
  app: "bg-success/20 border-success/50 text-emerald-950",
  manual: "bg-info/20 border-info/50 text-blue-950",
};

const MORNING_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const EVENING_HOURS = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

// =========================================
// +++ نافذة تفاصيل الحجز (للعرض فقط للآدمن) +++
// =========================================
function AdminBookingDetailsDialog({
  booking,
  onClose,
}: {
  booking: BookingData | null;
  onClose: () => void;
}) {
  if (!booking) return null;

  const bDate = new Date(booking.startTime);
  const eDate = new Date(booking.endTime);
  const name = booking.guestData?.name || booking.user?.name || "بدون اسم";
  const phone = booking.guestData?.phone || booking.user?.phone || "بدون رقم";

  const price = booking.totalPrice || 0;
  const deposit = booking.deposit || 0;
  const remaining = Math.max(price - deposit, 0);

  const typeLabel = KIND_LABEL[booking.bookingType || "app"];
  const typeClass = kindClass[booking.bookingType || "app"];

  const durationMinutes = Math.round((eDate.getTime() - bDate.getTime()) / (1000 * 60));
  let durationText = `${durationMinutes} دقيقة`;
  if (durationMinutes === 60) durationText = "ساعة";
  else if (durationMinutes === 90) durationText = "ساعة ونصف";
  else if (durationMinutes === 120) durationText = "ساعتين";

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

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Hourglass size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground">مدة الحجز</p>
                <p className="truncate font-bold text-foreground text-sm">{durationText}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">سعر الحجز الإجمالي:</span>
              <span className="font-bold text-foreground">{price} ج.م</span>
            </div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">
                المدفوع {remaining > 0 ? "(عربون)" : "(كامل)"}:
              </span>
              <span className="font-bold text-success">{deposit} ج.م</span>
            </div>
            <div className="border-t border-dashed border-border pt-3 flex items-center justify-between">
              <span className="font-extrabold text-foreground">المتبقي للتحصيل:</span>
              <span
                className={cn(
                  "text-lg font-black flex items-center gap-1",
                  remaining > 0 ? "text-destructive" : "text-success",
                )}
              >
                {remaining > 0 ? (
                  `${remaining} ج.م`
                ) : (
                  <>
                    <CheckCircle2 className="size-5" /> خالص
                  </>
                )}
              </span>
            </div>
            {remaining > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                يقوم المالك بتأكيد تحصيل هذا المبلغ في الملعب.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted transition"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// =========================================

export function AdminScheduleView() {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [courts, setCourts] = useState<CourtData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");

  // +++ إضافة حالة لفتح نافذة التفاصيل +++
  const [viewBooking, setViewBooking] = useState<BookingData | null>(null);
  const [selectedCourtIdForMobile, setSelectedCourtIdForMobile] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetchAllVenues()
      .then((data: VenueData[]) => {
        setVenues(data);
        const firstVenue = data?.[0];
        if (firstVenue) {
          setSelectedVenueId(firstVenue._id);
        }
      })
      .catch(() => toast.error("فشل في جلب قائمة الأندية"))
      .finally(() => setLoading(false));
  }, []);

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

  const loadScheduleData = useCallback(async (vId: string, dateObj: Date) => {
    try {
      setLoading(true);
      const activeCourts = await fetchCourts(vId);
      const filteredCourts = activeCourts.filter((c: CourtData) => c.status === "active");
      setCourts(filteredCourts);
      if (filteredCourts.length > 0) {
        setSelectedCourtIdForMobile(filteredCourts[0]._id);
      }

      const dateStr = formatDateForInput(dateObj);
      const fetchedBookings = await fetchBookingsForAdminSchedule(vId, dateStr);
      setBookings(fetchedBookings || []);
    } catch (err) {
      toast.error("حدث خطأ في جلب بيانات الجدول");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedVenueId) {
      loadScheduleData(selectedVenueId, selectedDate);
    }
  }, [selectedVenueId, selectedDate, loadScheduleData]);

  const getBookingForCell = (courtId: string, hour: number) => {
    return bookings.find((b) => {
      if (!b || !b.startTime || !b.endTime) return false;
      const bDate = new Date(b.startTime);
      const eDate = new Date(b.endTime);
      const bCourtId = typeof b.court === "object" ? b.court?._id : b.court;

      const cellDateTime = new Date(selectedDate);
      cellDateTime.setHours(hour, 0, 0, 0);

      if (hour < 8) {
        cellDateTime.setDate(cellDateTime.getDate() + 1);
      }

      const isTimeInRange = cellDateTime >= bDate && cellDateTime < eDate;
      const isBooked = ["confirmed", "pending_payment", "blocked"].includes(b.status);

      return bCourtId === courtId && isTimeInRange && isBooked;
    });
  };

  const activeHours = timeTab === "morning" ? MORNING_HOURS : EVENING_HOURS;

  return (
    <div
      className="card-surface p-4 sm:p-6 mt-8 animate-in fade-in max-w-7xl mx-auto flex flex-col gap-6"
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-6">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
          <CalendarDays className="size-6 text-primary" /> جدول حجوزات الأندية
        </h2>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm flex-1 sm:flex-none sm:min-w-[200px]">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="w-full bg-transparent outline-none font-bold cursor-pointer text-foreground"
            >
              {venues.length === 0 ? <option value="">جاري التحميل...</option> : null}
              {venues.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-1 rounded-xl bg-muted/50 p-1 border border-border flex-1 sm:flex-none">
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
              className="bg-transparent text-sm font-bold outline-none cursor-pointer text-center w-[110px]"
            />
            <button
              onClick={() => changeDate(1)}
              className="rounded-lg p-1.5 hover:bg-background hover:shadow-sm transition"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl border border-border bg-muted/50 p-1 max-w-sm">
        <button
          onClick={() => setTimeTab("morning")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition",
            timeTab === "morning"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sun className="h-4 w-4" /> الصباح (8 ص - 6 م)
        </button>
        <button
          onClick={() => setTimeTab("evening")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition",
            timeTab === "evening"
              ? "bg-background text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Moon className="h-4 w-4" /> المساء (7 م - 7 ص)
        </button>
      </div>

      <div className="relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-card border border-border/50 p-6 shadow-2xl animate-in zoom-in-95 fade-in">
              <div className="bg-primary/10 p-3 rounded-full">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground">جاري تحضير الجدول...</p>
              <p className="text-xs text-muted-foreground">لحظات ونعرض أحدث المواعيد</p>
            </div>
          </div>
        )}

        {/* --- نسخة الكمبيوتر --- */}
        <div className="mt-5 hidden overflow-x-auto md:block">
          <div className="min-w-[900px]">
            <div
              className="grid text-xs text-muted-foreground mb-2"
              style={{
                gridTemplateColumns: `130px repeat(${activeHours.length}, minmax(65px, 1fr))`,
              }}
            >
              <div />
              {activeHours.map((h) => (
                <div key={h} className="text-center font-bold">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {courts.length === 0 && !loading ? (
              <p className="py-20 text-center text-sm font-bold text-muted-foreground border border-dashed rounded-xl">
                لا توجد ملاعب نشطة في هذا النادي حالياً.
              </p>
            ) : (
              courts.map((court) => (
                <div
                  key={court._id}
                  className="grid border-t border-border"
                  style={{
                    gridTemplateColumns: `130px repeat(${activeHours.length}, minmax(65px, 1fr))`,
                  }}
                >
                  <div className="flex items-center py-2 pr-2 text-sm font-bold text-primary border-l border-border/40">
                    {court.name}
                  </div>

                  {activeHours.map((hour) => {
                    const b = getBookingForCell(court._id, hour);

                    if (b) {
                      if (b.status === "blocked") {
                        const isAcademy = b.bookingType === "academy";
                        return (
                          <div
                            key={hour}
                            className={cn(
                              "m-1 overflow-hidden rounded-xl border p-1.5 text-right relative",
                              isAcademy
                                ? "bg-purple-500/20 border-purple-500/50 text-purple-950"
                                : "bg-destructive/20 border-destructive/50 text-red-950",
                            )}
                          >
                            <p className="truncate text-[10px] font-extrabold pr-1">
                              {isAcademy ? "أكاديمية (محجوز)" : "مغلق / صيانة"}
                            </p>
                            <div className="flex justify-between items-center mt-1 pr-1">
                              <span className="text-[9px] font-bold opacity-80 truncate">
                                {b.notes || "إغلاق إداري"}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      const kind = b.bookingType || "app";
                      const remaining = Math.max((b.totalPrice || 0) - (b.deposit || 0), 0);

                      return (
                        <div
                          key={hour}
                          onClick={() => setViewBooking(b)} // +++ جعل الخلية قابلة للضغط +++
                          className={cn(
                            "m-1 overflow-hidden rounded-xl border p-1.5 text-right relative cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-center",
                            kindClass[kind],
                            b.status === "pending_payment" ? "opacity-70 border-dashed" : "",
                          )}
                        >
                          <p className="truncate text-[10px] font-extrabold pr-1">
                            {b.guestData?.name || b.user?.name || "بدون اسم"}
                          </p>
                          {/* +++ التعديل هنا: إظهار المتبقي أو خالص +++ */}
                          {remaining > 0 ? (
                            <p className="truncate text-[10px] font-bold text-destructive mt-0.5 bg-destructive/10 px-1 rounded-sm self-start">
                              باقي: {remaining} ج
                            </p>
                          ) : (
                            <p className="truncate text-[10px] font-bold text-emerald-700 mt-0.5 flex items-center gap-0.5">
                              <CheckCircle2 className="size-3" /> خالص
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={hour}
                        className="m-1 rounded-xl border border-dashed border-border bg-surface/40 flex items-center justify-center opacity-50"
                      >
                        <span className="text-[10px] text-muted-foreground/40">
                          {String(hour).padStart(2, "0")}:00
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- نسخة الموبايل (مضافة حديثاً) --- */}
        <div className="mt-5 md:hidden">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
            {courts.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCourtIdForMobile(c._id)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                  c._id === selectedCourtIdForMobile
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
              const currentCourt = courts.find((c) => c._id === selectedCourtIdForMobile);
              if (!currentCourt) return null;

              const b = getBookingForCell(selectedCourtIdForMobile, hour);

              return (
                <div key={hour} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                  {b ? (
                    b.status === "blocked" ? (
                      <div
                        className={cn(
                          "min-w-0 rounded-xl border p-3 flex justify-between items-center",
                          b.bookingType === "academy"
                            ? "bg-purple-500/10 border-purple-500/40 text-purple-700"
                            : "bg-destructive/10 border-destructive/40 text-destructive",
                        )}
                      >
                        <div>
                          <p className="truncate text-sm font-bold">
                            {b.bookingType === "academy" ? "أكاديمية (محجوز)" : "مغلق / صيانة"}
                          </p>
                          <p className="truncate text-[11px] opacity-80 mt-0.5">
                            {b.notes || "إغلاق إداري"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setViewBooking(b)} // +++ جعل الخلية قابلة للضغط +++
                        className={cn(
                          "min-w-0 rounded-xl border p-3 cursor-pointer transition hover:opacity-90 flex justify-between items-center",
                          kindClass[b.bookingType || "app"],
                        )}
                      >
                        <div>
                          <p className="truncate text-sm font-bold">
                            {b.guestData?.name || b.user?.name || "بدون اسم"}
                          </p>
                          <p className="truncate text-[11px] opacity-80 mt-0.5">
                            {KIND_LABEL[b.bookingType || "app"]}
                          </p>
                        </div>

                        {/* +++ التعديل هنا للموبايل +++ */}
                        {(b.totalPrice || 0) - (b.deposit || 0) > 0 ? (
                          <div className="bg-destructive/10 text-destructive px-2 py-1 rounded-md text-[10px] font-bold shrink-0 border border-destructive/20">
                            باقي: {(b.totalPrice || 0) - (b.deposit || 0)} ج
                          </div>
                        ) : (
                          <div className="bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold shrink-0 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> خالص
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface/60 p-3 text-xs font-bold text-muted-foreground/50">
                      متاح للحجز
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* +++ إضافة نافذة التفاصيل الخاصة بالآدمن +++ */}
      <AdminBookingDetailsDialog booking={viewBooking} onClose={() => setViewBooking(null)} />
    </div>
  );
}
