import { useEffect, useState } from "react";
import { CalendarCheck, Wallet, Users, Activity, Ticket, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchTodayStats, fetchTopCustomers } from "@/api/dashboardApi";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchMyBookings } from "@/api/bookingApi";

interface StatsData {
  todayBookings: number;
  todayRevenue: number;
  activeCourts: number;
  occupancyRate: string;
}

interface CustomerData {
  _id: string;
  name: string;
  phone?: string;
  totalBookings: number;
  totalSpent: number;
}

interface BookingData {
  _id: string;
  startTime: string;
  status: string;
  totalPrice: number;
  deposit?: number; // +++ إضافة deposit +++
  user?: { name: string; phone?: string };
  guestData?: { name: string; phone?: string };
  court?: { name: string };
  venue?: { _id: string };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
        status === "confirmed" && "bg-success/12 text-success",
        status === "pending" && "bg-warning/20 text-warning-foreground",
        status === "cancelled" && "bg-destructive/12 text-destructive",
      )}
    >
      {status === "confirmed" ? "مؤكد" : status === "pending" ? "بانتظار الدفع" : "ملغي"}
    </span>
  );
}

export function OverviewView({
  venueId,
  onSendCode,
}: {
  venueId: string;
  onSendCode: (name: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<StatsData | null>(null);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<BookingData[]>([]);

  useEffect(() => {
    if (!venueId) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        const [statsData, topCustomersData, allBookingsData] = await Promise.all([
          fetchTodayStats(venueId),
          fetchTopCustomers(venueId),
          fetchMyBookings(),
        ]);

        setStats(statsData);
        setCustomers(topCustomersData || []);

        const now = new Date();
        const safeBookings = Array.isArray(allBookingsData) ? allBookingsData : [];
        const upcoming = safeBookings
          .filter(
            (b: BookingData) =>
              b &&
              b.startTime &&
              new Date(b.startTime) >= now &&
              b.venue?._id === venueId &&
              b.status === "confirmed",
          )
          .slice(0, 5);
        setUpcomingBookings(upcoming);
      } catch (err) {
        setError(err as string);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [venueId]);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Clock className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 font-semibold">جارٍ تحميل الإحصائيات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-64 place-items-center text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="mt-4 font-semibold">{error}</p>
      </div>
    );
  }

  const statCards = [
    { label: "حجوزات اليوم", value: stats?.todayBookings || 0, icon: CalendarCheck },
    { label: "إيرادات اليوم", value: `${stats?.todayRevenue || 0} ج`, icon: Wallet },
    { label: "الملاعب المتاحة", value: stats?.activeCourts || 0, change: "نشط", icon: Users },
    { label: "نسبة الإشغال", value: stats?.occupancyRate || "0%", change: "اليوم", icon: Activity },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, change, icon: Icon }) => (
          <div key={label} className="card-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-success">{change}</p>
          </div>
        ))}
      </div>

      <section className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-display text-lg font-extrabold">أقرب الحجوزات القادمة</h2>
          <span className="text-xs text-muted-foreground">{upcomingBookings.length} حجز معروض</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">العميل / الفريق</th>
                <th className="px-5 py-3 font-semibold">الملعب</th>
                <th className="px-5 py-3 font-semibold">التاريخ</th>
                <th className="px-5 py-3 font-semibold">الوقت</th>
                <th className="px-5 py-3 font-semibold">الحالة</th>
                <th className="px-5 py-3 font-semibold">المبلغ المطلوب</th>
              </tr>
            </thead>
            <tbody>
              {upcomingBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-4 text-center text-muted-foreground">
                    لا توجد حجوزات قادمة
                  </td>
                </tr>
              ) : (
                upcomingBookings.map((m: BookingData) => {
                  const d = new Date(m.startTime);
                  const clientName = m.user?.name || m.guestData?.name || "بدون اسم";
                  const clientPhone = m.user?.phone || m.guestData?.phone || "";

                  // +++ حساب المبلغ المتبقي +++
                  const remaining = Math.max((m.totalPrice || 0) - (m.deposit || 0), 0);

                  return (
                    <tr
                      key={m._id}
                      className="border-t border-border transition-colors hover:bg-surface"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{clientName}</span>
                          {clientPhone && (
                            <span
                              className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                              dir="ltr"
                            >
                              {clientPhone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.court?.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={m.status} />
                      </td>
                      {/* +++ إظهار المبلغ الكلي وإذا كان هناك متبقي +++ */}
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold">{m.totalPrice} ج.م</span>
                          {remaining > 0 ? (
                            <span className="text-[10px] font-bold text-destructive">
                              باقي: {remaining} ج
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-success">خالص</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-extrabold">أفضل العملاء</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">صورة اللاعب</th>
                <th className="px-5 py-3 font-semibold">الاسم والرقم</th>
                <th className="px-5 py-3 font-semibold">إجمالي الحجوزات</th>
                <th className="px-5 py-3 font-semibold">إجمالي الإنفاق</th>
                {/* <th className="px-5 py-3 font-semibold">إجراء</th> */}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-center text-muted-foreground">
                    لا يوجد عملاء حتى الآن
                  </td>
                </tr>
              ) : (
                customers.map((c: CustomerData) => (
                  <tr
                    key={c._id || c.name}
                    className="border-t border-border transition-colors hover:bg-surface"
                  >
                    <td className="px-5 py-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                        {c.name ? c.name.substring(0, 2).toUpperCase() : "م"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{c.name || "بدون اسم"}</span>
                        {c.phone && (
                          <span
                            className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {c.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.totalBookings} حجز</td>
                    <td className="px-5 py-3 font-bold text-primary">{c.totalSpent} ج.م</td>
                    {/* <td className="px-5 py-3">
                      <button
                        onClick={() => onSendCode(c.name || "")}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        <Ticket className="h-4 w-4" /> إرسال كود خصم
                      </button>
                    </td> */}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
