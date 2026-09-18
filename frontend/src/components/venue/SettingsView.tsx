import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchCourts } from "@/api/courtApi";

interface CourtData {
  _id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
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
            لإضافة ملاعب جديدة أو تعديل الأسعار، يرجى التواصل مع الإدارة المركزية.
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
        <ul className="flex flex-col gap-2">
          {courts.map((c) => (
            <li
              key={c._id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-bold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.sportType === "padel" ? "بادل" : "خماسي"}
                </p>
              </div>
              <div className="font-black text-primary text-sm shrink-0">
                {c.pricePerHour} ج.م / ساعة
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
      <PlaceholderSection
        title="إضافات الحجز (قريباً)"
        desc="تأجير مضارب، كور، وقمصان لعملائك لزيادة الدخل."
      />
    </div>
  );
}
