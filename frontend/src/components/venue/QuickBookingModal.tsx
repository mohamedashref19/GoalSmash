import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";

export type BookingFormData = {
  name: string;
  phone: string;
  sport: "خماسي" | "بادل";
  deposit: number;
};

type Props = {
  open: boolean;
  slotLabel?: string | undefined;
  slotPrice: number;
  defaultSport?: string | undefined;
  onClose: () => void;
  onConfirm: (data: BookingFormData) => Promise<void> | void;
};

export function QuickBookingModal({
  open,
  slotLabel,
  slotPrice,
  defaultSport,
  onClose,
  onConfirm,
}: Props) {
  const [form, setForm] = useState<BookingFormData>({
    name: "",
    phone: "",
    sport: "خماسي",
    deposit: 0,
  });
  const [isLoading, setIsLoading] = useState(false); // +++ حالة التحميل +++

  // إعادة ضبط البيانات عند فتح المودال وتحديد نوع الرياضة
  useEffect(() => {
    if (open) {
      const sportAr = defaultSport === "padel" ? "بادل" : "خماسي";
      setForm({ name: "", phone: "", sport: sportAr, deposit: 0 });
      setIsLoading(false);
    }
  }, [open, defaultSport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isLoading && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isLoading]);

  if (!open) return null;
  const remaining = Math.max(slotPrice - (Number(form.deposit) || 0), 0);

  const field =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onConfirm(form);
      // الإغلاق هيتم من الأب (ScheduleView) بعد النجاح
    } catch (error) {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
      />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold">حجز يدوي سريع</h2>
            {slotLabel && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{slotLabel}</p>
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

        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold">
            اسم العميل
            <input
              className={field}
              value={form.name}
              required
              disabled={isLoading}
              placeholder="مثال: أحمد سمير"
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
            />
          </label>
          <label className="block text-sm font-semibold">
            نوع الرياضة
            {/* +++ تحويله لـ Input ثابت بدلاً من Select لمنع اللخبطة +++ */}
            <input
              readOnly
              className={`${field} bg-muted text-muted-foreground cursor-not-allowed`}
              value={form.sport}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              العربون المدفوع (EGP)
              <input
                type="number"
                min={0}
                max={slotPrice}
                disabled={isLoading}
                className={field}
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm font-semibold">
              المبلغ المتبقي (EGP)
              <input
                readOnly
                className={`${field} bg-muted text-muted-foreground`}
                value={remaining}
              />
            </label>
          </div>
          <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
            سعر الحجز: <span className="font-bold text-foreground">{slotPrice} جنيه</span>
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
