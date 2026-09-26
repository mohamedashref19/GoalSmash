import { useState, useEffect } from "react";
import {
  UserPlus,
  Building2,
  Upload,
  Loader2,
  Save,
  Dribbble,
  Users,
  Settings2,
  Edit,
  MapPin,
  ImageIcon,
  Wallet,
  CheckCircle,
  XCircle,
  Trash2,
  X,
  Clock,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createOwnerAccount,
  fetchAllOwners,
  createVenueByAdmin,
  fetchAllVenues,
  createCourtByAdmin,
  fetchAllCustomers,
  updateVenueByAdmin,
  updateCourtByAdmin,
  fetchPaymentAccounts,
  createPaymentAccount,
  togglePaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
  // @ts-expect-error: API lacks TypeScript definitions
} from "@/api/adminApi";

interface Owner {
  _id: string;
  name: string;
  phone: string;
}

interface Court {
  _id: string;
  name: string;
  pricePerHour?: number; // لضمان التوافق مع البيانات القديمة
  priceMorning: number;
  priceEvening: number;
  sportType: string;
}

interface Venue {
  _id: string;
  name: string;
  phone: string;
  operatingHours?: number;
  openTime?: string;
  closeTime?: string;
  eveningStartTime?: string;
  address?: { area: string; city: string; details?: string };
  owner?: { _id: string; name: string; phone: string };
  courts?: Court[];
}

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bookingCount: number;
  createdAt: string;
}

interface PaymentAccount {
  _id: string;
  type: string;
  identifier: string;
  accountName: string;
  isActive: boolean;
  lastUsedAt: string;
  lastTransferReceivedAt?: string;
  totalMoneyCollected?: number;
}

type TabKey = "owner" | "venue" | "court" | "manage" | "customers" | "accounts";

const calculateHours = (open: string, close: string) => {
  if (!open || !close) return 24;
  const [openHr] = open.split(":").map(Number);
  const [closeHr] = close.split(":").map(Number);
  let hours = (closeHr ?? 0) - (openHr ?? 0);
  if (hours <= 0) hours += 24;
  return hours;
};

