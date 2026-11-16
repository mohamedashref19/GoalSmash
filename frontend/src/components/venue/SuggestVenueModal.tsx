import { useState, type FormEvent } from "react";
import {
  Building2,
  MapPin,
  Phone,
  FileText,
  X,
  Send,
  Loader2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: API lacks TypeScript definitions
import { submitVenueRequest } from "@/api/venueApi";

export function SuggestVenueModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [requesterRole, setRequesterRole] = useState<"player" | "owner">("player");
  const [venueName, setVenueName] = useState("");
  const [area, setArea] = useState("");
  const [venuePhone, setVenuePhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!venueName.trim() || !area.trim()) {
      toast.error("يا ريت تكتب اسم الملعب والمنطقة");
      return;
    }
    if (requesterRole === "owner" && !venuePhone.trim()) {
      toast.error("يرجى كتابة رقم تليفون الملعب أو المسؤول للتواصل معك");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitVenueRequest({
        venueName: venueName.trim(),
        area: area.trim(),
        venuePhone: venuePhone.trim(),
        requesterRole,
        notes: notes.trim(),
      });

      toast.success("تسلم! طلبك وصل للإدارة وهنتواصل مع الملعب ونضيفه قريب جداً");
      setVenueName("");
      setArea("");
      setVenuePhone("");
      setNotes("");
      onClose();
    } catch (err) {
      toast.error(err as string);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-foreground">
                اقترح أو ضيف ملعب معانا
              </h3>
              <p className="text-[11px] font-bold text-muted-foreground">
                ابعتلنا بيانات الملعب وهنتواصل معاه فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* تحديد صفة المرسل */}
          <div>
            <label className="block text-xs font-extrabold text-muted-foreground mb-1.5">
              بتبعت الطلب بصفتك إيه؟
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequesterRole("player")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-extrabold transition",
                  requesterRole === "player"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <Users className="size-4" /> لاعب برشّح ملعب
              </button>
              <button
                type="button"
                onClick={() => setRequesterRole("owner")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-extrabold transition",
                  requesterRole === "owner"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <UserCheck className="size-4" /> صاحب / مسؤول الملعب
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-muted-foreground mb-1">
              اسم الملعب أو النادي *
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="مثال: ملعب النصر / بادل أرينا"
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm font-bold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-muted-foreground mb-1">
              المنطقة في إسكندرية *
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="مثال: سموحة، سيدي بشر، العجمي، محرم بك..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm font-bold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-muted-foreground mb-1">
              رقم تليفون الملعب أو المسؤول {requesterRole === "owner" ? "*" : "(اختياري لو معاك)"}
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                required={requesterRole === "owner"}
                value={venuePhone}
                onChange={(e) => setVenuePhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm font-bold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-muted-foreground mb-1">
              العنوان التفصيلي أو ملاحظات (اختياري)
            </label>
            <div className="relative">
              <FileText className="pointer-events-none absolute right-3.5 top-3 size-4 text-muted-foreground" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب مكان الملعب بالتفصيل، أو نوعه (خماسي / سباعي / بادل)..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm font-medium outline-none focus:border-primary min-h-20 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="gradient-primary w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isSubmitting ? "جاري الإرسال..." : "إرسال الطلب للإدارة"}
          </button>
        </form>
      </div>
    </div>
  );
}
