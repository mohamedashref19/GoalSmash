import { Settings2, UserPlus, Building2, Dribbble, Edit, Lock, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "./adminSetup/useAdminSetup";
import type { TabKey } from "./adminSetup/types";
import { OwnerTab } from "./adminSetup/OwnerTab";
import { EmployeesTab } from "./adminSetup/EmployeesTab";
import { VenueTab } from "./adminSetup/VenueTab";
import { CourtTab } from "./adminSetup/CourtTab";
import { ManageTab } from "./adminSetup/ManageTab";
import { BlockTab } from "./adminSetup/BlockTab";
import { AccountsTab } from "./adminSetup/AccountsTab";
import { CustomersTab } from "./adminSetup/CustomersTab";

const TABS: { id: TabKey; icon: typeof Users; label: string }[] = [
  { id: "owner", icon: UserPlus, label: "إضافة مالك" },
  { id: "employees", icon: Users, label: "إضافة موظف / مدير" },
  { id: "venue", icon: Building2, label: "إنشاء نادي" },
  { id: "court", icon: Dribbble, label: "إضافة ملعب" },
  { id: "manage", icon: Edit, label: "إدارة الملاعب" },
  { id: "block", icon: Lock, label: "إغلاق وصيانة" },
  { id: "customers", icon: Users, label: "العملاء" },
  { id: "accounts", icon: Wallet, label: "حسابات الدفع" },
];

export function AdminSetupView() {
  const s = useAdminSetup();
  const { activeTab, setActiveTab, ConfirmDialog } = s;

  return (
    <div className="card-surface p-4 sm:p-6 mt-8 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
          <Settings2 className="size-6 text-primary" /> الإدارة الشاملة للنظام
        </h2>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 py-2.5 px-4 rounded-xl font-bold flex items-center gap-2 transition text-sm sm:text-base",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <tab.icon className="size-4 sm:size-5" /> {tab.label}
          </button>
        ))}
      </div>
      <ConfirmDialog />
      {activeTab === "owner" && <OwnerTab s={s} />}
      {activeTab === "employees" && <EmployeesTab s={s} />}
      {activeTab === "venue" && <VenueTab s={s} />}
      {activeTab === "court" && <CourtTab s={s} />}
      {activeTab === "manage" && <ManageTab s={s} />}
      {activeTab === "block" && <BlockTab s={s} />}
      {activeTab === "accounts" && <AccountsTab s={s} />}
      {activeTab === "customers" && <CustomersTab s={s} />}
    </div>
  );
}
