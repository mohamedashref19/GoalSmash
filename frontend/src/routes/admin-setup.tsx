import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/venue/Header";
import { AdminSetupView } from "@/components/admin/AdminSetupView";
import { LayoutDashboard, Wallet, Settings, ArrowRight, X, FileText } from "lucide-react"; // +++ إضافة FileText
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin-setup")({
  head: () => ({ meta: [{ title: "إعدادات النظام | الإدارة" }] }),
  component: AdminSetupPage,
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
          {/* +++ إضافة التقارير للقائمة الجانبية +++ */}
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

function AdminSetupPage() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground pb-20">
      <AdminMobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <Header title="إعدادات النظام" onMenu={() => setIsMobileMenuOpen(true)} />

      <div className="hidden lg:flex bg-card border-b border-border px-6 py-3 gap-6 justify-center sticky top-[61px] z-20 shadow-sm print:hidden">
        <Link
          to="/admin-dashboard"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <LayoutDashboard className="size-4" />
          الرئيسية
        </Link>
        <Link
          to="/admin-payments"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <Wallet className="size-4" />
          المدفوعات المركزية
        </Link>
        {/* +++ إضافة التقارير للشريط العلوي +++ */}
        <Link
          to="/admin-reports"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <FileText className="size-4" />
          تقارير المنصة
        </Link>
        <Link
          to="/admin-setup"
          className="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors text-muted-foreground [&.active]:text-primary"
        >
          <Settings className="size-4" />
          إعدادات النظام
        </Link>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:py-6">
        <button
          onClick={() => navigate({ to: "/admin-dashboard" })}
          className="lg:hidden flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowRight className="size-4" /> رجوع للرئيسية
        </button>

        <AdminSetupView />
      </main>
    </div>
  );
}
