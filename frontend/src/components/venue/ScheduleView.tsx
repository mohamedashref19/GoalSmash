import { useState, useEffect, useCallback, useMemo } from "react";
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
  CheckCircle,
  Trash2,
  Hourglass,
  Loader2,
  CheckCircle2,
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
// @ts-expect-error: API lacks TypeScript definitions
import { fetchVenueById } from "@/api/venueApi";
import { useConfirm } from "../../components/venue/useConfirm";

interface CourtData {
  _id: string;
  name: string;
  status: string;
  pricePerHour?: number;
  priceMorning?: number;
  priceEvening?: number;
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
  app: "حجز من التطبيق",
  manual: "حجز يدوي",
  maintenance: "صيانة",
};

const kindClass: Record<string, string> = {
  app: "bg-success/20 border-success/50 text-emerald-950",
  manual: "bg-info/20 border-info/50 text-blue-950",
  maintenance: "bg-muted border-border text-muted-foreground",
};

// =========================================
// +++ نافذة تفاصيل الحجز +++
// =========================================
function BookingDetailsDialog({
  booking,
  onClose,
  onCancelBooking,
  onMarkAsPaid,
  isProcessingPayment,
}: {
  booking: BookingData | null;
  onClose: () => void;
  onCancelBooking: (id: string) => void;
  onMarkAsPaid: (id: string, fullPrice: number) => void;
  isProcessingPayment: boolean;
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

  const canCancel = booking.bookingType === "manual";

  const durationMinutes = Math.round((eDate.getTime() - bDate.getTime()) / (1000 * 60));
  let durationText = `${durationMinutes} دقيقة`;
  if (durationMinutes === 60) durationText = "ساعة";
  else if (durationMinutes === 120) durationText = "ساعتين";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={isProcessingPayment ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-3xl bg-card shadow-2xl animate-in fade-in zoom-in-95 border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-lg font-extrabold text-foreground">تفاصيل الحجز</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessingPayment}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background border border-border text-muted-foreground hover:bg-destructive hover:text-white transition-colors disabled:opacity-50"
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
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            {remaining > 0 && (
              <button
                onClick={() => onMarkAsPaid(booking._id, price)}
                disabled={isProcessingPayment}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white hover:bg-success/90 transition disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                {isProcessingPayment
                  ? "جاري التأكيد..."
                  : `تأكيد استلام باقي المبلغ (${remaining} ج.م) في الملعب`}
              </button>
            )}

            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={onClose}
                disabled={isProcessingPayment}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted transition disabled:opacity-50"
              >
                إغلاق النافذة
              </button>
              {canCancel ? (
                <button
                  onClick={() => onCancelBooking(booking._id)}
                  disabled={isProcessingPayment}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white hover:bg-destructive/90 transition disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  إلغاء الحجز
                </button>
              ) : (
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-xs font-bold text-muted-foreground transition opacity-50 cursor-not-allowed"
                  title="لا يمكن للمالك إلغاء حجز من التطبيق"
                >
                  <Trash2 size={16} />
                  إلغاء غير متاح
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
const formatHour12Short = (h: number) => {
  const ampm = h >= 12 && h < 24 ? "م" : "ص";
  let hr12 = h % 12;
  if (hr12 === 0) hr12 = 12;
  return `${hr12} ${ampm}`;
};

const formatHour12Full = (h: number) => {
  const ampm = h >= 12 && h < 24 ? "م" : "ص";
  let hr12 = h % 12;
  if (hr12 === 0) hr12 = 12;
  return `${String(hr12).padStart(2, "0")}:00 ${ampm}`;
};

export function ScheduleView({ venueId }: { venueId: string }) {
  const [courts, setCourts] = useState<CourtData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeTab, setTimeTab] = useState<"morning" | "evening">("morning");
  const [viewBooking, setViewBooking] = useState<BookingData | null>(null);

  // +++ حالات جديدة لحفظ مواعيد الفتح والإغلاق +++
  const [venueOpenHour, setVenueOpenHour] = useState(8);
  const [venueCloseHour, setVenueCloseHour] = useState(2);
  const [eveningStartHour, setEveningStartHour] = useState(18);

  const { confirm, ConfirmDialog } = useConfirm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

        const venueData = await fetchVenueById(vId);
        if (venueData) {
          if (venueData.eveningStartTime) {
            setEveningStartHour(parseInt(venueData.eveningStartTime.split(":")[0], 10));
          }
          if (venueData.openTime) {
            setVenueOpenHour(parseInt(venueData.openTime.split(":")[0], 10));
          }
          if (venueData.closeTime) {
            setVenueCloseHour(parseInt(venueData.closeTime.split(":")[0], 10));
          }
        }

        const courtsData = await fetchCourts(vId);
        const activeCourts = courtsData.filter((c: CourtData) => c.status === "active");
        setCourts(activeCourts);
        if (activeCourts.length > 0 && !selectedCourtId) {
          setSelectedCourtId(activeCourts[0]._id);
        }

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

  // +++ توليد الساعات المتاحة ديناميكياً بدلاً من المصفوفات الثابتة +++
  const activeHours = useMemo(() => {
    const hours = [];
    let current = timeTab === "morning" ? venueOpenHour : eveningStartHour;
    const endLimit = timeTab === "morning" ? eveningStartHour : venueCloseHour;

    let iters = 0;
    while (current !== endLimit && iters < 24) {
      hours.push(current);
      current = (current + 1) % 24;
      iters++;
    }
    return hours;
  }, [venueOpenHour, venueCloseHour, eveningStartHour, timeTab]);

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

      return bCourtId === courtId && isTimeInRange && b.status === "confirmed";
    });
  };

  const handleQuickBookClick = (
    courtId: string,
    courtName: string,
    hour: number,
    courtPricePerHour: number | undefined,
    courtPriceMorning: number | undefined,
    courtPriceEvening: number | undefined,
    sportType?: string | undefined,
  ) => {
    const isEvening = hour >= eveningStartHour || hour < venueOpenHour;

    let price = courtPricePerHour || 0;

    if (isEvening && courtPriceEvening) {
      price = courtPriceEvening;
    } else if (!isEvening && courtPriceMorning) {
      price = courtPriceMorning;
    }

    setSlot({ courtId, courtName, hour, price, sportType });
    setIsModalOpen(true);
  };

  const confirmManualBooking = async (data: BookingFormData) => {
    if (!slot || !venueId) return;

    const startDateTime = new Date(selectedDate);
    startDateTime.setHours(slot.hour, 0, 0, 0);

    const bookingDuration = (data as BookingFormData & { duration?: number }).duration || 60;

    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(startDateTime.getMinutes() + bookingDuration);

    try {
      await createBooking({
        venue: venueId,
        court: slot.courtId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        totalPrice: slot.price * (bookingDuration / 60),
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
    const isConfirmed = await confirm("هل أنت متأكد من إلغاء هذا الحجز؟");
    if (!isConfirmed) return;
    try {
      await apiClient.patch(`/bookings/${id}/cancel`);
      toast.success("تم إلغاء الحجز بنجاح");
      setViewBooking(null);
      loadData(venueId, selectedDate);
    } catch (err) {
      toast.error("حدث خطأ أثناء الإلغاء");
    }
  };

  const handleMarkAsPaid = async (id: string, fullPrice: number) => {
    const isConfirmed = await confirm("هل تأكدت من استلام باقي المبلغ كاش؟");
    if (!isConfirmed) return;

    setIsProcessingPayment(true);
    try {
      await apiClient.patch(`/bookings/${id}/payment`, {
        deposit: fullPrice,
        paymentStatus: "paid",
      });

      toast.success("تم تأكيد استلام باقي المبلغ بنجاح");
      setViewBooking(null);
      loadData(venueId, selectedDate);
    } catch (err) {
      toast.error("حدث خطأ أثناء تحديث بيانات الدفع");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="card-surface p-5 relative">
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
        <ConfirmDialog />
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
            الصباح ({formatHour12Short(venueOpenHour)} - {formatHour12Short(eveningStartHour)})
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
            المساء ({formatHour12Short(eveningStartHour)} - {formatHour12Short(venueCloseHour)})
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
                className="grid text-xs text-muted-foreground"
                style={{
                  gridTemplateColumns: `130px repeat(${activeHours.length}, minmax(60px, 1fr))`,
                }}
              >
                <div />
                {activeHours.map((h) => (
                  <div key={h} className="pb-2 text-center font-semibold">
                    {formatHour12Full(h)}
                  </div>
                ))}
              </div>

              {courts.length === 0 && !loading ? (
                <p className="py-20 text-center text-sm font-bold text-muted-foreground border border-dashed rounded-xl">
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
                    <div className="flex items-center py-2 pl-1 text-sm font-bold">
                      {court.name}
                    </div>

                    {activeHours.map((hour) => {
                      const b = getBookingForCell(court._id, hour);
                      if (b) {
                        const kind = b.bookingType || "app";

                        const price = b.totalPrice || 0;
                        const deposit = b.deposit || 0;
                        const remaining = Math.max(price - deposit, 0);

                        return (
                          <div
                            key={hour}
                            onClick={() => setViewBooking(b)}
                            className={cn(
                              "m-1 overflow-hidden rounded-xl border p-2 text-right transition-transform hover:scale-[1.02] cursor-pointer relative flex flex-col justify-center",
                              kindClass[kind],
                            )}
                          >
                            <p className="truncate text-[11px] font-bold pr-1">
                              {b.guestData?.name || b.user?.name || "بدون اسم"}
                            </p>
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
                          className="group relative m-1 rounded-xl border border-dashed border-border bg-surface/60"
                        >
                          <button
                            onClick={() =>
                              handleQuickBookClick(
                                court._id,
                                court.name,
                                hour,
                                court.pricePerHour,
                                court.priceMorning,
                                court.priceEvening,
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
                  <div
                    key={hour}
                    className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3"
                  >
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {formatHour12Full(hour)}
                    </span>
                    {b ? (
                      <div
                        onClick={() => setViewBooking(b)}
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
                    ) : (
                      <button
                        onClick={() =>
                          handleQuickBookClick(
                            selectedCourtId,
                            currentCourt.name,
                            hour,
                            currentCourt.pricePerHour,
                            currentCourt.priceMorning,
                            currentCourt.priceEvening,
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
        </div>
      </section>

      <BookingDetailsDialog
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
        onCancelBooking={handleCancelBooking}
        onMarkAsPaid={handleMarkAsPaid}
        isProcessingPayment={isProcessingPayment}
      />

      <QuickBookingModal
        open={isModalOpen}
        slotLabel={slot ? `${slot.courtName} · الساعة ${formatHour12Full(slot.hour)}` : undefined}
        slotPrice={slot?.price ?? 0}
        defaultSport={slot?.sportType}
        selectedDateObj={selectedDate}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmManualBooking}
      />
    </div>
  );
}
