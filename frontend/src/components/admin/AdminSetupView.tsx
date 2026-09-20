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
  X,
  MapPin,
  ImageIcon,
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
  pricePerHour: number;
  sportType: string;
}

interface Venue {
  _id: string;
  name: string;
  phone: string;
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

type TabKey = "owner" | "venue" | "court" | "manage" | "customers";

export function AdminSetupView() {
  const [activeTab, setActiveTab] = useState<TabKey>("owner");
  const [ownersList, setOwnersList] = useState<Owner[]>([]);
  const [venuesList, setVenuesList] = useState<Venue[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // حالات الإضافة
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
  });
  const [venueImage, setVenueImage] = useState<File | null>(null);
  const [courtData, setCourtData] = useState({
    venueId: "",
    name: "",
    sportType: "padel",
    pricePerHour: "",
  });
  const [courtImage, setCourtImage] = useState<File | null>(null);

  // حالات التعديل (Edit)
  const [editVenueId, setEditVenueId] = useState<string | null>(null);
  const [editVenueForm, setEditVenueForm] = useState({
    name: "",
    phone: "",
    area: "",
    details: "",
    ownerId: "",
  });
  const [editVenueImage, setEditVenueImage] = useState<File | null>(null); // +++ حالة صورة النادي الجديدة +++

  const [editCourtId, setEditCourtId] = useState<string | null>(null);
  const [editCourtForm, setEditCourtForm] = useState({
    name: "",
    pricePerHour: "",
    sportType: "padel",
  });
  const [editCourtImage, setEditCourtImage] = useState<File | null>(null);

