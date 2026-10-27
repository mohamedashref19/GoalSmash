import { Loader2, Trash2, UserPlus } from "lucide-react";
import type { AdminSetupState } from "./useAdminSetup";

export function EmployeesTab({ s }: { s: AdminSetupState }) {
  const {
    employeeData,
    employeesList,
    handleCreateEmployee,
    handleDeleteEmployee,
    loading,
    setEmployeeData,
    venuesList,
  } = s;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2">
      <form onSubmit={handleCreateEmployee} className="space-y-4 max-w-2xl mx-auto">
        <select
          required
          value={employeeData.venue}
          onChange={(e) => setEmployeeData({ ...employeeData, venue: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer font-bold"
        >
          <option value="">-- اختر النادي التابع له الموظف / المدير --</option>
          {venuesList.map((venue) => (
            <option key={venue._id} value={venue._id}>
              {venue.name}
            </option>
          ))}
        </select>
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="اسم الموظف / المدير بالكامل"
            required
            value={employeeData.name}
            onChange={(e) => setEmployeeData({ ...employeeData, name: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          />
          <input
            type="tel"
            placeholder="رقم الهاتف (01xxxxxxxxx)"
            required
            value={employeeData.phone}
            onChange={(e) => setEmployeeData({ ...employeeData, phone: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            dir="ltr"
          />
        </div>
  
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          required
          value={employeeData.email}
          onChange={(e) => setEmployeeData({ ...employeeData, email: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="password"
            placeholder="كلمة المرور"
            required
            minLength={8}
            value={employeeData.password}
            onChange={(e) => setEmployeeData({ ...employeeData, password: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            placeholder="تأكيد كلمة المرور"
            required
            minLength={8}
            value={employeeData.passwordConfirm}
            onChange={(e) =>
              setEmployeeData({ ...employeeData, passwordConfirm: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          />
        </div>
  
        <button
          disabled={loading}
          type="submit"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <UserPlus className="size-5" />
          )}{" "}
          إنشاء حساب الموظف وربطه بالنادي
        </button>
      </form>
  
      {/* جدول عرض الموظفين الحاليين */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm text-right">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">اسم الموظف / المدير</th>
              <th className="px-4 py-3 font-bold">النادي المرتبط به</th>
              <th className="px-4 py-3 font-bold">الهاتف</th>
              <th className="px-4 py-3 font-bold">البريد الإلكتروني</th>
              <th className="px-4 py-3 font-bold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {employeesList.map((emp) => (
              <tr
                key={emp._id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3 font-bold text-foreground">{emp.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    {emp.venue?.name || "نادي غير محدد"}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-muted-foreground" dir="ltr">
                  {emp.phone}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{emp.email}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleDeleteEmployee(emp._id)}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition inline-flex items-center gap-1 text-xs font-bold"
                    title="حذف الموظف"
                  >
                    <Trash2 className="size-4" /> حذف
                  </button>
                </td>
              </tr>
            ))}
            {employeesList.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground font-bold"
                >
                  لا يوجد موظفون مسجلون حتى الآن
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
