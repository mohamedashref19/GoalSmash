import { useState, useEffect } from "react";
import { Clock, Sun, Moon } from "lucide-react"; // +++ إضافة أيقونات الشمس والقمر +++
import { toast } from "sonner";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchCourts } from "@/api/courtApi";

interface CourtData {
  _id: string;
  name: string;
  sportType: string;
  pricePerHour?: number; // للتوافق مع الملاعب القديمة
  priceMorning?: number; // +++ السعر الصباحي +++
  priceEvening?: number; // +++ السعر المسائي +++
  status: string;
}

function CourtsManagement({ venueId }: { venueId: string }) {
  const [courts, setCourts] = useState<CourtData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCourts = async (vId: string) => {
    try {
      setLoading(true);
      const data = await fetchCourts(vId);
      // نعرض الملاعب النشطة فقط
      setCourts(data.filter((c: CourtData) => c.status !== "inactive"));
    } catch (err) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      loadCourts(venueId);
    }
  }, [venueId]);

  return (
    <section className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-lg font-extrabold">الملاعب الخاصة بك</h2>
          <p className="text-xs text-muted-foreground mt-1">
            لإضافة ملاعب جديدة أو تعديل الأسعار، يرجى التواصل مع اداره الابلبكشن.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-6 text-primary">
          <Clock className="size-6 animate-spin" />
        </div>
      ) : courts.length === 0 ? (
        <p className="mt-4 text-center text-sm font-bold text-muted-foreground bg-muted p-6 rounded-xl border border-dashed border-border">
          لا توجد ملاعب مضافة لهذا النادي بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courts.map((c) => (
            <li
              key={c._id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.sportType === "padel" ? "بادل" : "خماسي"}
                </p>
              </div>

              {/* +++ عرض السعر الصباحي والمسائي +++ */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 bg-warning/10 text-warning px-2.5 py-1 rounded-lg">
                  <Sun className="size-3.5" />
                  <span className="font-black text-sm">
                    {c.priceMorning || c.pricePerHour || 0}{" "}
                    <span className="text-[10px] opacity-80 font-semibold">ج.م / س</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                  <Moon className="size-3.5" />
                  <span className="font-black text-sm">
                    {c.priceEvening || c.pricePerHour || 0}{" "}
                    <span className="text-[10px] opacity-80 font-semibold">ج.م / س</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlaceholderSection({ title, desc }: { title: string; desc: string }) {
  return (
    <section className="card-surface p-5 opacity-60 grayscale">
      <h2 className="font-display text-lg font-extrabold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground bg-muted/50">
        قريباً... (تحت التطوير)
      </div>
    </section>
  );
}

export function SettingsView({ venueId }: { venueId: string }) {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      <CourtsManagement venueId={venueId} />
      <PlaceholderSection title="إضافات الحجز (قريباً)" desc="تأجير مضارب، كور، وقمصان لعملائك ." />
    </div>
  );
}
