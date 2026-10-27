import { Loader2, Lock, Trash2 } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import type { CourtBlock, GroupedCourtBlock } from "./types";
import type { AdminSetupState } from "./useAdminSetup";

export function BlockTab({ s }: { s: AdminSetupState }) {
  const {
    blockData,
    blocksList,
    dynamicCourts,
    expandedBlocks,
    handleBlockSlots,
    handleDeleteBlock,
    handleDeleteBlockSeries,
    isBlocking,
    setBlockData,
    setExpandedBlocks,
    venuesList,
  } = s;

  return (
    <div className="animate-in slide-in-from-bottom-2">
      <form onSubmit={handleBlockSlots} className="space-y-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            required
            value={blockData.venueId}
            onChange={(e) =>
              setBlockData({ ...blockData, venueId: e.target.value, courtId: "" })
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
          >
            <option value="">-- اختر النادي --</option>
            {venuesList.map((venue) => (
              <option key={venue._id} value={venue._id}>
                {venue.name}
              </option>
            ))}
          </select>
          <select
            required
            disabled={!blockData.venueId || dynamicCourts.length === 0}
            value={blockData.courtId}
            onChange={(e) => setBlockData({ ...blockData, courtId: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">-- اختر الملعب --</option>
            {dynamicCourts.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-3 rounded-xl border border-border">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
              من تاريخ
            </label>
            <input
              type="date"
              required
              value={blockData.dateFrom}
              onChange={(e) => setBlockData({ ...blockData, dateFrom: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
              إلى تاريخ (اختياري للتكرار)
            </label>
            <input
              type="date"
              min={blockData.dateFrom}
              value={blockData.dateTo}
              onChange={(e) => setBlockData({ ...blockData, dateTo: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <p className="text-[9px] text-muted-foreground mt-1">
              اتركه فارغاً لغلق يوم واحد فقط.
            </p>
          </div>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
              من الساعة
            </label>
            <select
              value={blockData.startTimeHour}
              onChange={(e) => setBlockData({ ...blockData, startTimeHour: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              dir="ltr"
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const val = String(i).padStart(2, "0");
                return (
                  <option key={`start-${val}`} value={val}>
                    {val}:00
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
              إلى الساعة (مش متضمن الساعه فى الجدول)
            </label>
            <select
              value={blockData.endTimeHour}
              onChange={(e) => setBlockData({ ...blockData, endTimeHour: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              dir="ltr"
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const val = String(i).padStart(2, "0");
                return (
                  <option key={`end-${val}`} value={val}>
                    {val}:00
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
              نوع الإغلاق
            </label>
            <select
              value={blockData.blockType}
              onChange={(e) => setBlockData({ ...blockData, blockType: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="maintenance">صيانة دورية</option>
              <option value="academy">حجز أكاديمية</option>
            </select>
          </div>
        </div>
  
        <input
          type="text"
          placeholder="ملاحظات (مثال: صيانة أرضية، أكاديمية كابتن محمد...)"
          value={blockData.notes}
          onChange={(e) => setBlockData({ ...blockData, notes: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
  
        <button
          disabled={isBlocking}
          type="submit"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 font-bold text-white transition disabled:opacity-50 hover:bg-destructive/90"
        >
          {isBlocking ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Lock className="size-5" />
          )}{" "}
          تأكيد إغلاق المواعيد
        </button>
      </form>
  
      {/* جدول المواعيد المغلقة */}
      <div className="overflow-x-auto rounded-xl border border-border mt-6">
        <table className="w-full text-sm text-right">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">النادي والملعب</th>
              <th className="px-4 py-3 font-bold">نوع الإغلاق</th>
              <th className="px-4 py-3 font-bold">الملخص (التاريخ والوقت)</th>
              <th className="px-4 py-3 font-bold max-w-[150px]">ملاحظات</th>
              <th className="px-4 py-3 font-bold text-center">إجراءات المجموعة</th>
            </tr>
          </thead>
          <tbody>
            {blocksList.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground font-bold"
                >
                  لا توجد مواعيد مغلقة حالياً.
                </td>
              </tr>
            ) : (
              (() => {
                const groupedBlocks = blocksList.reduce(
                  (acc, block) => {
                    const key = block.recurrenceId || block._id;
                    if (!acc[key]) {
                      acc[key] = {
                        recurrenceId: key,
                        venue: block.venue,
                        court: block.court,
                        blockType: block.blockType,
                        notes: block.notes,
                        startTimeHour: new Date(block.startTime).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                        endTimeHour: new Date(block.endTime).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                        minDate: new Date(block.startTime),
                        maxDate: new Date(block.endTime),
                        blocks: [block],
                      };
                    } else {
                      acc[key].blocks.push(block);
                      const bStart = new Date(block.startTime);
                      const bEnd = new Date(block.endTime);
                      if (bStart < acc[key].minDate) acc[key].minDate = bStart;
                      if (bEnd > acc[key].maxDate) acc[key].maxDate = bEnd;
                    }
                    return acc;
                  },
                  {} as Record<string, GroupedCourtBlock>,
                );
  
                return Object.values(groupedBlocks).map((group: GroupedCourtBlock) => {
                  const isAcademy = group.blockType === "academy";
                  const isExpanded = expandedBlocks.includes(group.recurrenceId);
                  const isSingleDay = group.blocks.length === 1;
  
                  return (
                    <React.Fragment key={group.recurrenceId}>
                      <tr
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isExpanded ? "bg-muted/30" : "hover:bg-muted/10",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold">{group.venue?.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {group.court?.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-bold",
                              isAcademy
                                ? "bg-purple-500/10 text-purple-600"
                                : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {isAcademy ? "حجز أكاديمية" : "صيانة / إداري"}
                          </span>
                          {!isSingleDay && (
                            <span className="block mt-1 text-[10px] font-bold text-muted-foreground">
                              ({group.blocks.length} أيام)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold mb-1">
                            ⏰ من {group.startTimeHour} إلى {group.endTimeHour}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground">
                            📅{" "}
                            {group.minDate.toLocaleDateString("ar-EG", {
                              month: "short",
                              day: "numeric",
                            })}
                            {!isSingleDay &&
                              ` - ${group.maxDate.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}`}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-[11px] text-muted-foreground max-w-[150px] truncate"
                          title={group.notes}
                        >
                          {group.notes || "---"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {!isSingleDay && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBlocks((prev) =>
                                    isExpanded
                                      ? prev.filter((id) => id !== group.recurrenceId)
                                      : [...prev, group.recurrenceId],
                                  )
                                }
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition text-xs font-bold"
                              >
                                {isExpanded ? "إخفاء الأيام" : "عرض الأيام"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                isSingleDay && group.blocks[0]
                                  ? handleDeleteBlock(group.blocks[0]._id)
                                  : handleDeleteBlockSeries(group.recurrenceId)
                              }
                              className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition text-xs font-bold"
                              title="إلغاء السلسلة بالكامل"
                            >
                              حذف {isSingleDay ? "اليوم" : "المجموعة"}
                            </button>
                          </div>
                        </td>
                      </tr>
  
                      {isExpanded &&
                        !isSingleDay &&
                        group.blocks.map((block: CourtBlock) => (
                          <tr key={block._id} className="bg-muted/10 border-b border-border/30">
                            <td colSpan={2} className="px-4 py-2 text-left">
                              <div className="inline-flex items-center gap-1 opacity-50">
                                <div className="w-4 h-px bg-border"></div>
                                <div className="w-px h-4 bg-border"></div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs font-bold text-foreground">
                                {new Date(block.startTime).toLocaleDateString("ar-EG", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(block._id)}
                                className="p-1 text-destructive hover:text-destructive/70 transition text-[10px] font-bold flex items-center justify-center gap-1 mx-auto"
                              >
                                <Trash2 className="size-3" /> حذف هذا اليوم فقط
                              </button>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                });
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
