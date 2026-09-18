import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  Wallet,
  FileWarning,
  FileImage,
  CalendarDays,
  TrendingUp,
  ArchiveRestore,
  Ban,
  Info,
  AlertCircle, // +++ أضفنا الأيقونة دي للتنبيه +++
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchAllPayments,
  fetchUnmatchedPayments,
  manuallyVerifyPayment,
  processUnmatchedPayment,
  // @ts-expect-error: until paymentApi.js is migrated to TypeScript or has typings.
} from "@/api/paymentApi";

interface Payment {
  _id: string;
  expectedAmount: number;
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
    venue?: { name: string };
    user?: { name: string; phone: string };
    court?: { name: string };
    guestData?: { name: string; phone: string };
  };
}

interface UnmatchedPayment {
  _id: string;
  amount: number;
  method: string;
  senderPhone?: string;
  transactionId?: string;
  message: string;
  receivedAt: string;
  processed: boolean;
  adminNote?: string;
}

type TabKey = "pending" | "verified" | "unmatched" | "processed" | "expired" | "all";

const formatDateTime = (dateString: string | undefined) => {
  if (!dateString) return "---";
  return new Date(dateString).toLocaleString("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AdminPaymentsView() {
  const [activeTab, setActiveTab] = useState<TabKey>("unmatched");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [unmatchedNotes, setUnmatchedNotes] = useState<Record<string, string>>({});

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
      const [paymentsData, unmatchedData] = await Promise.all([
        fetchAllPayments({ date: dateStr }),
        fetchUnmatchedPayments({ date: dateStr }),
      ]);
      setPayments(paymentsData || []);
      setUnmatched(unmatchedData || []);
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const totalOnlineConfirmed = payments
      .filter((p) => p.status === "verified" && p.method !== "cash")
      .reduce((sum, p) => sum + p.expectedAmount, 0);
    const totalPending = payments
      .filter((p) => p.status === "pending" || p.status === "pending_verification")
      .reduce((sum, p) => sum + p.expectedAmount, 0);
    const totalUnmatched = unmatched
      .filter((u) => !u.processed)
      .reduce((sum, u) => sum + u.amount, 0);
    return { totalOnlineConfirmed, totalPending, totalUnmatched };
  }, [payments, unmatched]);

  const handleVerify = async (id: string, isExpired: boolean = false) => {
    const msg = isExpired
      ? "إحياء الحجز وتأكيد التحويل البنكي؟"
      : "تأكيد استلام التحويل البنكي يدوياً؟";
    if (!window.confirm(msg)) return;
    try {
      await manuallyVerifyPayment(
        id,
        isExpired ? "تم إحياء الحجز وتأكيد التحويل" : "تأكيد يدوي للتحويل من الإدارة",
      );
      toast.success("تم التأكيد بنجاح");
      loadData();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const handleProcessUnmatched = async (id: string) => {
    const note = unmatchedNotes[id];
    if (!note || note.trim() === "") {
      toast.error("يرجى كتابة ملاحظة!");
      return;
    }
    try {
      await processUnmatchedPayment(id, note);
      toast.success("تمت المعالجة بنجاح");
      loadData();
    } catch (err: unknown) {
      toast.error(err as string);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (activeTab === "all" && p.status === "expired") return false;
    if (activeTab === "pending" && p.status !== "pending" && p.status !== "pending_verification")
      return false;
    if (activeTab === "verified" && p.status !== "verified") return false;
    if (activeTab === "expired" && p.status !== "expired") return false;
    const term = search.toLowerCase();
    return (
      p.expectedAmount?.toString().includes(term) ||
      p.booking?.user?.phone?.includes(term) ||
      p.booking?.venue?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-border pt-6 mt-6">
        <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
          <Wallet className="size-6 text-primary" /> الإدارة المركزية للتحويلات
        </h2>
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-xl shadow-sm">
          <CalendarDays className="size-5 text-muted-foreground ml-2" />
          <input
            type="date"
            value={formatDateForInput(selectedDate)}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(new Date(e.target.value));
            }}
            className="bg-transparent text-sm font-bold outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-surface p-4 border-b-4 border-b-destructive">
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="size-4" /> أموال غير مطابقة (معلقة)
          </p>
          <p className="font-display text-2xl font-black text-destructive">
            {summary.totalUnmatched} ج.م
          </p>
        </div>
        <div className="card-surface p-4 border-b-4 border-b-success">
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="size-4" /> إيرادات إلكترونية مؤكدة
          </p>
          <p className="font-display text-2xl font-black text-success">
            {summary.totalOnlineConfirmed} ج.م
          </p>
        </div>
        <div className="card-surface p-4 border-b-4 border-b-warning">
          <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="size-4" /> تحويلات قيد المراجعة
          </p>
          <p className="font-display text-2xl font-black text-warning">
            {summary.totalPending} ج.م
          </p>
        </div>
      </div>

      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: "unmatched", label: "أموال معلقة", icon: AlertTriangle },
            { id: "processed", label: "معالجة", icon: ArchiveRestore },
            { id: "pending", label: "قيد المراجعة", icon: Clock },
            { id: "verified", label: "مؤكدة", icon: CheckCircle2 },
            { id: "expired", label: "منتهية", icon: Ban },
            { id: "all", label: "الكل", icon: Wallet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition",
                activeTab === tab.id
                  ? tab.id === "unmatched"
                    ? "bg-destructive text-white"
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
            placeholder="بحث شامل..."
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
      ) : activeTab === "unmatched" || activeTab === "processed" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(() => {
            const displayList = unmatched.filter((u) =>
              activeTab === "processed" ? u.processed : !u.processed,
            );
            if (displayList.length === 0)
              return (
                <div className="col-span-full text-center py-10 font-bold text-muted-foreground">
                  لا توجد داتا هنا
                </div>
              );
            return displayList.map((u) => (
              <div
                key={u._id}
                className={cn(
                  "card-surface p-5 border-l-4",
                  u.processed ? "border-l-success" : "border-l-destructive",
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div
                    className={cn(
                      "flex items-center gap-2 font-bold",
                      u.processed ? "text-success" : "text-destructive",
                    )}
                  >
                    {u.processed ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <FileWarning className="size-5" />
                    )}
                    {u.processed ? "تمت المعالجة" : "تحويل مجهول"}
                  </div>
                  <span className="font-display text-lg font-black">{u.amount} ج.م</span>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p>
                    <strong>رقم المرسل:</strong> <span dir="ltr">{u.senderPhone || "---"}</span>
                  </p>
                  <p>
                    <strong>رقم المعاملة:</strong> {u.transactionId || "---"}
                  </p>
                  <p>
                    <strong>الرسالة الأصلية:</strong> {u.message}
                  </p>
                </div>
                {u.processed ? (
                  <div className="mt-3 bg-success/10 border border-success/20 p-3 rounded-lg text-xs leading-relaxed font-semibold">
                    ملاحظة: {u.adminNote}
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="قرارك إيه؟"
                      value={unmatchedNotes[u._id] || ""}
                      onChange={(e) =>
                        setUnmatchedNotes({ ...unmatchedNotes, [u._id]: e.target.value })
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none"
                    />
                    <button
                      onClick={() => handleProcessUnmatched(u._id)}
                      className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
                    >
                      معالجة
                    </button>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPayments.map((p) => (
            <div
              key={p._id}
              className={cn(
                "card-surface p-5 flex flex-col justify-between transition-all duration-200",
                // +++ ستايل خاص للكارت المنتهي +++
                p.status === "expired"
                  ? "border-dashed border-2 border-destructive/30 bg-destructive/5 grayscale-[15%]"
                  : "hover:shadow-md",
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground bg-background border border-border px-2 py-1 rounded-md inline-block mb-2 shadow-sm">
                    {p.booking?.venue?.name} <span className="mx-1">•</span>{" "}
                    {p.booking?.court?.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {/* +++ شطب المبلغ لو كان منتهي +++ */}
                    <p
                      className={cn(
                        "font-display text-xl font-black",
                        p.status === "expired"
                          ? "text-muted-foreground line-through opacity-70"
                          : "text-primary",
                      )}
                    >
                      {p.expectedAmount} ج.م
                    </p>
                    {p.status === "expired" && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md border border-destructive/20">
                        لم يُدفع
                      </span>
                    )}
                  </div>
                </div>
                {/* +++ تغيير البادج ليصبح أحمر وواضح +++ */}
                <span
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow-sm border",
                    p.status === "verified"
                      ? "bg-success/10 text-success border-success/20"
                      : p.status === "expired"
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-warning/10 text-warning border-warning/20",
                  )}
                >
                  {p.status === "verified"
                    ? "مؤكد"
                    : p.status === "expired"
                      ? "ملغي (لم يُدفع)"
                      : "في الانتظار"}
                </span>
              </div>

              {/* +++ رسالة تنبيه واضحة للكارت المنتهي +++ */}
              {p.status === "expired" && (
                <div className="mb-4 bg-background border border-destructive/20 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                  <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed">
                    هذا مجرد سجل لطلب حجز. العميل لم يقم بتحويل المبلغ وتم إلغاء حجزه آلياً.
                  </p>
                </div>
              )}

              <div className="space-y-2 text-sm mb-4">
                <p className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">موعد الحجز</span>
                  <span
                    className={cn(
                      "font-bold text-[11px] px-2 py-0.5 rounded-md",
                      p.status === "expired"
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {formatDateTime(p.booking?.startTime)}
                  </span>
                </p>

                {/* +++ تغيير المسميات حسب حالة الكارت +++ */}
                <p className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">
                    {p.status === "expired" ? "هاتف العميل" : "الرقم المحول"}
                  </span>
                  <span
                    className={cn(
                      "font-bold",
                      p.status === "expired" ? "text-muted-foreground" : "text-primary",
                    )}
                    dir="ltr"
                  >
                    {p.senderPhone ||
                      p.booking?.user?.phone ||
                      p.booking?.guestData?.phone ||
                      "---"}
                  </span>
                </p>

                <p className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">
                    {p.status === "expired" ? "وقت الطلب" : "وقت التحويل"}
                  </span>
                  <span className="font-bold text-[11px] text-muted-foreground" dir="ltr">
                    {formatDateTime(p.createdAt)}
                  </span>
                </p>

                {p.manualTransactionId && (
                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">المرجع</span>
                    <span className="font-bold text-muted-foreground" dir="ltr">
                      {p.manualTransactionId}
                    </span>
                  </p>
                )}
                <p className="flex justify-between">
                  <span className="text-muted-foreground">طريقة الدفع</span>
                  <span className="font-bold text-muted-foreground">{p.method}</span>
                </p>
              </div>

              {p.verificationNotes && (
                <div className="mb-4 rounded-xl bg-success/5 border border-success/10 p-3 text-xs">
                  <p className="font-bold flex items-center gap-1.5 text-success mb-1">
                    <Info className="size-4" /> ملاحظات:
                  </p>
                  <p className="text-muted-foreground leading-relaxed">{p.verificationNotes}</p>
                </div>
              )}

              {p.proofImage && (
                <a
                  href={`http://localhost:3000${p.proofImage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-info/10 text-info border border-info/20 hover:bg-info hover:text-white transition py-2 text-xs font-bold mb-2"
                >
                  <FileImage className="size-4" /> الإثبات المرفوع
                </a>
              )}
              {(p.status === "pending" || p.status === "pending_verification") &&
                p.method !== "cash" && (
                  <button
                    onClick={() => handleVerify(p._id, false)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition py-2.5 text-sm font-bold"
                  >
                    <Check className="size-4" /> تأكيد التحويل للإدارة
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
