import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, UserX, ShieldAlert, MonitorX } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchCancelledBookings } from "@/api/adminApi";

interface CancelledBooking {
  _id: string;
  startTime: string;
  createdAt: string;
  updatedAt: string;
  court?: { name: string };
  venue?: { name: string; owner?: string };
  user?: { _id: string; name: string; phone: string };
  guestData?: { name: string; phone: string };
  cancelledBy?: { _id: string; name: string; role: string }; // الحقل الجديد من الباك إند
}

export function AdminCancellationsView() {
  const [cancelledList, setCancelledList] = useState<CancelledBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCancelledBookings()
      .then(setCancelledList)
      .catch((err: unknown) => toast.error(err as string))
      .finally(() => setLoading(false));
  }, []);

  // دالة مساعدة لتحديد من قام بالإلغاء وشكل العرض الخاص به
  const getCancelledByDetails = (booking: CancelledBooking) => {
    if (!booking.cancelledBy) {
      return {
        text: "إلغاء تلقائي (تجاوز الوقت)",
        icon: MonitorX,
        color: "text-muted-foreground",
        bg: "bg-muted/50",
      };
    }

    if (booking.cancelledBy.role === "customer" || booking.cancelledBy._id === booking.user?._id) {
      return {
        text: "العميل (عبر التطبيق)",
        icon: UserX,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
      };
    }

    if (booking.cancelledBy.role === "owner" || booking.cancelledBy.role === "admin") {
      return {
        text: "صاحب الملعب ",
        icon: ShieldAlert,
        color: "text-destructive",
        bg: "bg-destructive/10",
      };
    }

    return {
      text: booking.cancelledBy.name,
      icon: UserX,
      color: "text-muted-foreground",
      bg: "bg-muted/50",
    };
  };

  return (
    <div dir="rtl" className="card-surface p-4 sm:p-6 mt-8 animate-in fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6 bg-destructive/5 px-4 py-3 rounded-xl">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-6" /> سجل الإلغاءات الشامل
        </h2>
        <span className="text-xs font-bold text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
          {cancelledList.length} حجز ملغي
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-destructive mb-4" />
          <p className="text-muted-foreground font-bold text-sm">جاري تحميل سجل الإلغاءات...</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-destructive/20 shadow-sm">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-destructive/5 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-bold">العميل / الهاتف</th>
                <th className="px-5 py-4 font-bold">النادي / الملعب</th>
                <th className="px-5 py-4 font-bold text-center">موعد اللعب (الأساسي)</th>
                <th className="px-5 py-4 font-bold text-center">تم الإلغاء بواسطة</th>
                <th className="px-5 py-4 font-bold text-center text-destructive">توقيت الإلغاء</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {cancelledList.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center text-muted-foreground font-bold text-sm"
                  >
                    لا توجد حجوزات ملغاة مسجلة في النظام حالياً.
                  </td>
                </tr>
              ) : (
                cancelledList.map((m: CancelledBooking) => {
                  const playDate = new Date(m.startTime);
                  const cancelledDate = m.updatedAt ? new Date(m.updatedAt) : null;

                  const clientName = m.user?.name || m.guestData?.name || "بدون اسم";
                  const clientPhone = m.user?.phone || m.guestData?.phone || "";

                  const cancelInfo = getCancelledByDetails(m);
                  const CancelIcon = cancelInfo.icon;

                  return (
                    <tr
                      key={m._id}
                      className="border-b border-border/40 transition-colors hover:bg-destructive/5 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground">{clientName}</span>
                          {clientPhone && (
                            <span
                              className="text-[11px] text-muted-foreground font-semibold"
                              dir="ltr"
                            >
                              {clientPhone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-semibold">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-foreground">{m.venue?.name || "نادي محذوف"}</span>
                          <span className="text-[11px]">{m.court?.name || "ملعب محذوف"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-foreground">
                            {playDate.toLocaleDateString("ar-EG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[11px] font-bold text-primary mt-0.5">
                            الساعة{" "}
                            {playDate.toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* +++ العمود الجديد: مصدر الإلغاء +++ */}
                      <td className="px-5 py-4 text-center">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ${cancelInfo.bg} ${cancelInfo.color}`}
                        >
                          <CancelIcon className="size-3.5" />
                          {cancelInfo.text}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center text-destructive">
                        {cancelledDate ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold">
                              {cancelledDate.toLocaleDateString("ar-EG", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-[10px] font-bold mt-0.5">
                              {cancelledDate.toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ) : (
                          "--"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <Toaster position="top-center" />
    </div>
  );
}
