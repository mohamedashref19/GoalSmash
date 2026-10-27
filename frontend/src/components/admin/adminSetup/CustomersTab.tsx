import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSetupState } from "./useAdminSetup";

export function CustomersTab({ s }: { s: AdminSetupState }) {
  const {
    customersList,
    loading,
  } = s;

  return (
    <div className="animate-in slide-in-from-bottom-2">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">اسم العميل</th>
                <th className="px-4 py-3 font-bold">الهاتف</th>
                <th className="px-4 py-3 font-bold">البريد الإلكتروني</th>
                <th className="px-4 py-3 font-bold text-center">إجمالي الحجوزات</th>
              </tr>
            </thead>
            <tbody>
              {customersList.map((customer, index) => (
                <tr
                  key={customer._id || index}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                        {customer.name.substring(0, 2)}
                      </div>
                      {customer.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-muted-foreground" dir="ltr">
                    {customer.phone}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{customer.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold",
                        customer.bookingCount > 5
                          ? "bg-success/10 text-success"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {customer.bookingCount} حجوزات
                    </span>
                  </td>
                </tr>
              ))}
              {customersList.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground font-bold"
                  >
                    لا يوجد عملاء مسجلين حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
