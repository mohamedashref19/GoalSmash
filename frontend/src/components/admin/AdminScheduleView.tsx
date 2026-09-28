import { useState, useEffect, useCallback } from "react";
import { Clock, CalendarDays, MapPin, ChevronRight, ChevronLeft, Sun, Moon } from "lucide-react";
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
  app: "bg-success/15 border-success/40 text-success",
  manual: "bg-info/15 border-info/40 text-info",
};

const MORNING_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const EVENING_HOURS = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

export function AdminScheduleView() {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [courts, setCourts] = useState<CourtData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");

  useEffect(() => {
    setLoading(true);
    // تم استخدام الدالة الموجودة بالفعل في adminApi.js
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
      setCourts(activeCourts.filter((c: CourtData) => c.status === "active"));

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
      if (!b || !b.startTime) return false;
      const bDate = new Date(b.startTime);
      const startHour = bDate.getHours();
      const bCourtId = typeof b.court === "object" ? b.court?._id : b.court;

      const cellDate = new Date(selectedDate);
      const isSameDay =
        bDate.getDate() === cellDate.getDate() &&
        bDate.getMonth() === cellDate.getMonth() &&
        bDate.getFullYear() === cellDate.getFullYear();

      // +++ التعديل هنا: إضافة "blocked" لكي يقرأ الجدول المواعيد المغلقة +++
      const isBooked = ["confirmed", "pending_payment", "blocked"].includes(b.status);

      return bCourtId === courtId && startHour === hour && isBooked && isSameDay;
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Clock className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="font-semibold text-muted-foreground">جاري جلب الجدول...</p>
        </div>
      ) : venues.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground font-bold border border-dashed rounded-xl">
          لا توجد أندية مسجلة في النظام
        </div>
      ) : courts.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground font-bold border border-dashed rounded-xl">
          هذا النادي لا يحتوي على ملاعب نشطة
        </div>
      ) : (
        <>
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

          <div className="overflow-x-auto pb-4">
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

              {courts.map((court) => (
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
                      // +++ إضافة شكل مخصص للمواعيد المغلقة (أكاديمية أو صيانة) +++
                      if (b.status === "blocked") {
                        const isAcademy = b.bookingType === "academy";
                        return (
                          <div
                            key={hour}
                            className={cn(
                              "m-1 overflow-hidden rounded-xl border p-1.5 text-right relative",
                              isAcademy
                                ? "bg-purple-500/10 border-purple-500/40 text-purple-700"
                                : "bg-destructive/10 border-destructive/40 text-destructive",
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

                      // الشكل الطبيعي للحجوزات العادية
                      const kind = b.bookingType || "app";
                      const remaining = Math.max((b.totalPrice || 0) - (b.deposit || 0), 0);

                      return (
                        <div
                          key={hour}
                          className={cn(
                            "m-1 overflow-hidden rounded-xl border p-1.5 text-right relative",
                            kindClass[kind],
                            b.status === "pending_payment" ? "opacity-70 border-dashed" : "",
                          )}
                        >
                          <p className="truncate text-[10px] font-extrabold pr-1">
                            {b.guestData?.name || b.user?.name || "بدون اسم"}
                          </p>
                          <div className="flex justify-between items-center mt-1 pr-1">
                            <span className="text-[9px] font-bold opacity-80">
                              {b.status === "pending_payment" ? "بانتظار الدفع" : KIND_LABEL[kind]}
                            </span>
                            {remaining > 0 ? (
                              <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1 rounded">
                                باقي: {remaining}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-success">خالص</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // الشكل الطبيعي للساعات الفارغة المتاحة
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
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
