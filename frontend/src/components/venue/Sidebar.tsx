import { useState, useEffect } from "react";
import { LayoutDashboard, CalendarDays, Settings, Trophy, X, Wallet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchTodayStats } from "@/api/dashboardApi";

export type ViewKey = "overview" | "schedule" | "payments" | "reports" | "settings";

// +++ تمت إضافة تبويب المدفوعات هنا +++
const navItems = [
  { key: "overview" as ViewKey, label: "نظرة عامة", icon: LayoutDashboard },
  { key: "schedule" as ViewKey, label: "الجدول", icon: CalendarDays },
  { key: "payments" as ViewKey, label: "المدفوعات", icon: Wallet },
  { key: "reports" as ViewKey, label: "التقارير", icon: FileText },
  { key: "settings" as ViewKey, label: "الإعدادات", icon: Settings },
];

type Props = {
  activeView: ViewKey;
  venueId?: string;
  onNavigate: (view: ViewKey) => void;
  onClose?: () => void;
};

export function SidebarContent({ activeView, venueId, onNavigate, onClose }: Props) {
  const [occupancy, setOccupancy] = useState<string>("0%");

  useEffect(() => {
    const loadOccupancy = async () => {
      if (!venueId) return;
      try {
        const stats = await fetchTodayStats(venueId);
        setOccupancy(stats.occupancyRate || "0%");
      } catch (err) {
        console.error("خطأ في جلب نسبة الإشغال:", err);
      }
    };
    loadOccupancy();
  }, [venueId]);

  return (
    <div className="flex h-full flex-col gap-6 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="gradient-primary grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-primary-foreground">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-extrabold">GoalSmash</p>
            <p className="truncate text-xs text-muted-foreground">إدارة الملاعب</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = key === activeView;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                active
                  ? "gradient-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-surface p-4 border border-border shadow-sm">
        <p className="text-sm font-bold text-muted-foreground">نسبة الإشغال اليوم</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-primary">{occupancy}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted border border-border">
          <div
            className="gradient-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: occupancy }}
          />
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  return (
    <aside className="hidden w-64 shrink-0 border-l border-border bg-card lg:block shadow-sm sticky top-0 h-screen overflow-hidden">
      <div className="h-full">
        <SidebarContent {...props} />
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, ...props }: Props & { open: boolean; onClose: () => void }) {
  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")}>
      <div
        onClick={props.onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <SidebarContent {...props} />
      </div>
    </div>
  );
}