export function AdminSetupView() {
  const [activeTab, setActiveTab] = useState<TabKey>("owner");
  const [ownersList, setOwnersList] = useState<Owner[]>([]);
  const [venuesList, setVenuesList] = useState<Venue[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [accountsList, setAccountsList] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const [ownerData, setOwnerData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });

  const [venueData, setVenueData] = useState({
    name: "",
    phone: "",
    city: "Alexandria",
    area: "",
    ownerId: "",
    openTime: "08:00",
    closeTime: "02:00",
    eveningStartTime: "18:00",
  });
  const [venueImage, setVenueImage] = useState<File | null>(null);
  const [courtData, setCourtData] = useState({
    venueId: "",
    name: "",
    sportType: "padel",
    priceMorning: "",
    priceEvening: "",
  });
  const [courtImage, setCourtImage] = useState<File | null>(null);

  const [accountData, setAccountData] = useState({
    type: "vodafone_cash",
    identifier: "",
    accountName: "",
  });

  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({
    type: "vodafone_cash",
    identifier: "",
    accountName: "",
  });

  const [editVenueId, setEditVenueId] = useState<string | null>(null);
  const [editVenueForm, setEditVenueForm] = useState({
    name: "",
    phone: "",
    area: "",
    details: "",
    ownerId: "",
    openTime: "08:00",
    closeTime: "02:00",
    eveningStartTime: "18:00",
  });
  const [editVenueImage, setEditVenueImage] = useState<File | null>(null);

  const [editCourtId, setEditCourtId] = useState<string | null>(null);
  const [editCourtForm, setEditCourtForm] = useState({
    name: "",
    sportType: "padel",
    priceMorning: "",
    priceEvening: "",
  });
  const [editCourtImage, setEditCourtImage] = useState<File | null>(null);

  const loadVenues = async () => {
    try {
      setVenuesList(await fetchAllVenues());
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };
  const loadOwners = async () => {
    try {
      setOwnersList(await fetchAllOwners());
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };
  const loadAccounts = async () => {
    setLoading(true);
    try {
      setAccountsList(await fetchPaymentAccounts());
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((activeTab === "venue" || activeTab === "manage") && ownersList.length === 0) loadOwners();
    if ((activeTab === "court" || activeTab === "manage") && venuesList.length === 0) loadVenues();
    if (activeTab === "customers" && customersList.length === 0) {
      setLoading(true);
      fetchAllCustomers()
        .then(setCustomersList)
        .catch((err: unknown) => toast.error(err as string))
        .finally(() => setLoading(false));
    }
    if (activeTab === "accounts" && accountsList.length === 0) loadAccounts();
  }, [activeTab, customersList.length, ownersList.length, venuesList.length, accountsList.length]);

  const handleCreateOwner = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (ownerData.password !== ownerData.passwordConfirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      await createOwnerAccount(ownerData);
      toast.success("تم إنشاء حساب المالك بنجاح");
      setOwnerData({ name: "", email: "", phone: "", password: "", passwordConfirm: "" });
      setOwnersList([]);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const computedHours = calculateHours(venueData.openTime, venueData.closeTime);

      const formData = new FormData();
      formData.append("name", venueData.name);
      formData.append("phone", venueData.phone);
      formData.append("address[city]", venueData.city);
      formData.append("address[area]", venueData.area);
      formData.append("owner", venueData.ownerId);

      formData.append("openTime", venueData.openTime);
      formData.append("closeTime", venueData.closeTime);
      formData.append("eveningStartTime", venueData.eveningStartTime);
      formData.append("operatingHours", String(computedHours));

      if (venueImage) formData.append("image", venueImage);
      await createVenueByAdmin(formData);
      toast.success("تم إنشاء النادي بنجاح");
      setVenueData({
        name: "",
        phone: "",
        city: "Alexandria",
        area: "",
        ownerId: "",
        openTime: "08:00",
        closeTime: "02:00",
        eveningStartTime: "18:00",
      });
      setVenueImage(null);
      setVenuesList([]);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", courtData.name);
      formData.append("sportType", courtData.sportType);
      formData.append("priceMorning", courtData.priceMorning);
      formData.append("priceEvening", courtData.priceEvening);
      formData.append("venue", courtData.venueId);
      if (courtImage) formData.append("image", courtImage);
      await createCourtByAdmin(formData);
      toast.success("تم إضافة الملعب للنادي بنجاح");
      setCourtData({
        venueId: "",
        name: "",
        sportType: "padel",
        priceMorning: "",
        priceEvening: "",
      });
      setCourtImage(null);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createPaymentAccount(accountData);
      toast.success("تم إضافة حساب الدفع بنجاح");
      setAccountData({ type: "vodafone_cash", identifier: "", accountName: "" });
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccount = async (id: string) => {
    try {
      await togglePaymentAccount(id);
      toast.success("تم تغيير حالة الحساب بنجاح");
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const startEditAccount = (acc: PaymentAccount) => {
    setEditAccountId(acc._id);
    setEditAccountForm({
      type: acc.type,
      identifier: acc.identifier,
      accountName: acc.accountName,
    });
  };

  const handleUpdateAccount = async (id: string) => {
    try {
      await updatePaymentAccount(id, editAccountForm);
      toast.success("تم تعديل الحساب بنجاح");
      setEditAccountId(null);
      loadAccounts();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذا الحساب نهائياً؟ لا يمكن التراجع عن هذه الخطوة.")) {
      try {
        await deletePaymentAccount(id);
        toast.success("تم حذف الحساب بنجاح");
        loadAccounts();
      } catch (err: unknown) {
        toast.error(err as string);
      }
    }
  };

  const startEditVenue = (venue: Venue) => {
    setEditVenueId(venue._id);
    setEditVenueImage(null);
    setEditVenueForm({
      name: venue.name,
      phone: venue.phone,
      area: venue.address?.area || "",
      details: venue.address?.details || "",
      ownerId: venue.owner?._id || "",
      openTime: venue.openTime || "08:00",
      closeTime: venue.closeTime || "02:00",
      eveningStartTime: venue.eveningStartTime || "18:00",
    });
  };

  const saveEditVenue = async (id: string) => {
    try {
      const computedHours = calculateHours(editVenueForm.openTime, editVenueForm.closeTime);

      const formData = new FormData();
      formData.append("name", editVenueForm.name);
      formData.append("phone", editVenueForm.phone);
      formData.append("address[city]", "Alexandria");
      formData.append("address[area]", editVenueForm.area);

      formData.append("openTime", editVenueForm.openTime);
      formData.append("closeTime", editVenueForm.closeTime);
      formData.append("eveningStartTime", editVenueForm.eveningStartTime);
      formData.append("operatingHours", String(computedHours));

      if (editVenueForm.details) formData.append("address[details]", editVenueForm.details);
      formData.append("owner", editVenueForm.ownerId);
      if (editVenueImage) formData.append("image", editVenueImage);
      await updateVenueByAdmin(id, formData);
      toast.success("تم تحديث بيانات النادي بنجاح");
      setEditVenueId(null);
      setEditVenueImage(null);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const startEditCourt = (court: Court) => {
    setEditCourtId(court._id);
    setEditCourtImage(null);
    setEditCourtForm({
      name: court.name,
      sportType: court.sportType,
      priceMorning: String(court.priceMorning || court.pricePerHour || 0),
      priceEvening: String(court.priceEvening || court.pricePerHour || 0),
    });
  };

  const saveEditCourt = async (id: string) => {
    try {
      const formData = new FormData();
      formData.append("name", editCourtForm.name);
      formData.append("priceMorning", String(editCourtForm.priceMorning));
      formData.append("priceEvening", String(editCourtForm.priceEvening));
      formData.append("sportType", editCourtForm.sportType);
      if (editCourtImage) formData.append("image", editCourtImage);
      await updateCourtByAdmin(id, formData);
      toast.success("تم تحديث بيانات الملعب بنجاح");
      setEditCourtId(null);
      setEditCourtImage(null);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  return (
    <div className="card-surface p-4 sm:p-6 mt-8 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
          <Settings2 className="size-6 text-primary" /> الإدارة الشاملة للنظام
        </h2>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "owner", icon: UserPlus, label: "إضافة مالك" },
          { id: "venue", icon: Building2, label: "إنشاء نادي" },
          { id: "court", icon: Dribbble, label: "إضافة ملعب" },
          { id: "manage", icon: Edit, label: "إدارة الملاعب" },
          { id: "customers", icon: Users, label: "العملاء" },
          { id: "accounts", icon: Wallet, label: "حسابات الدفع" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabKey)}
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

      {activeTab === "owner" && (
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
      )}

      {activeTab === "venue" && (
        <form
          onSubmit={handleCreateVenue}
          className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom-2"
        >
          <select
            required
            value={venueData.ownerId}
            onChange={(e) => setVenueData({ ...venueData, ownerId: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
          >
            <option value="">-- اختر المالك --</option>
            {ownersList.map((owner) => (
              <option key={owner._id} value={owner._id}>
                {owner.name} ({owner.phone})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="اسم النادي (مثال: Alex Padel Arena)"
            required
            value={venueData.name}
            onChange={(e) => setVenueData({ ...venueData, name: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="tel"
              placeholder="رقم هاتف النادي"
              required
              value={venueData.phone}
              onChange={(e) => setVenueData({ ...venueData, phone: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
              dir="ltr"
            />
            <input
              type="text"
              placeholder="المنطقة (مثال: سموحة)"
              required
              value={venueData.area}
              onChange={(e) => setVenueData({ ...venueData, area: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/30 p-3 rounded-xl border border-border">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
                يفتح الساعة
              </label>
              <input
                type="time"
                required
                value={venueData.openTime}
                onChange={(e) => setVenueData({ ...venueData, openTime: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none font-bold"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">
                يغلق الساعة
              </label>
              <input
                type="time"
                required
                value={venueData.closeTime}
                onChange={(e) => setVenueData({ ...venueData, closeTime: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none font-bold"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-primary mb-1.5 block">
                بداية السعر المسائي
              </label>
              <input
                type="time"
                required
                value={venueData.eveningStartTime}
                onChange={(e) => setVenueData({ ...venueData, eveningStartTime: e.target.value })}
                className="w-full rounded-lg border border-primary/50 bg-primary/5 px-3 py-2 text-sm outline-none font-bold"
                dir="ltr"
              />
            </div>
            <div className="col-span-1 sm:col-span-3">
              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Clock className="size-3.5" />
                إجمالي ساعات العمل المحسوبة:{" "}
                {calculateHours(venueData.openTime, venueData.closeTime)} ساعة
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition">
            <input
              type="file"
              accept="image/*"
              id="venueImg"
              className="hidden"
              onChange={(e) => setVenueImage(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="venueImg"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-bold text-muted-foreground">
                {venueImage ? venueImage.name : "صورة النادي (اختياري)"}
              </span>
            </label>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Building2 className="size-5" />
            )}{" "}
            تسجيل النادي
          </button>
        </form>
      )}

      {activeTab === "court" && (
        <form
          onSubmit={handleCreateCourt}
          className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom-2"
        >
          <select
            required
            value={courtData.venueId}
            onChange={(e) => setCourtData({ ...courtData, venueId: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
          >
            <option value="">-- اختر النادي --</option>
            {venuesList.map((venue) => (
              <option key={venue._id} value={venue._id}>
                {venue.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="اسم الملعب (مثال: بادل 1)"
              required
              value={courtData.name}
              onChange={(e) => setCourtData({ ...courtData, name: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            />
            <select
              required
              value={courtData.sportType}
              onChange={(e) => setCourtData({ ...courtData, sportType: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none cursor-pointer"
            >
              <option value="padel">بادل (Padel)</option>
              <option value="football">كرة قدم خماسي</option>
              <option value="football_7">كرة قدم سباعي</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="السعر الصباحي (ج.م/ساعة)"
              required
              min="0"
              value={courtData.priceMorning}
              onChange={(e) => setCourtData({ ...courtData, priceMorning: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
              dir="ltr"
            />
            <input
              type="number"
              placeholder="السعر المسائي (ج.م/ساعة)"
              required
              min="0"
              value={courtData.priceEvening}
              onChange={(e) => setCourtData({ ...courtData, priceEvening: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
              dir="ltr"
            />
          </div>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition">
            <input
              type="file"
              accept="image/*"
              id="courtImg"
              className="hidden"
              onChange={(e) => setCourtImage(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="courtImg"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-bold text-muted-foreground">
                {courtImage ? courtImage.name : "صورة الملعب (اختياري)"}
              </span>
            </label>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Dribbble className="size-5" />
            )}{" "}
            إضافة الملعب
          </button>
        </form>
      )}

      {activeTab === "manage" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          {venuesList.map((venue) => (
            <div
              key={venue._id}
              className="border border-border rounded-2xl bg-surface overflow-hidden"
            >
              <div className="bg-muted/30 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {editVenueId === venue._id ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full animate-in fade-in">
                    <input
                      type="text"
                      value={editVenueForm.name}
                      onChange={(e) => setEditVenueForm({ ...editVenueForm, name: e.target.value })}
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="اسم النادي"
                    />
                    <input
                      type="text"
                      value={editVenueForm.phone}
                      onChange={(e) =>
                        setEditVenueForm({ ...editVenueForm, phone: e.target.value })
                      }
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="التليفون"
                    />
                    <select
                      value={editVenueForm.ownerId}
                      onChange={(e) =>
                        setEditVenueForm({ ...editVenueForm, ownerId: e.target.value })
                      }
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      {ownersList.map((o) => (
                        <option key={o._id} value={o._id}>
                          {o.name} - ({o.phone})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editVenueForm.area}
                      onChange={(e) => setEditVenueForm({ ...editVenueForm, area: e.target.value })}
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="المنطقة الرئيسية"
                    />

                    <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-3 bg-background p-2 rounded-lg border border-border">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          يفتح الساعة
                        </label>
                        <input
                          type="time"
                          value={editVenueForm.openTime}
                          onChange={(e) =>
                            setEditVenueForm({ ...editVenueForm, openTime: e.target.value })
                          }
                          className="w-full rounded-md border px-2 py-1.5 text-xs font-bold"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          يغلق الساعة
                        </label>
                        <input
                          type="time"
                          value={editVenueForm.closeTime}
                          onChange={(e) =>
                            setEditVenueForm({ ...editVenueForm, closeTime: e.target.value })
                          }
                          className="w-full rounded-md border px-2 py-1.5 text-xs font-bold"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary block mb-1">
                          بداية المسائي
                        </label>
                        <input
                          type="time"
                          value={editVenueForm.eveningStartTime}
                          onChange={(e) =>
                            setEditVenueForm({ ...editVenueForm, eveningStartTime: e.target.value })
                          }
                          className="w-full rounded-md border border-primary/50 bg-primary/5 px-2 py-1.5 text-xs font-bold"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col md:flex-row gap-2">
                      <input
                        type="text"
                        value={editVenueForm.details}
                        onChange={(e) =>
                          setEditVenueForm({ ...editVenueForm, details: e.target.value })
                        }
                        className="flex-1 rounded-lg border px-3 py-2 text-sm"
                        placeholder="العنوان التفصيلي"
                      />
                      <label className="md:w-1/3 cursor-pointer bg-muted/50 border border-dashed border-border rounded-lg px-2 py-2 text-[11px] text-center hover:bg-muted text-muted-foreground transition flex items-center justify-center">
                        <ImageIcon className="size-3.5 inline mr-1" />
                        {editVenueImage ? editVenueImage.name : "صورة النادي"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0])
                              setEditVenueImage(e.target.files[0]);
                          }}
                        />
                      </label>
                    </div>
                    <div className="md:col-span-2 flex gap-2 mt-1">
                      <button
                        onClick={() => saveEditVenue(venue._id)}
                        className="bg-success text-white px-4 py-2 rounded-lg text-xs font-bold w-full"
                      >
                        حفظ التعديلات
                      </button>
                      <button
                        onClick={() => setEditVenueId(null)}
                        className="bg-muted text-foreground px-4 py-2 rounded-lg text-xs font-bold w-full"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <h3 className="font-extrabold text-lg flex items-center gap-2">
                        <Building2 className="size-5 text-primary" /> {venue.name}
                      </h3>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <UserPlus className="size-3" /> المالك:{" "}
                          <span className="font-bold text-foreground">{venue.owner?.name}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3" /> المنطقة:{" "}
                          <span className="font-bold text-foreground">{venue.address?.area}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock className="size-3" /> المواعيد:{" "}
                          <span className="font-bold text-primary" dir="ltr">
                            {venue.openTime || "08:00"} - {venue.closeTime || "02:00"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            | مسائي بدءاً من: {venue.eveningStartTime || "18:00"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => startEditVenue(venue)}
                      className="bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-muted"
                    >
                      <Edit className="size-3" /> تعديل النادي
                    </button>
                  </>
                )}
              </div>

              <div className="p-4 border-t border-border">
                <h4 className="text-xs font-extrabold text-muted-foreground mb-3 uppercase tracking-wider">
                  ملاعب النادي ({venue.courts?.length || 0})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {venue.courts?.map((court) => (
                    <div
                      key={court._id}
                      className="border border-border/60 bg-background rounded-xl p-3 flex flex-col justify-between"
                    >
                      {editCourtId === court._id ? (
                        <div className="space-y-2 animate-in fade-in">
                          <input
                            type="text"
                            value={editCourtForm.name}
                            onChange={(e) =>
                              setEditCourtForm({ ...editCourtForm, name: e.target.value })
                            }
                            className="w-full rounded-md border px-2 py-1.5 text-xs"
                            placeholder="اسم الملعب"
                          />
                          {/* +++ التعديل المطلوب: إضافة عناوين الأسعار الصباحية والمسائية +++ */}
                          <div className="flex gap-2">
                            <div className="w-1/2">
                              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                <Sun className="size-3 text-warning" /> السعر الصباحي
                              </label>
                              <input
                                type="number"
                                value={editCourtForm.priceMorning}
                                onChange={(e) =>
                                  setEditCourtForm({
                                    ...editCourtForm,
                                    priceMorning: e.target.value,
                                  })
                                }
                                className="w-full rounded-md border px-2 py-1.5 text-xs"
                                placeholder="مثال: 150"
                              />
                            </div>
                            <div className="w-1/2">
                              <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                <Moon className="size-3 text-primary" /> السعر المسائي
                              </label>
                              <input
                                type="number"
                                value={editCourtForm.priceEvening}
                                onChange={(e) =>
                                  setEditCourtForm({
                                    ...editCourtForm,
                                    priceEvening: e.target.value,
                                  })
                                }
                                className="w-full rounded-md border px-2 py-1.5 text-xs"
                                placeholder="مثال: 250"
                              />
                            </div>
                          </div>
                          <select
                            value={editCourtForm.sportType}
                            onChange={(e) =>
                              setEditCourtForm({ ...editCourtForm, sportType: e.target.value })
                            }
                            className="w-full rounded-md border px-2 py-1.5 text-xs"
                          >
                            <option value="padel">بادل</option>
                            <option value="football">خماسي</option>
                            <option value="football_7">سباعي</option>
                          </select>
                          <div className="flex items-center gap-2 mt-1">
                            <label className="flex-1 cursor-pointer bg-muted/50 border border-dashed border-border rounded-md px-2 py-1.5 text-[10px] text-center hover:bg-muted text-muted-foreground transition">
                              <ImageIcon className="size-3 inline mr-1" />
                              {editCourtImage ? editCourtImage.name : "تغيير صورة الملعب"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0])
                                    setEditCourtImage(e.target.files[0]);
                                }}
                              />
                            </label>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEditCourt(court._id)}
                              className="flex-1 bg-primary text-white py-1.5 rounded-md text-[10px] font-bold hover:bg-primary/90 transition"
                            >
                              حفظ التعديل
                            </button>
                            <button
                              onClick={() => setEditCourtId(null)}
                              className="flex-1 bg-muted text-foreground py-1.5 rounded-md text-[10px] font-bold hover:bg-muted/80 transition"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-sm">{court.name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                court.sportType === "padel"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : court.sportType === "football_7"
                                    ? "bg-orange-500/10 text-orange-500"
                                    : "bg-emerald-500/10 text-emerald-500",
                              )}
                            >
                              {court.sportType === "padel"
                                ? "بادل"
                                : court.sportType === "football_7"
                                  ? "سباعي"
                                  : "خماسي"}
                            </span>
                          </div>
                          <div className="flex justify-between items-end mt-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-primary text-xs flex items-center gap-1">
                                <Sun className="size-3" /> صباحاً:{" "}
                                {court.priceMorning || court.pricePerHour}{" "}
                                <span className="text-[9px] text-muted-foreground">ج/س</span>
                              </span>
                              <span className="font-black text-primary text-xs flex items-center gap-1">
                                <Moon className="size-3" /> مساءً:{" "}
                                {court.priceEvening || court.pricePerHour}{" "}
                                <span className="text-[9px] text-muted-foreground">ج/س</span>
                              </span>
                            </div>
                            <button
                              onClick={() => startEditCourt(court)}
                              className="text-muted-foreground hover:text-primary transition bg-muted/50 p-1.5 rounded-lg"
                            >
                              <Edit className="size-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "accounts" && (
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
                <option value="vodafone_cash">فودافون كاش</option>
                <option value="instapay">إنستا باي</option>
              </select>
              <input
                type="text"
                placeholder={
                  accountData.type === "vodafone_cash"
                    ? "رقم المحفظة (مثال: 010...)"
                    : "عنوان إنستا باي (مثال: name@instapay)"
                }
                required
                value={accountData.identifier}
                onChange={(e) => setAccountData({ ...accountData, identifier: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
              <input
                type="text"
                placeholder="اسم صاحب الحساب (للتأكيد)"
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
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}{" "}
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
                            <option value="vodafone_cash">فودافون</option>
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
                        <td
                          className="px-2 py-2 text-center text-muted-foreground text-xs"
                          colSpan={3}
                        >
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
                          {account.type === "vodafone_cash" ? "فودافون كاش" : "إنستا باي"}
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

                        <td
                          className="px-4 py-3 text-center text-xs font-bold text-success"
                          dir="ltr"
                        >
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
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground font-bold"
                    >
                      لا توجد حسابات دفع مسجلة حتى الآن
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "customers" && (
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
      )}
    </div>
  );
}