  // جلب البيانات بذكاء حسب التاب
  const loadVenues = async () => {
    try {
      const data = await fetchAllVenues();
      setVenuesList(data);
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const loadOwners = async () => {
    try {
      const data = await fetchAllOwners();
      setOwnersList(data);
    } catch (err: unknown) {
      toast.error(err as string);
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
  }, [activeTab, customersList.length, ownersList.length, venuesList.length]);

  // --- دوال الإضافة ---
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
      const formData = new FormData();
      formData.append("name", venueData.name);
      formData.append("phone", venueData.phone);
      formData.append("address[city]", venueData.city);
      formData.append("address[area]", venueData.area);
      formData.append("owner", venueData.ownerId);
      if (venueImage) formData.append("image", venueImage);
      await createVenueByAdmin(formData);
      toast.success("تم إنشاء النادي بنجاح");
      setVenueData({ name: "", phone: "", city: "Alexandria", area: "", ownerId: "" });
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
      formData.append("pricePerHour", courtData.pricePerHour);
      formData.append("venue", courtData.venueId);
      if (courtImage) formData.append("image", courtImage);
      await createCourtByAdmin(formData);
      toast.success("تم إضافة الملعب للنادي بنجاح");
      setCourtData({ venueId: "", name: "", sportType: "padel", pricePerHour: "" });
      setCourtImage(null);
      loadVenues();
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  // --- دوال التعديل (الإدارة الشاملة) ---
  const startEditVenue = (venue: Venue) => {
    setEditVenueId(venue._id);
    setEditVenueImage(null); // تصفير الصورة
    setEditVenueForm({
      name: venue.name,
      phone: venue.phone,
      area: venue.address?.area || "",
      details: venue.address?.details || "",
      ownerId: venue.owner?._id || "",
    });
  };

  const saveEditVenue = async (id: string) => {
    try {
      // +++ استخدام FormData لتمكين رفع الصورة للنادي +++
      const formData = new FormData();
      formData.append("name", editVenueForm.name);
      formData.append("phone", editVenueForm.phone);
      formData.append("address[city]", "Alexandria");
      formData.append("address[area]", editVenueForm.area);
      if (editVenueForm.details) formData.append("address[details]", editVenueForm.details);
      formData.append("owner", editVenueForm.ownerId);

      if (editVenueImage) {
        formData.append("image", editVenueImage);
      }

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
      pricePerHour: String(court.pricePerHour),
      sportType: court.sportType,
    });
  };

  const saveEditCourt = async (id: string) => {
    try {
      const formData = new FormData();
      formData.append("name", editCourtForm.name);
      formData.append("pricePerHour", String(editCourtForm.pricePerHour));
      formData.append("sportType", editCourtForm.sportType);

      if (editCourtImage) {
        formData.append("image", editCourtImage);
      }

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

      {/* ... (فورم إضافة المالك والنادي والملعب كما هي تماماً) ... */}
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
          <input
            type="number"
            placeholder="السعر في الساعة"
            required
            min="0"
            value={courtData.pricePerHour}
            onChange={(e) => setCourtData({ ...courtData, pricePerHour: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
            dir="ltr"
          />
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

      {/* --- إدارة وتعديل الملاعب والأندية --- */}
      {activeTab === "manage" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          {venuesList.map((venue) => (
            <div
              key={venue._id}
              className="border border-border rounded-2xl bg-surface overflow-hidden"
            >
              {/* هيدر النادي (للتعديل) */}
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
                      placeholder="المنطقة الرئيسية (مثال: سموحة)"
                    />

                    {/* +++ العنوان التفصيلي + زر تغيير صورة النادي +++ */}
                    <div className="md:col-span-2 flex flex-col md:flex-row gap-2">
                      <input
                        type="text"
                        value={editVenueForm.details}
                        onChange={(e) =>
                          setEditVenueForm({ ...editVenueForm, details: e.target.value })
                        }
                        className="flex-1 rounded-lg border px-3 py-2 text-sm"
                        placeholder="العنوان التفصيلي (الشارع، علامة مميزة...)"
                      />
                      <label className="md:w-1/3 cursor-pointer bg-muted/50 border border-dashed border-border rounded-lg px-2 py-2 text-[11px] text-center hover:bg-muted text-muted-foreground transition flex items-center justify-center">
                        <ImageIcon className="size-3.5 inline mr-1" />
                        {editVenueImage ? editVenueImage.name : "تغيير صورة النادي الأساسية"}
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
                        {venue.address?.details && (
                          <p className="flex items-start gap-1.5">
                            <MapPin className="size-3 mt-0.5" /> العنوان التفصيلي:{" "}
                            <span className="font-bold text-foreground">
                              {venue.address?.details}
                            </span>
                          </p>
                        )}
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

              {/* ملاعب النادي (للتعديل) */}
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
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={editCourtForm.pricePerHour}
                              onChange={(e) =>
                                setEditCourtForm({ ...editCourtForm, pricePerHour: e.target.value })
                              }
                              className="w-1/2 rounded-md border px-2 py-1.5 text-xs"
                              placeholder="السعر بالساعة"
                            />
                            <select
                              value={editCourtForm.sportType}
                              onChange={(e) =>
                                setEditCourtForm({ ...editCourtForm, sportType: e.target.value })
                              }
                              className="w-1/2 rounded-md border px-2 py-1.5 text-xs"
                            >
                              <option value="padel">بادل</option>
                              <option value="football">خماسي</option>
                              <option value="football_7">سباعي</option>
                            </select>
                          </div>

                          {/* زر رفع الصورة للملعب */}
                          <div className="flex items-center gap-2 mt-1">
                            <label className="flex-1 cursor-pointer bg-muted/50 border border-dashed border-border rounded-md px-2 py-1.5 text-[10px] text-center hover:bg-muted text-muted-foreground transition">
                              <ImageIcon className="size-3 inline mr-1" />
                              {editCourtImage ? editCourtImage.name : "تغيير صورة الملعب (اختياري)"}
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
                            <span className="font-black text-primary text-sm">
                              {court.pricePerHour}{" "}
                              <span className="text-[10px] text-muted-foreground">ج/س</span>
                            </span>
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

      {/* ... (العملاء كما هي) ... */}
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
