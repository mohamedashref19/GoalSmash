import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sidebar, MobileSidebar, type ViewKey } from "@/components/venue/Sidebar";
import { Header } from "@/components/venue/Header";
import { OverviewView } from "@/components/venue/OverviewView";
import { ScheduleView } from "@/components/venue/ScheduleView";
import { PaymentsView } from "@/components/venue/PaymentsView";
import { FinancialReportsView } from "@/components/venue/FinancialReportsView";
import { SettingsView } from "@/components/venue/SettingsView";
import { QuickBookingModal, type BookingFormData } from "@/components/venue/QuickBookingModal";
import { ReviewsView } from "@/components/venue/ReviewsView";
import {
  MapPin,
  LayoutDashboard,
  CalendarDays,
  Settings,
  Wallet,
  FileText,
  Loader2,
  Star,
} from "lucide-react";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues } from "@/api/venueApi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "لوحة إدارة الملاعب | Tigi-Hagz" }],
  }),
  component: Dashboard,
});

const titles: Record<ViewKey, string> = {
  overview: "نظرة عامة",
  schedule: "الجدول",
  payments: "المدفوعات",
  reports: "التقارير",
  reviews: "تقييمات العملاء",
  settings: "الإعدادات",
};

// +++ إضافة حقل owner للواجهة لمعرفة مالك الملعب +++
interface VenueData {
  _id: string;
  name: string;
  owner?: string | { _id: string };
}

const localNavItems = [
  { key: "overview" as ViewKey, label: "نظرة عامة", icon: LayoutDashboard },
  { key: "schedule" as ViewKey, label: "الجدول", icon: CalendarDays },
  { key: "payments" as ViewKey, label: "المدفوعات", icon: Wallet },
  { key: "reports" as ViewKey, label: "التقارير", icon: FileText },
  { key: "reviews" as ViewKey, label: "التقييمات", icon: Star },
  { key: "settings" as ViewKey, label: "الإعدادات", icon: Settings },
];

function Dashboard() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("ownerActiveTab") as ViewKey;
      if (savedTab) {
        setActiveView(savedTab);
      }
    }
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [slot, setSlot] = useState<{ court: string; hour: number; price: number } | null>(null);

  const [venues, setVenues] = useState<VenueData[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  useEffect(() => {
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");

    if (!userData) {
      window.location.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(userData);
      // توحيد معرف المستخدم الحالي
      const currentUserId = user._id || user.id;

      if (user.role === "admin") {
        window.location.replace("/admin-dashboard");
        return;
      } else if (user.role === "customer") {
        window.location.replace("/explore");
        return;
      } else {
        fetchAllVenues()
          .then((data: VenueData[]) => {
            if (data) {
              // +++ الفلترة: عرض الملاعب التي يمتلكها المستخدم الحالي فقط +++
              const myVenues = data.filter((v) => {
                const ownerId =
                  typeof v.owner === "object" && v.owner !== null ? v.owner._id : v.owner;
                return ownerId === currentUserId;
              });

              setVenues(myVenues);

              if (myVenues.length > 0 && myVenues[0]?._id) {
                setSelectedVenueId(myVenues[0]._id);
              }
            }
            setIsAuthChecking(false);
          })
          .catch(() => {
            setIsAuthChecking(false);
          });
      }
    } catch (e) {
      window.location.replace("/login");
    }
  }, []);

  const navigate = (view: ViewKey) => {
    setActiveView(view);
    localStorage.setItem("ownerActiveTab", view);
    setIsMobileMenuOpen(false);
  };

  const confirmBooking = (data: BookingFormData) => {
    setIsBookingModalOpen(false);
  };

  if (isAuthChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm font-bold animate-pulse">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <MobileSidebar
        open={isMobileMenuOpen}
        activeView={activeView}
        venueId={selectedVenueId}
        onNavigate={navigate}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Header title={titles[activeView]} onMenu={() => setIsMobileMenuOpen(true)} />

        {/* عرض القائمة المنسدلة فقط إذا كان يمتلك ملاعب */}
        {venues.length > 0 ? (
          <div className="px-4 pt-4 sm:px-6">
            <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:w-72">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="w-full cursor-pointer bg-transparent text-sm font-bold text-foreground outline-none"
              >
                {venues.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4 sm:px-6">
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-bold text-warning">
              لا توجد ملاعب مسجلة باسمك حتى الآن.
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto lg:hidden scrollbar-hide">
            {localNavItems.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => navigate(key)}
                className={
                  key === activeView
                    ? "gradient-primary shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-primary-foreground"
                    : "shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground"
                }
              >
                {label}
              </button>
            ))}
          </nav>

          {activeView === "overview" && selectedVenueId && (
            <OverviewView
              venueId={selectedVenueId}
              onSendCode={(name) => toast.success(`تم إرسال كود خصم إلى ${name}`)}
            />
          )}
          {activeView === "schedule" && selectedVenueId && (
            <ScheduleView venueId={selectedVenueId} />
          )}
          {activeView === "payments" && selectedVenueId && (
            <PaymentsView venueId={selectedVenueId} />
          )}
          {activeView === "reports" && selectedVenueId && (
            <FinancialReportsView venueId={selectedVenueId} />
          )}
          {activeView === "reviews" && selectedVenueId && <ReviewsView venueId={selectedVenueId} />}
          {activeView === "settings" && selectedVenueId && (
            <SettingsView venueId={selectedVenueId} />
          )}
        </main>
      </div>

      <Sidebar activeView={activeView} venueId={selectedVenueId} onNavigate={navigate} />

      <QuickBookingModal
        open={isBookingModalOpen}
        slotLabel={slot ? `${slot.court} · ${String(slot.hour).padStart(2, "0")}:00` : undefined}
        slotPrice={slot?.price ?? 300}
        onClose={() => setIsBookingModalOpen(false)}
        onConfirm={confirmBooking}
      />
      <Toaster position="top-center" />
    </div>
  );
}
