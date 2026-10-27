import { CheckCircle, Edit, Loader2, Save, Trash2, Wallet, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSetupState } from "./useAdminSetup";

export function AccountsTab({ s }: { s: AdminSetupState }) {
  const {
    accountData,
    accountsList,
    editAccountForm,
    editAccountId,
    handleCreateAccount,
    handleDeleteAccount,
    handleToggleAccount,
    handleUpdateAccount,
    loading,
    setAccountData,
    setEditAccountForm,
    setEditAccountId,
    startEditAccount,
  } = s;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2">
      <form
        onSubmit={handleCreateAccount}
        className="p-4 border border-border rounded-xl bg-muted/30 mb-6"
      >
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Wallet className="size-5 text-primary" /> إضافة حساب دفع جديد
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            required
            value={accountData.type}
            onChange={(e) => setAccountData({ ...accountData, type: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="vodafone_cash">محفظة إلكترونية</option>
            <option value="instapay">إنستا باي</option>
          </select>
          <input
            type="text"
            placeholder={
              accountData.type === "vodafone_cash"
                ? "رقم المحفظة (مثال: 010...)"
                : "رقم حساب انستا باى"
            }
            required
            value={accountData.identifier}
            onChange={(e) => setAccountData({ ...accountData, identifier: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            dir="ltr"
          />
          <input
            type="text"
            placeholder="اسم صاحب الحساب (للإدارة فقط)"
            required
            value={accountData.accountName}
            onChange={(e) => setAccountData({ ...accountData, accountName: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            disabled={loading}
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{" "}
            إضافة الحساب
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm text-right">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">نوع الحساب</th>
              <th className="px-4 py-3 font-bold">الرقم / العنوان</th>
              <th className="px-4 py-3 font-bold">اسم صاحب الحساب</th>
              <th className="px-4 py-3 font-bold text-center">آخر ظهور (دوران)</th>
              <th className="px-4 py-3 font-bold text-center">آخر تحويل مُستلم</th>
              <th className="px-4 py-3 font-bold text-center">إجمالي المُحصل</th>
              <th className="px-4 py-3 font-bold text-center">الحالة</th>
              <th className="px-4 py-3 font-bold text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {accountsList.map((account) => (
              <tr
                key={account._id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
              >
                {editAccountId === account._id ? (
                  <>
                    <td className="px-2 py-2">
                      <select
                        value={editAccountForm.type}
                        onChange={(e) =>
                          setEditAccountForm({ ...editAccountForm, type: e.target.value })
                        }
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      >
                        <option value="vodafone_cash">محفظة إلكترونية</option>
                        <option value="instapay">إنستا باي</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editAccountForm.identifier}
                        onChange={(e) =>
                          setEditAccountForm({ ...editAccountForm, identifier: e.target.value })
                        }
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none text-left"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={editAccountForm.accountName}
                        onChange={(e) =>
                          setEditAccountForm({
                            ...editAccountForm,
                            accountName: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground text-xs" colSpan={3}>
                      جاري التعديل...
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground text-xs">---</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleUpdateAccount(account._id)}
                          className="bg-success text-white p-1.5 rounded-md hover:bg-success/80 transition"
                          title="حفظ"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setEditAccountId(null)}
                          className="bg-muted text-foreground p-1.5 rounded-md hover:bg-muted/80 transition"
                          title="إلغاء"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {account.type === "vodafone_cash" ? "محفظة إلكترونية" : "إنستا باي"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-muted-foreground" dir="ltr">
                      {account.identifier}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-semibold">
                      {account.accountName}
                    </td>

                    <td
                      className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground"
                      dir="ltr"
                    >
                      {account.lastUsedAt
                        ? new Date(account.lastUsedAt).toLocaleString("ar-EG", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "لم يُعرض بعد"}
                    </td>

                    <td className="px-4 py-3 text-center text-xs font-bold text-success" dir="ltr">
                      {account.lastTransferReceivedAt
                        ? new Date(account.lastTransferReceivedAt).toLocaleString("ar-EG", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "لم يُحصل بعد"}
                    </td>

                    <td className="px-4 py-3 text-center font-black text-primary">
                      {account.totalMoneyCollected
                        ? `${account.totalMoneyCollected.toFixed(2)} ج`
                        : "0 ج"}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-md text-[11px] font-bold",
                          account.isActive
                            ? "bg-success/10 text-success"
                            : "bg-red-500/10 text-red-500",
                        )}
                      >
                        {account.isActive ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleAccount(account._id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition",
                            account.isActive
                              ? "bg-warning/10 text-warning hover:bg-warning/20"
                              : "bg-success/10 text-success hover:bg-success/20",
                          )}
                        >
                          {account.isActive ? (
                            <>
                              <XCircle className="size-3.5" /> إيقاف
                            </>
                          ) : (
                            <>
                              <CheckCircle className="size-3.5" /> تفعيل
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => startEditAccount(account)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition"
                          title="تعديل"
                        >
                          <Edit className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account._id)}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition"
                          title="حذف نهائي"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {accountsList.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground font-bold">
                  لا توجد حسابات دفع مسجلة حتى الآن
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
