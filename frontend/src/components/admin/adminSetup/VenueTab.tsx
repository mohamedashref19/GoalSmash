import { Building2, Clock, Loader2, Upload } from "lucide-react";
import { WEEKDAYS, calculateHours, getScheduleError, scheduleSummary } from "./helpers";
import type { AdminSetupState } from "./useAdminSetup";

export function VenueTab({ s }: { s: AdminSetupState }) {
  const {
    handleCreateVenue,
    loading,
    ownersList,
    setVenueData,
    setVenueImage,
    venueData,
    venueImage,
  } = s;

  return (
    <form
      onSubmit={handleCreateVenue}
      className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom-2"
    >
      <select
        required
        value={venueData.ownerId}
        onChange={(e) => setVenueData({ ...venueData, ownerId: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
      >
        <option value="">-- اختر المالك --</option>
        {ownersList.map((owner) => (
          <option key={owner._id} value={owner._id}>
            {owner.name} ({owner.phone})
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="اسم النادي (مثال: Alex Padel Arena)"
        required
        value={venueData.name}
        onChange={(e) => setVenueData({ ...venueData, name: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="tel"
          placeholder="رقم هاتف النادي"
          required
          value={venueData.phone}
          onChange={(e) => setVenueData({ ...venueData, phone: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
        <input
          type="text"
          placeholder="المنطقة (مثال: سموحة)"
          required
          value={venueData.area}
          onChange={(e) => setVenueData({ ...venueData, area: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
      </div>
  
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 p-3 rounded-xl border border-border">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
            يفتح الساعة
          </label>
          <input
            type="time"
            required
            value={venueData.openTime}
            onChange={(e) => setVenueData({ ...venueData, openTime: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none font-bold"
            dir="ltr"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
            يغلق الساعة
          </label>
          <input
            type="time"
            required
            value={venueData.closeTime}
            onChange={(e) => setVenueData({ ...venueData, closeTime: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none font-bold"
            dir="ltr"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-primary mb-1.5 block">
            بداية السعر المسائي
          </label>
          <input
            type="time"
            required
            value={venueData.eveningStartTime}
            onChange={(e) => setVenueData({ ...venueData, eveningStartTime: e.target.value })}
            className="w-full rounded-lg border border-primary/50 bg-primary/5 px-3 py-2 text-sm outline-none font-bold"
            dir="ltr"
          />
        </div>
  
        <div className="col-span-1 sm:col-span-3 mt-1">
          <label className="text-[11px] font-bold text-muted-foreground mb-2 block">
            أيام العمل المتاحة للحجز
          </label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((dayName, idx) => (
              <label
                key={idx}
                className="flex items-center gap-1.5 cursor-pointer bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-muted transition"
              >
                <input
                  type="checkbox"
                  checked={venueData.workingDays.includes(idx)}
                  onChange={(e) => {
                    const newDays = e.target.checked
                      ? [...venueData.workingDays, idx]
                      : venueData.workingDays.filter((d) => d !== idx);
                    setVenueData({ ...venueData, workingDays: newDays });
                  }}
                  className="accent-primary w-3.5 h-3.5 cursor-pointer"
                />
                {dayName}
              </label>
            ))}
          </div>
        </div>
  
        <div className="col-span-1 sm:col-span-3">
          <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
            <Clock className="size-3.5" />
            إجمالي ساعات العمل المحسوبة:{" "}
            {calculateHours(venueData.openTime, venueData.closeTime)} ساعة
          </p>
          {getScheduleError(
            venueData.openTime,
            venueData.eveningStartTime,
            venueData.closeTime,
          ) ? (
            <p className="mt-1 text-[11px] font-bold text-destructive">
              {getScheduleError(
                venueData.openTime,
                venueData.eveningStartTime,
                venueData.closeTime,
              )}
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-bold text-primary" dir="ltr">
              {scheduleSummary(
                venueData.openTime,
                venueData.eveningStartTime,
                venueData.closeTime,
              )}
            </p>
          )}
        </div>
      </div>
  
      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition">
        <input
          type="file"
          accept="image/*"
          id="venueImg"
          className="hidden"
          onChange={(e) => setVenueImage(e.target.files?.[0] || null)}
        />
        <label
          htmlFor="venueImg"
          className="cursor-pointer flex flex-col items-center justify-center gap-2"
        >
          <Upload className="size-8 text-muted-foreground" />
          <span className="text-sm font-bold text-muted-foreground">
            {venueImage ? venueImage.name : "صورة النادي (اختياري)"}
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
          <Building2 className="size-5" />
        )}{" "}
        تسجيل النادي
      </button>
    </form>
  );
}
