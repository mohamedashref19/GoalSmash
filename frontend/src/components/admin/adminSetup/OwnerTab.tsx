import { Loader2, Save } from "lucide-react";
import type { AdminSetupState } from "./useAdminSetup";

export function OwnerTab({ s }: { s: AdminSetupState }) {
  const {
    handleCreateOwner,
    loading,
    ownerData,
    setOwnerData,
  } = s;

  return (
    <form
      onSubmit={handleCreateOwner}
      className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom-2"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="الاسم بالكامل"
          required
          value={ownerData.name}
          onChange={(e) => setOwnerData({ ...ownerData, name: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
        <input
          type="tel"
          placeholder="رقم الهاتف (01xxxxxxxxx)"
          required
          value={ownerData.phone}
          onChange={(e) => setOwnerData({ ...ownerData, phone: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          dir="ltr"
        />
      </div>
      <input
        type="email"
        placeholder="البريد الإلكتروني"
        required
        value={ownerData.email}
        onChange={(e) => setOwnerData({ ...ownerData, email: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="password"
          placeholder="كلمة المرور"
          required
          minLength={8}
          value={ownerData.password}
          onChange={(e) => setOwnerData({ ...ownerData, password: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
        <input
          type="password"
          placeholder="تأكيد كلمة المرور"
          required
          minLength={8}
          value={ownerData.passwordConfirm}
          onChange={(e) => setOwnerData({ ...ownerData, passwordConfirm: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
        />
      </div>
      <button
        disabled={loading}
        type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}{" "}
        إنشاء الحساب
      </button>
    </form>
  );
}
