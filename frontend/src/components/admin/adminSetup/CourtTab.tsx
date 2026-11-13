import { useEffect, useState } from "react";
import { Dribbble, Loader2, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AdminSetupState } from "./useAdminSetup";

export function CourtTab({ s }: { s: AdminSetupState }) {
  const {
    courtData,
    courtImages,
    handleCreateCourt,
    loading,
    setCourtData,
    setCourtImages,
    venuesList,
  } = s;

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);

  useEffect(() => {
    const urls = courtImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    if (activePreviewIdx >= urls.length) {
      setActivePreviewIdx(0);
    }
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [courtImages, activePreviewIdx]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const combined = [...courtImages, ...selected];
    if (combined.length > 5) {
      toast.error("الحد الأقصى هو 5 صور لكل ملعب");
    }
    setCourtImages(combined.slice(0, 5));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setCourtImages(courtImages.filter((_, i) => i !== index));
  };

  const makeCoverImage = (index: number) => {
    if (index === 0) return;
    const updated = [...courtImages];
    const [picked] = updated.splice(index, 1);
    if (picked) {
      updated.unshift(picked);
      setCourtImages(updated);
      setActivePreviewIdx(0);
      toast.success("تم تعيين الصورة كغلاف رئيسي للملعب");
    }
  };

  return (
    <form
      onSubmit={handleCreateCourt}
      className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom-2"
    >
      <select
        required
        value={courtData.venueId}
        onChange={(e) => setCourtData({ ...courtData, venueId: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
      >
        <option value="">-- اختر النادي --</option>
        {venuesList.map((venue) => (
          <option key={venue._id} value={venue._id}>
            {venue.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="اسم الملعب (مثال: بادل 1)"
          required
          value={courtData.name}
          onChange={(e) => setCourtData({ ...courtData, name: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
        <select
          required
          value={courtData.sportType}
          onChange={(e) => setCourtData({ ...courtData, sportType: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
        >
          <option value="padel">بادل (Padel)</option>
          <option value="football">كرة قدم خماسي</option>
          <option value="football_7">كرة قدم سباعي</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="number"
          placeholder="السعر الصباحي (ج.م/ساعة)"
          required
          min="0"
          value={courtData.priceMorning}
          onChange={(e) => setCourtData({ ...courtData, priceMorning: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          type="number"
          placeholder="السعر المسائي (ج.م/ساعة)"
          required
          min="0"
          value={courtData.priceEvening}
          onChange={(e) => setCourtData({ ...courtData, priceEvening: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
      </div>

      {/* حقل رابط اللوكيشن للملعب (اختياري) */}
      <input
        type="url"
        placeholder="رابط لوكيشن الملعب على Google Maps (اختياري - لو تركته فارغاً يستخدم لوكيشن النادي)"
        value={courtData.locationUrl}
        onChange={(e) => setCourtData({ ...courtData, locationUrl: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        dir="ltr"
      />

      <div className="space-y-3">
        <div className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:bg-muted/50 transition">
          <input
            type="file"
            accept="image/*"
            multiple
            id="courtImg"
            className="hidden"
            onChange={handleFilesChange}
          />
          <label
            htmlFor="courtImg"
            className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
          >
            <Upload className="size-7 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {courtImages.length > 0
                ? `تم اختيار ${courtImages.length} من 5 صور (اضغط لإضافة المزيد)`
                : "صور الملعب - حتى 5 صور (اختياري)"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              يفضل الصور العرضية (16:9) — الصورة الأولى ستكون هي الغلاف الرئيسي للملعب
            </span>
          </label>
        </div>

        {/* معاينة حية لشكل الصور داخل صفحة الملعب في الأبليكشن */}
        {previewUrls.length > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-primary">
                👁️ معاينة شكل الملعب داخل الأبليكشن ({activePreviewIdx + 1} / {previewUrls.length}):
              </span>
              {activePreviewIdx !== 0 && (
                <button
                  type="button"
                  onClick={() => makeCoverImage(activePreviewIdx)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-primary/90"
                >
                  <Star className="size-3 fill-current" /> تعيين كصورة رئيسية (غلاف)
                </button>
              )}
            </div>

            <div className="relative h-52 sm:h-64 w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-md">
              <img
                src={previewUrls[activePreviewIdx]}
                alt="معاينة الملعب"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <span className="absolute right-3 top-3 rounded-lg bg-background/90 px-3 py-1 text-xs font-bold shadow">
                {courtData.sportType === "padel"
                  ? "بادل"
                  : courtData.sportType === "football_7"
                    ? "سباعي"
                    : "خماسي"}
              </span>
              {activePreviewIdx === 0 && (
                <span className="absolute bottom-3 right-3 rounded-lg bg-primary/90 px-2.5 py-1 text-[10px] font-bold text-white shadow">
                  ⭐ الغلاف الرئيسي
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {previewUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePreviewIdx(idx)}
                  className={cn(
                    "relative h-16 w-24 cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
                    activePreviewIdx === idx
                      ? "border-primary ring-2 ring-primary/30 scale-[1.03]"
                      : "border-border opacity-70 hover:opacity-100",
                  )}
                >
                  <img src={url} alt={`صورة ${idx + 1}`} className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-center text-[9px] font-extrabold text-white py-0.5">
                      الغلاف
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    className="absolute left-1 top-1 rounded-full bg-destructive p-0.5 text-white shadow hover:bg-destructive/90"
                    title="حذف الصورة"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        disabled={loading}
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Dribbble className="size-5" />}{" "}
        إضافة الملعب
      </button>
    </form>
  );
}
