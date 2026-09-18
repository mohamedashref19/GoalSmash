import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sidebar, MobileSidebar, type ViewKey } from "@/components/venue/Sidebar";
import { Header } from "@/components/venue/Header";
import { OverviewView } from "@/components/venue/OverviewView";
import { ScheduleView } from "@/components/venue/ScheduleView";
import { SettingsView } from "@/components/venue/SettingsView";
import { QuickBookingModal, type BookingFormData } from "@/components/venue/QuickBookingModal";
import { MapPin, LayoutDashboard, CalendarDays, Settings, Wallet } from "lucide-react";
import { PaymentsView } from "@/components/venue/PaymentsView";
import { FinancialReportsView } from "@/components/venue/FinancialReportsView";
import { FileText } from "lucide-react"; // ضيف الأيقونة دي

// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues } from "@/api/venueApi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "لوحة إدارة الملاعب | GoalSmash" }],
  }),
  component: Dashboard,
});

const titles: Record<ViewKey, string> = {
  overview: "نظرة عامة",
  schedule: "الجدول",
  payments: "المدفوعات",
  reports: "التقارير",
  settings: "الإعدادات",
};

interface VenueData {
  _id: string;
  name: string;
}

const localNavItems = [
  { key: "overview" as ViewKey, label: "نظرة عامة", icon: LayoutDashboard },
  { key: "schedule" as ViewKey, label: "الجدول", icon: CalendarDays },
  { key: "payments" as ViewKey, label: "المدفوعات", icon: Wallet },
  { key: "reports" as ViewKey, label: "التقارير", icon: FileText },
  { key: "settings" as ViewKey, label: "الإعدادات", icon: Settings },
];

function Dashboard() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [slot, setSlot] = useState<{ court: string; hour: number; price: number } | null>(null);

  const [venues, setVenues] = useState<VenueData[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  useEffect(() => {
    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (!userData) {
      window.location.href = "/login";
    } else {
      try {
        const user = JSON.parse(userData);
        if (user.role === "admin") {
          window.location.href = "/admin-dashboard";
        } else if (user.role === "customer") {
          window.location.href = "/explore";
        } else {
          fetchAllVenues().then((data: VenueData[]) => {
            if (data) {
              setVenues(data);
              if (data.length > 0 && data[0]?._id) {
                setSelectedVenueId(data[0]._id);
              }
            }
          });
        }
      } catch (e) {
        window.location.href = "/login";
      }
    }
  }, []);

  const navigate = (view: ViewKey) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const confirmBooking = (data: BookingFormData) => {
    setIsBookingModalOpen(false);
  };

  return (
    // +++ التعديل الأول: h-screen بدلاً من min-h-screen لضبط حجم الشاشة ومنع التمرير الخارجي +++
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <MobileSidebar
        open={isMobileMenuOpen}
        activeView={activeView}
        venueId={selectedVenueId}
        onNavigate={navigate}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* +++ التعديل الثاني: إضافة overflow-y-auto هنا عشان المحتوى هو بس اللي يعمل Scroll +++ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Header title={titles[activeView]} onMenu={() => setIsMobileMenuOpen(true)} />

        {venues.length > 0 && (
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
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
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
