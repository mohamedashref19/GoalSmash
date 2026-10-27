import { Building2, CalendarDays, Clock, Edit, ImageIcon, MapPin, Moon, Sun, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, getScheduleError, scheduleSummary } from "./helpers";
import type { AdminSetupState } from "./useAdminSetup";

export function ManageTab({ s }: { s: AdminSetupState }) {
  const {
    editCourtForm,
    editCourtId,
    editCourtImage,
    editVenueForm,
    editVenueId,
    editVenueImage,
    ownersList,
    saveEditCourt,
    saveEditVenue,
    setEditCourtForm,
    setEditCourtId,
    setEditCourtImage,
    setEditVenueForm,
    setEditVenueId,
    setEditVenueImage,
    startEditCourt,
    startEditVenue,
    venuesList,
  } = s;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2">
      {venuesList.map((venue) => (
        <div
          key={venue._id}
          className="border border-border rounded-2xl bg-surface overflow-hidden"
        >
          <div className="bg-muted/30 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {editVenueId === venue._id ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full animate-in fade-in">
                <input
                  type="text"
                  value={editVenueForm.name}
                  onChange={(e) => setEditVenueForm({ ...editVenueForm, name: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="اسم النادي"
                />
                <input
                  type="text"
                  value={editVenueForm.phone}
                  onChange={(e) =>
                    setEditVenueForm({ ...editVenueForm, phone: e.target.value })
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="التليفون"
                />
                <select
                  value={editVenueForm.ownerId}
                  onChange={(e) =>
                    setEditVenueForm({ ...editVenueForm, ownerId: e.target.value })
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  {ownersList.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name} - ({o.phone})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editVenueForm.area}
                  onChange={(e) => setEditVenueForm({ ...editVenueForm, area: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="المنطقة الرئيسية"
                />
  
                <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-3 bg-background p-2 rounded-lg border border-border">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      يفتح الساعة
                    </label>
                    <input
                      type="time"
                      value={editVenueForm.openTime}
                      onChange={(e) =>
                        setEditVenueForm({ ...editVenueForm, openTime: e.target.value })
                      }
                      className="w-full rounded-md border px-2 py-1.5 text-xs font-bold"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                      يغلق الساعة
                    </label>
                    <input
                      type="time"
                      value={editVenueForm.closeTime}
                      onChange={(e) =>
                        setEditVenueForm({ ...editVenueForm, closeTime: e.target.value })
                      }
                      className="w-full rounded-md border px-2 py-1.5 text-xs font-bold"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-primary block mb-1">
                      بداية المسائي
                    </label>
                    <input
                      type="time"
                      value={editVenueForm.eveningStartTime}
                      onChange={(e) =>
                        setEditVenueForm({ ...editVenueForm, eveningStartTime: e.target.value })
                      }
                      className="w-full rounded-md border border-primary/50 bg-primary/5 px-2 py-1.5 text-xs font-bold"
                      dir="ltr"
                    />
                  </div>
                </div>
  
                <p
                  className={cn(
                    "md:col-span-2 text-[10px] font-bold",
                    getScheduleError(
                      editVenueForm.openTime,
                      editVenueForm.eveningStartTime,
                      editVenueForm.closeTime,
                    )
                      ? "text-destructive"
                      : "text-primary",
                  )}
                >
                  {getScheduleError(
                    editVenueForm.openTime,
                    editVenueForm.eveningStartTime,
                    editVenueForm.closeTime,
                  ) ??
                    scheduleSummary(
                      editVenueForm.openTime,
                      editVenueForm.eveningStartTime,
                      editVenueForm.closeTime,
                    )}
                </p>
  
                <div className="md:col-span-2 mt-1">
                  <label className="text-[10px] font-bold text-muted-foreground block mb-2">
                    أيام العمل المتاحة
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((dayName, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-1.5 cursor-pointer bg-background border border-border px-2 py-1.5 rounded-md text-[10px] font-bold hover:bg-muted transition"
                      >
                        <input
                          type="checkbox"
                          checked={editVenueForm.workingDays.includes(idx)}
                          onChange={(e) => {
                            const newDays = e.target.checked
                              ? [...editVenueForm.workingDays, idx]
                              : editVenueForm.workingDays.filter((d) => d !== idx);
                            setEditVenueForm({ ...editVenueForm, workingDays: newDays });
                          }}
                          className="accent-primary w-3 h-3 cursor-pointer"
                        />
                        {dayName}
                      </label>
                    ))}
                  </div>
                </div>
  
                <div className="md:col-span-2 flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    value={editVenueForm.details}
                    onChange={(e) =>
                      setEditVenueForm({ ...editVenueForm, details: e.target.value })
                    }
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    placeholder="العنوان التفصيلي"
                  />
                  <label className="md:w-1/3 cursor-pointer bg-muted/50 border border-dashed border-border rounded-lg px-2 py-2 text-[11px] text-center hover:bg-muted text-muted-foreground transition flex items-center justify-center">
                    <ImageIcon className="size-3.5 inline mr-1" />
                    {editVenueImage ? editVenueImage.name : "تغيير الصورة"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0])
                          setEditVenueImage(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
                <div className="md:col-span-2 flex gap-2 mt-1">
                  <button
                    onClick={() => saveEditVenue(venue._id)}
                    className="bg-success text-white px-4 py-2 rounded-lg text-xs font-bold w-full"
                  >
                    حفظ التعديلات
                  </button>
                  <button
                    onClick={() => setEditVenueId(null)}
                    className="bg-muted text-foreground px-4 py-2 rounded-lg text-xs font-bold w-full"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <h3 className="font-extrabold text-lg flex items-center gap-2">
                    <Building2 className="size-5 text-primary" /> {venue.name}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <UserPlus className="size-3" /> المالك:{" "}
                      <span className="font-bold text-foreground">{venue.owner?.name}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3" /> المنطقة:{" "}
                      <span className="font-bold text-foreground">{venue.address?.area}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="size-3" /> المواعيد:{" "}
                      <span className="font-bold text-primary" dir="ltr">
                        {scheduleSummary(
                          venue.openTime || "08:00",
                          venue.eveningStartTime || "18:00",
                          venue.closeTime || "02:00",
                        )}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="size-3" /> أيام العمل:{" "}
                      <span className="font-bold text-foreground">
                        {venue.workingDays && venue.workingDays.length === 7
                          ? "طوال الأسبوع"
                          : venue.workingDays?.map((d) => WEEKDAYS[d]).join("، ") ||
                            "طوال الأسبوع"}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => startEditVenue(venue)}
                  className="bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-muted"
                >
                  <Edit className="size-3" /> تعديل النادي
                </button>
              </>
            )}
          </div>
  
          <div className="p-4 border-t border-border">
            <h4 className="text-xs font-extrabold text-muted-foreground mb-3 uppercase tracking-wider">
              ملاعب النادي ({venue.courts?.length || 0})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {venue.courts?.map((court) => (
                <div
                  key={court._id}
                  className="border border-border/60 bg-background rounded-xl p-3 flex flex-col justify-between"
                >
                  {editCourtId === court._id ? (
                    <div className="space-y-2 animate-in fade-in">
                      <input
                        type="text"
                        value={editCourtForm.name}
                        onChange={(e) =>
                          setEditCourtForm({ ...editCourtForm, name: e.target.value })
                        }
                        className="w-full rounded-md border px-2 py-1.5 text-xs"
                        placeholder="اسم الملعب"
                      />
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                            <Sun className="size-3 text-warning" /> السعر الصباحي
                          </label>
                          <input
                            type="number"
                            value={editCourtForm.priceMorning}
                            onChange={(e) =>
                              setEditCourtForm({
                                ...editCourtForm,
                                priceMorning: e.target.value,
                              })
                            }
                            className="w-full rounded-md border px-2 py-1.5 text-xs"
                            placeholder="مثال: 150"
                          />
                        </div>
                        <div className="w-1/2">
                          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                            <Moon className="size-3 text-primary" /> السعر المسائي
                          </label>
                          <input
                            type="number"
                            value={editCourtForm.priceEvening}
                            onChange={(e) =>
                              setEditCourtForm({
                                ...editCourtForm,
                                priceEvening: e.target.value,
                              })
                            }
                            className="w-full rounded-md border px-2 py-1.5 text-xs"
                            placeholder="مثال: 250"
                          />
                        </div>
                      </div>
                      <select
                        value={editCourtForm.sportType}
                        onChange={(e) =>
                          setEditCourtForm({ ...editCourtForm, sportType: e.target.value })
                        }
                        className="w-full rounded-md border px-2 py-1.5 text-xs"
                      >
                        <option value="padel">بادل</option>
                        <option value="football">خماسي</option>
                        <option value="football_7">سباعي</option>
                      </select>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="flex-1 cursor-pointer bg-muted/50 border border-dashed border-border rounded-md px-2 py-1.5 text-[10px] text-center hover:bg-muted text-muted-foreground transition">
                          <ImageIcon className="size-3 inline mr-1" />
                          {editCourtImage ? editCourtImage.name : "تغيير صورة الملعب"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0])
                                setEditCourtImage(e.target.files[0]);
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveEditCourt(court._id)}
                          className="flex-1 bg-primary text-white py-1.5 rounded-md text-[10px] font-bold hover:bg-primary/90 transition"
                        >
                          حفظ التعديل
                        </button>
                        <button
                          onClick={() => setEditCourtId(null)}
                          className="flex-1 bg-muted text-foreground py-1.5 rounded-md text-[10px] font-bold hover:bg-muted/80 transition"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm">{court.name}</span>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            court.sportType === "padel"
                              ? "bg-blue-500/10 text-blue-500"
                              : court.sportType === "football_7"
                                ? "bg-orange-500/10 text-orange-500"
                                : "bg-emerald-500/10 text-emerald-500",
                          )}
                        >
                          {court.sportType === "padel"
                            ? "بادل"
                            : court.sportType === "football_7"
                              ? "سباعي"
                              : "خماسي"}
                        </span>
                      </div>
                      <div className="flex justify-between items-end mt-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-primary text-xs flex items-center gap-1">
                            <Sun className="size-3" /> صباحاً:{" "}
                            {court.priceMorning || court.pricePerHour}{" "}
                            <span className="text-[9px] text-muted-foreground">ج/س</span>
                          </span>
                          <span className="font-black text-primary text-xs flex items-center gap-1">
                            <Moon className="size-3" /> مساءً:{" "}
                            {court.priceEvening || court.pricePerHour}{" "}
                            <span className="text-[9px] text-muted-foreground">ج/س</span>
                          </span>
                        </div>
                        <button
                          onClick={() => startEditCourt(court)}
                          className="text-muted-foreground hover:text-primary transition bg-muted/50 p-1.5 rounded-lg"
                        >
                          <Edit className="size-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
