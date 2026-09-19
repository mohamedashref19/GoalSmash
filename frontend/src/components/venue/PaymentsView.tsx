import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  Search,
  Check,
  Wallet,
  FileImage,
  Info,
  CalendarDays,
  TrendingUp,
  Banknote,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllPayments, manuallyVerifyPayment, addPaymentNote } from "@/api/paymentApi";
// @ts-expect-error: until axiosConfig.js is migrated to TypeScript or has typings.
import { BACKEND_URL } from "@/api/axiosConfig";

interface Payment {
  _id: string;
  expectedAmount: number;
  baseAmount?: number; // +++ تم إضافة الحقل ده للاعتماد عليه +++
  amountReceived?: number;
  method: string;
  status: string;
  transactionId?: string;
  senderPhone?: string;
  createdAt: string;
  verifiedAt?: string;
  verificationNotes?: string;
  proofImage?: string;
  manualTransactionId?: string;
  booking?: {
    startTime: string;
    status: string;
    totalPrice?: number; // +++ لضمان قراءة السعر الصافي +++
    venue?: { name: string };
    user?: { name: string; phone: string };
    court?: { name: string };
    guestData?: { name: string; phone: string };
  };
}

type TabKey = "all" | "verified" | "manual" | "expired";

const formatDateTime = (dateString: string | undefined) => {
  if (!dateString) return "---";
  return new Date(dateString).toLocaleString("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function PaymentsView({ venueId }: { venueId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("verified");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [paymentNotesInput, setPaymentNotesInput] = useState<Record<string, string>>({});

  const formatDateForInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = formatDateForInput(selectedDate);
      const data = await fetchAllPayments({ date: dateStr }, venueId);

      const filteredDataForOwner = (data || []).filter((p: Payment) => {
        if (p.method !== "cash" && (p.status === "pending" || p.status === "pending_verification"))
          return false;
        return true;
      });

      setPayments(filteredDataForOwner);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  }, [venueId, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // +++ دالة مساعدة للحصول على السعر الصافي بدون كسور للمالك +++
  const getDisplayAmount = (p: Payment) => {
    if (p.method === "cash" && p.amountReceived !== undefined) return p.amountReceived;
    if (p.baseAmount) return p.baseAmount;
    if (p.booking?.totalPrice) return p.booking.totalPrice;
    return p.expectedAmount; // آخر حل لو مفيش غيره
  };

  const summary = useMemo(() => {
    const totalConfirmed = payments
      .filter((p) => p.status === "verified" && p.method !== "cash")
      .reduce((sum, p) => sum + getDisplayAmount(p), 0); // +++ استخدام السعر الصافي +++

    const totalCash = payments
      .filter((p) => p.method === "cash")
      .reduce((sum, p) => sum + getDisplayAmount(p), 0); // +++ استخدام السعر الصافي +++

    const totalOverall = totalConfirmed + totalCash;

    return {
      totalConfirmed: Number(totalConfirmed.toFixed(2)),
      totalCash: Number(totalCash.toFixed(2)),
      totalOverall: Number(totalOverall.toFixed(2)),
    };
  }, [payments]);

  const handleVerify = async (id: string, isExpired: boolean = false) => {
    const msg = isExpired
      ? "⚠️ هذا الحجز منتهي! هل تأكدت من عدم حجز الملعب لعميل آخر وتريد إحياءه؟"
      : "هل استلمت الكاش وتريد تأكيد الحجز يدوياً؟";
    if (!window.confirm(msg)) return;
    try {
      await manuallyVerifyPayment(
        id,
        isExpired ? "تم إحياء الحجز بعد الانتهاء" : "تأكيد الكاش من المالك",
      );
      toast.success("تم تأكيد الدفع بنجاح");
      loadData();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleSavePaymentNote = async (id: string, currentNote?: string) => {
    const note = paymentNotesInput[id];
    if (!note || note.trim() === "") {
      toast.error("يرجى كتابة الملاحظة!");
      return;
    }
    try {
      await addPaymentNote(id, note);
      toast.success("تم الإضافة بنجاح");
      loadData();
      setPaymentNotesInput((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (activeTab === "all" && p.status === "expired") return false;
    if (activeTab === "verified" && (p.status !== "verified" || p.method === "cash")) return false;
    if (activeTab === "manual" && p.method !== "cash") return false;
    if (activeTab === "expired" && p.status !== "expired") return false;

    const term = search.toLowerCase();
    const displayAmt = getDisplayAmount(p).toString();
    return (
      displayAmt.includes(term) ||
      p.booking?.user?.name?.toLowerCase().includes(term) ||
      p.booking?.user?.phone?.includes(term) ||
      p.booking?.guestData?.name?.toLowerCase().includes(term)
    );
  });

  const getMethodName = (method: string) => {
    if (method === "cash") return "كاش (يدوي)";
    if (method === "instapay") return "إنستا باي";
    return "فودافون كاش";
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
          <Wallet className="size-6 text-primary" /> المدفوعات
        </h2>
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-xl shadow-sm">
          <CalendarDays className="size-5 text-muted-foreground ml-2" />
          <input
            type="date"
            value={formatDateForInput(selectedDate)}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(new Date(e.target.value));
            }}
            className="bg-transparent text-sm font-bold outline-none cursor-pointer text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-surface p-4 border-b-4 border-b-primary relative overflow-hidden group">
          <div className="absolute -left-6 -top-6 bg-primary/10 size-24 rounded-full blur-xl group-hover:bg-primary/20 transition" />
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Wallet className="size-4 text-primary" /> إجمالي إيرادات اليوم
          </p>
          <p className="font-display text-2xl font-black text-primary mt-1">
            {summary.totalOverall} ج.م
          </p>
        </div>

        <div className="card-surface p-4 border-b-4 border-b-success relative overflow-hidden group">
          <div className="absolute -left-6 -top-6 bg-success/10 size-24 rounded-full blur-xl group-hover:bg-success/20 transition" />
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="size-4" /> إيرادات أونلاين
          </p>
          <p className="font-display text-2xl font-black text-success mt-1">
            {summary.totalConfirmed} ج.م
          </p>
        </div>

        <div className="card-surface p-4 border-b-4 border-b-info relative overflow-hidden group">
          <div className="absolute -left-6 -top-6 bg-info/10 size-24 rounded-full blur-xl group-hover:bg-info/20 transition" />
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Banknote className="size-4" /> إيرادات الكاش
          </p>
          <p className="font-display text-2xl font-black text-info mt-1">{summary.totalCash} ج.م</p>
        </div>
      </div>

      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4 items-center justify-between mt-2">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: "verified", label: "أونلاين", icon: CheckCircle2 },
            { id: "manual", label: "كاش", icon: Banknote },
            { id: "all", label: "الكل", icon: Wallet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition",
                activeTab === tab.id
                  ? tab.id === "expired"
                    ? "bg-muted-foreground text-white"
                    : "gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <tab.icon className="size-4" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pr-9 pl-4 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10">
          <Clock className="size-6 animate-spin text-primary" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card-surface p-10 text-center flex flex-col items-center justify-center border border-dashed border-border/60">
          <Wallet className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-bold text-sm">
            لا توجد مدفوعات في هذا التصنيف اليوم.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPayments.map((p) => (
            <div
              key={p._id}
              className={cn(
                "card-surface p-5 flex flex-col justify-between transition-all hover:shadow-md",
                p.status === "expired" && "opacity-75",
              )}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 ml-3">
                    <p className="text-xs font-semibold text-muted-foreground">المبلغ</p>
                    <p
                      className={cn(
                        "font-display text-xl font-black",
                        p.method === "cash" ? "text-info" : "text-primary",
                      )}
                    >
                      {/* +++ استخدام السعر الصافي بدون كسور في الكارت +++ */}
                      {getDisplayAmount(p)} ج.م
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold shrink-0",
                      p.status === "verified"
                        ? "bg-success/15 text-success"
                        : p.status === "expired"
                          ? "bg-muted border border-border text-muted-foreground"
                          : "bg-warning/15 text-warning",
                    )}
                  >
                    {p.status === "verified"
                      ? "مؤكد"
                      : p.status === "expired"
                        ? "منتهي"
                        : "قيد الانتظار (كاش)"}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">موعد الحجز</span>
                    <span className="font-bold text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {formatDateTime(p.booking?.startTime)}
                    </span>
                  </p>

                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">العميل</span>
                    <span className="font-bold">
                      {p.booking?.user?.name || p.booking?.guestData?.name || "غير مسجل"}
                    </span>
                  </p>
                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">الهاتف</span>
                    <span className="font-bold" dir="ltr">
                      {p.booking?.user?.phone || p.booking?.guestData?.phone || "---"}
                    </span>
                  </p>

                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">وقت الإنشاء</span>
                    <span className="font-bold text-[11px] text-muted-foreground" dir="ltr">
                      {formatDateTime(p.createdAt)}
                    </span>
                  </p>

                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">الملعب</span>
                    <span className="font-bold">{p.booking?.court?.name}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">طريقة الدفع</span>
                    <span className="font-bold">{getMethodName(p.method)}</span>
                  </p>
                </div>

                {p.verificationNotes && (
                  <div className="mb-4 flex items-start gap-2 bg-muted/50 p-2.5 rounded-lg text-xs leading-relaxed border border-border/50">
                    <Info className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-muted-foreground block mb-0.5">ملاحظات:</span>
                      <span className="font-semibold text-foreground">{p.verificationNotes}</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="إضافة ملاحظة"
                    value={paymentNotesInput[p._id] || ""}
                    onChange={(e) =>
                      setPaymentNotesInput({ ...paymentNotesInput, [p._id]: e.target.value })
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => handleSavePaymentNote(p._id, p.verificationNotes)}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
                  >
                    حفظ
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {p.proofImage && (
                  <a
                    href={`${BACKEND_URL}${p.proofImage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-info/10 text-info border border-info/20 hover:bg-info py-2 text-xs font-bold transition"
                  >
                    <FileImage className="size-4" /> الإثبات المرفوع
                  </a>
                )}

                {p.method === "cash" &&
                  (p.status === "pending" || p.status === "pending_verification") && (
                    <button
                      onClick={() => handleVerify(p._id, false)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition py-2.5 text-sm font-bold"
                    >
                      <Check className="size-4" /> تأكيد استلام الكاش
                    </button>
                  )}
                {p.method === "cash" && p.status === "expired" && (
                  <button
                    onClick={() => handleVerify(p._id, true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-warning/10 text-warning border border-warning/30 hover:bg-warning hover:text-white transition py-2.5 text-sm font-bold"
                  >
                    <CheckCircle2 className="size-4" /> تأكيد وإحياء الحجز
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
