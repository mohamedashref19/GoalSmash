import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet,
  TrendingUp,
  Activity,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  Trophy,
  Smartphone,
  Edit,
  Landmark,
  CalendarDays,
  X,
  LayoutDashboard,
  Settings,
  FileText, // +++ أيقونة التقارير +++
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { cn } from "@/lib/utils";

// @ts-expect-error APIs without TS definitions
import { fetchPlatformOverview, fetchVenuesPerformance } from "@/api/adminApi";

interface OverviewData {
  financials: {
    totalPlatformRevenue: number;
    totalCommissionEarned: number;
    todayCommission: number;
  };
  bookings: { total: number; appBookings: number; manualBookings: number; today: number };
  entities: { activeVenues: number; customers: number; owners: number };
}

interface CourtBreakdown {
  courtId: string;
  name: string;
  sportType: string;
  bookingsCount: number;
  revenue: number;
  commissionGenerated: number;
}

interface VenuePerformance {
  _id: string;
  venueName: string;
  city: string;
  totalBookings: number;
  totalRevenue: number;
  appBookingsCount: number;
  manualBookingsCount: number;
  commissionOwedToPlatform: number;
  courtsBreakdown: CourtBreakdown[];
}

export const Route = createFileRoute("/admin-dashboard")({
  head: () => ({ meta: [{ title: "لوحة القيادة | GoalSmash" }] }),
  component: AdminDashboardPage,
});

function AdminMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")}>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-card p-5 shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-primary">
            GoalSmash (الإدارة)
          </span>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            to="/admin-dashboard"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <LayoutDashboard className="h-5 w-5" /> لوحة القيادة
          </Link>
          <Link
            to="/admin-payments"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <Wallet className="h-5 w-5" /> المدفوعات المركزية
          </Link>
          {/* +++ رابط التقارير +++ */}
          <Link
            to="/admin-reports"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <FileText className="h-5 w-5" /> تقارير المنصة
          </Link>
          <Link
            to="/admin-setup"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors hover:bg-primary/10 hover:text-primary [&.active]:bg-primary/10 [&.active]:text-primary text-muted-foreground"
          >
            <Settings className="h-5 w-5" /> إعدادات النظام
          </Link>
        </nav>
      </div>
    </div>
  );
}

function AdminDashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [venues, setVenues] = useState<VenuePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [overviewData, venuesData] = await Promise.all([
          fetchPlatformOverview(),
          fetchVenuesPerformance(),
        ]);
        setOverview(overviewData);
        setVenues(venuesData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل بيانات الإدارة");
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const toggleVenue = (id: string) => setExpandedVenueId(expandedVenueId === id ? null : id);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Clock className="size-8 animate-spin text-primary" />
      </div>
    );
  if (error || !overview)
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground"
      >
        <AlertCircle className="size-10 text-destructive" />
        <h1 className="text-lg font-bold text-destructive">{error}</h1>
      </div>
    );

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground pb-20">
      <AdminMobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <Header title="لوحة القيادة (Super Admin)" onMenu={() => setIsMobileMenuOpen(true)} />

      <div className="hidden lg:flex bg-card border-b border-border px-6 py-3 gap-6 justify-center sticky top-[61px] z-20 shadow-sm">
        <Link
          to="/admin-dashboard"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <LayoutDashboard className="size-4" /> الرئيسية
        </Link>
        <Link
          to="/admin-payments"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <Wallet className="size-4" /> المدفوعات المركزية
        </Link>
        {/* +++ رابط التقارير +++ */}
        <Link
          to="/admin-reports"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <FileText className="size-4" /> تقارير المنصة
        </Link>
        <Link
          to="/admin-setup"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <Settings className="size-4" /> إعدادات النظام
        </Link>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8 space-y-8">
        <section>
          <h2 className="text-lg font-extrabold flex items-center gap-2 mb-4">
            <Activity className="size-5 text-primary" /> ملخص الأداء
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-surface p-5 border-b-4 border-b-success relative overflow-hidden group">
              <div className="absolute -left-6 -top-6 bg-success/10 size-24 rounded-full blur-xl group-hover:bg-success/20 transition" />
              <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <TrendingUp className="size-4" /> أرباح التطبيق (العمولة)
              </p>
              <p className="font-display text-3xl font-black text-success mt-2">
                {overview.financials.totalCommissionEarned}{" "}
                <span className="text-sm font-bold">ج.م</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                أرباح اليوم:{" "}
                <span className="font-bold text-foreground">
                  {overview.financials.todayCommission} ج.م
                </span>
              </p>
            </div>
            <div className="card-surface p-5 border-b-4 border-b-primary">
              <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <Wallet className="size-4" /> حجم الأموال المتداولة
              </p>
              <p className="font-display text-3xl font-black text-primary mt-2">
                {overview.financials.totalPlatformRevenue}{" "}
                <span className="text-sm font-bold">ج.م</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">إجمالي إيرادات جميع الملاعب</p>
            </div>
            <div className="card-surface p-5 border-b-4 border-b-info">
              <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <CalendarDays className="size-4" /> إجمالي الحجوزات
              </p>
              <p className="font-display text-3xl font-black text-info mt-2">
                {overview.bookings.total}{" "}
                <span className="text-sm font-bold text-muted-foreground">حجز</span>
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Smartphone className="size-3 text-info" /> {overview.bookings.appBookings} تطبيق
                </span>
                <span className="flex items-center gap-1">
                  <Edit className="size-3 text-muted-foreground" />{" "}
                  {overview.bookings.manualBookings} يدوي
                </span>
              </div>
            </div>
            <div className="card-surface p-5 border-b-4 border-b-warning">
              <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <Building2 className="size-4" /> الملاعب والمستخدمين
              </p>
              <p className="font-display text-3xl font-black text-warning mt-2">
                {overview.entities.activeVenues}{" "}
                <span className="text-sm font-bold text-muted-foreground">أندية</span>
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Users className="size-3 text-warning" /> {overview.entities.customers} عميل
                </span>
                <span className="flex items-center gap-1">
                  <Landmark className="size-3 text-muted-foreground" /> {overview.entities.owners}{" "}
                  مالك
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-extrabold flex items-center gap-2 mb-4">
            <Trophy className="size-5 text-primary" /> أداء الأندية (الأعلى ربحاً)
          </h2>
          <div className="space-y-4">
            {venues.map((venue, index) => (
              <div
                key={venue._id}
                className="card-surface overflow-hidden transition-all hover:shadow-md"
              >
                <div
                  onClick={() => toggleVenue(venue._id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary font-black text-lg">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{venue.venueName}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {venue.city} •{" "}
                        <span className="font-semibold">{venue.totalBookings} حجز كلي</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 border-t border-border pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto">
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-muted-foreground">عمولة التطبيق</p>
                      <p className="font-bold text-success text-lg">
                        {venue.commissionOwedToPlatform} ج
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-muted-foreground">إيرادات النادي</p>
                      <p className="font-bold text-foreground text-lg">{venue.totalRevenue} ج</p>
                    </div>
                    <div className="text-muted-foreground bg-muted p-1.5 rounded-lg">
                      {expandedVenueId === venue._id ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </div>
                  </div>
                </div>
                {expandedVenueId === venue._id && (
                  <div className="bg-muted/30 border-t border-border p-5 animate-in slide-in-from-top-2">
                    <h4 className="text-xs font-extrabold text-muted-foreground mb-3 uppercase tracking-wider">
                      تفاصيل أداء الملاعب الداخلية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {venue.courtsBreakdown.map((court: CourtBreakdown) => (
                        <div
                          key={court.courtId}
                          className="bg-background border border-border/60 rounded-xl p-4 flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-bold text-sm">{court.name}</h5>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                court.sportType === "padel"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-emerald-500/10 text-emerald-500",
                              )}
                            >
                              {court.sportType === "padel" ? "بادل" : "خماسي"}
                            </span>
                          </div>
                          <div className="space-y-1 mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">الحجوزات:</span>
                              <span className="font-bold">{court.bookingsCount}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">الإيرادات:</span>
                              <span className="font-bold">{court.revenue} ج.م</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-border pt-1 mt-1">
                              <span className="font-bold text-primary">عمولة التطبيق:</span>
                              <span className="font-black text-primary">
                                {court.commissionGenerated} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {venues.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-bold border border-dashed rounded-2xl">
                لا توجد بيانات متاحة للأندية حتى الآن
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
