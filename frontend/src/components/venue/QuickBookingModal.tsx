import { useEffect, useState } from "react";
import { X, Loader2, CalendarDays, Clock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingFormData = {
  name: string;
  phone: string;
  sport: "خماسي" | "بادل";
  deposit: string | number;
  duration: 60 | 120; // +++ إضافة المدة +++
};

type Props = {
  open: boolean;
  slotLabel?: string | undefined;
  slotPrice: number;
  defaultSport?: string | undefined;
  selectedDateObj?: Date; // +++ إضافة التاريخ كـ Prop +++
  onClose: () => void;
  onConfirm: (data: BookingFormData) => Promise<void> | void;
};

export function QuickBookingModal({
  open,
  slotLabel,
  slotPrice,
  defaultSport,
  selectedDateObj,
  onClose,
  onConfirm,
}: Props) {
  const [form, setForm] = useState<BookingFormData>({
    name: "",
    phone: "",
    sport: "خماسي",
    deposit: 0,
    duration: 60,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const sportAr = defaultSport === "padel" ? "بادل" : "خماسي";
      setForm({ name: "", phone: "", sport: sportAr, deposit: "", duration: 60 });
      setIsLoading(false);
    }
  }, [open, defaultSport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isLoading && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isLoading]);

  if (!open) return null;

  // +++ حساب السعر النهائي بناءً على المدة +++
  const finalPrice = form.duration === 120 ? slotPrice * 2 : slotPrice;
  const remaining = Math.max(finalPrice - (Number(form.deposit) || 0), 0);

  const field =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const finalData = { ...form, deposit: Number(form.deposit) || 0 };
      await onConfirm(finalData);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const dayName = selectedDateObj
    ? selectedDateObj.toLocaleDateString("ar-EG", { weekday: "long" })
    : "";
  const dateStr = selectedDateObj
    ? selectedDateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })
    : "";
  const hourMatch = slotLabel?.match(/\d{2}:\d{2}/);
  const slotHour = hourMatch ? hourMatch[0] : "";
  const courtNameMatch = slotLabel?.split("·")[0]?.trim();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
      />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-primary">حجز يدوي سريع</h2>
            {courtNameMatch && (
              <p className="mt-0.5 font-bold text-muted-foreground">{courtNameMatch}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="إغلاق"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* +++ ملخص الموعد كزيادة تأكيد +++ */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-around mb-4">
          <div className="flex flex-col items-center gap-1">
            <CalendarDays className="size-4 text-primary" />
            <span className="text-xs font-bold">{dayName}</span>
            <span className="text-[10px] text-muted-foreground">{dateStr}</span>
          </div>
          <div className="w-px h-8 bg-primary/20"></div>
          <div className="flex flex-col items-center gap-1">
            <Clock className="size-4 text-primary" />
            <span className="text-xs font-bold">الساعة</span>
            <span className="text-xs font-bold" dir="ltr">
              {slotHour}
            </span>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* +++ أزرار اختيار المدة +++ */}
          <div>
            <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
              <Hourglass className="size-4 text-primary" /> مدة الحجز
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, duration: 60 })}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-sm font-bold transition",
                  form.duration === 60
                    ? "gradient-primary border-transparent text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
              >
                ساعة
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, duration: 120 })}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-sm font-bold transition",
                  form.duration === 120
                    ? "gradient-primary border-transparent text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
              >
                ساعتين
              </button>
            </div>
          </div>

          <label className="block text-sm font-semibold">
            اسم العميل
            <input
              className={field}
              value={form.name}
              required
              disabled={isLoading}
              placeholder="مثال: محمد أشرف"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            رقم الهاتف
            <input
              className={field}
              value={form.phone}
              required
              disabled={isLoading}
              inputMode="tel"
              placeholder="01xxxxxxxxx"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              dir="ltr"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              العربون (EGP)
              <input
                type="number"
                min={0}
                max={finalPrice}
                disabled={isLoading}
                className={field}
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                dir="ltr"
              />
            </label>
            <label className="block text-sm font-semibold">
              المبلغ المتبقي (EGP)
              <input
                readOnly
                className={`${field} bg-muted text-muted-foreground`}
                value={remaining}
                dir="ltr"
              />
            </label>
          </div>
          <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
            إجمالي سعر الحجز: <span className="font-bold text-foreground">{finalPrice} جنيه</span>
          </p>

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="gradient-primary flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ التأكيد...
                </>
              ) : (
                "تأكيد الحجز"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
