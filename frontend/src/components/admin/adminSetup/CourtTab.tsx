import { Dribbble, Loader2, Upload } from "lucide-react";
import type { AdminSetupState } from "./useAdminSetup";

export function CourtTab({ s }: { s: AdminSetupState }) {
  const {
    courtData,
    courtImage,
    handleCreateCourt,
    loading,
    setCourtData,
    setCourtImage,
    venuesList,
  } = s;

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
      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition">
        <input
          type="file"
          accept="image/*"
          id="courtImg"
          className="hidden"
          onChange={(e) => setCourtImage(e.target.files?.[0] || null)}
        />
        <label
          htmlFor="courtImg"
          className="cursor-pointer flex flex-col items-center justify-center gap-2"
        >
          <Upload className="size-8 text-muted-foreground" />
          <span className="text-sm font-bold text-muted-foreground">
            {courtImage ? courtImage.name : "صورة الملعب (اختياري)"}
          </span>
        </label>
      </div>
      <button
        disabled={loading}
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Dribbble className="size-5" />
        )}{" "}
        إضافة الملعب
      </button>
    </form>
  );
}
