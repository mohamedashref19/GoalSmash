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
  AlertCircle,
  Banknote,
  XOctagon,
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
// @ts-expect-error: until axiosConfig.js is migrated to TypeScript or has typings.
import { BACKEND_URL } from "@/api/axiosConfig";
import { useConfirm } from "../../components/venue/useConfirm";
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
    _id: string;
    startTime: string;
    status: string;
    deposit?: number;
    totalPrice?: number;
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

type TabKey = "pending" | "verified" | "unmatched" | "processed" | "expired" | "cancelled" | "all";

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
  const { confirm, ConfirmDialog } = useConfirm();

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
    const validPayments = payments.filter((p) => p.booking?.status !== "cancelled");

    const totalOnlineConfirmed = validPayments
      .filter((p) => p.status === "verified" && p.method !== "cash")
      .reduce((sum, p) => sum + (p.amountReceived || p.expectedAmount), 0);

    const totalCashConfirmed = validPayments
      .filter((p) => p.status === "verified" && p.method === "cash")
      .reduce((sum, p) => sum + (p.amountReceived || p.expectedAmount), 0);

    const totalPending = validPayments
      .filter((p) => p.status === "pending" || p.status === "pending_verification")
      .reduce((sum, p) => sum + p.expectedAmount, 0);

    const totalUnmatched = unmatched
      .filter((u) => !u.processed)
      .reduce((sum, u) => sum + u.amount, 0);

    // +++ تم إضافة التقريب لرقمين عشريين هنا +++
    return {
      totalOnlineConfirmed: Number(totalOnlineConfirmed.toFixed(2)),
      totalCashConfirmed: Number(totalCashConfirmed.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      totalUnmatched: Number(totalUnmatched.toFixed(2)),
    };
  }, [payments, unmatched]);

  const handleVerify = async (id: string, isExpired: boolean = false) => {
    const msg = isExpired
      ? "إحياء الحجز وتأكيد التحويل البنكي؟"
      : "تأكيد استلام التحويل البنكي يدوياً؟";
    //if (!window.confirm(msg)) return;
    const isConfirmed = await confirm(msg);
    if (!isConfirmed) return;
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
    const isCancelled = p.booking?.status === "cancelled";

    if (activeTab === "all") {
      if (isCancelled) return false;
      if (p.status === "expired") return false;
    } else if (activeTab === "cancelled") {
      if (!isCancelled) return false;
    } else {
      if (isCancelled) return false;
      if (activeTab === "pending" && p.status !== "pending" && p.status !== "pending_verification")
        return false;
      if (activeTab === "verified" && p.status !== "verified") return false;
      if (activeTab === "expired" && p.status !== "expired") return false;
    }

    const term = search.toLowerCase();
    return (
      p.expectedAmount?.toString().includes(term) ||
      p.booking?.user?.phone?.includes(term) ||
      p.booking?.guestData?.phone?.includes(term) ||
      p.booking?.venue?.name?.toLowerCase().includes(term)
    );
  });

  const groupedPayments = useMemo(() => {
    const groups: Record<string, Payment[]> = {};
    filteredPayments.forEach((p) => {
      const key = p.booking?._id || p._id;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(p);
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b[0]?.createdAt ?? 0).getTime() - new Date(a[0]?.createdAt ?? 0).getTime(),
    );
  }, [filteredPayments]);

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
      <ConfirmDialog />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-surface p-4 border-b-4 border-b-success">
          <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="size-3.5" /> إيرادات إلكترونية
          </p>
          <p className="font-display text-xl lg:text-2xl font-black text-success">
            {summary.totalOnlineConfirmed}{" "}
            <span className="text-sm font-bold text-muted-foreground">ج.م</span>
          </p>
        </div>

        <div className="card-surface p-4 border-b-4 border-b-blue-500">
          <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
            <Banknote className="size-3.5" /> إيرادات نقديـة (كاش)
          </p>
          <p className="font-display text-xl lg:text-2xl font-black text-blue-500">
            {summary.totalCashConfirmed}{" "}
            <span className="text-sm font-bold text-muted-foreground">ج.م</span>
          </p>
        </div>

        <div className="card-surface p-4 border-b-4 border-b-warning">
          <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="size-3.5" /> قيد المراجعة
          </p>
          <p className="font-display text-xl lg:text-2xl font-black text-warning">
            {summary.totalPending}{" "}
            <span className="text-sm font-bold text-muted-foreground">ج.م</span>
          </p>
        </div>

        <div className="card-surface p-4 border-b-4 border-b-destructive">
          <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="size-3.5" /> أموال معلقة
          </p>
          <p className="font-display text-xl lg:text-2xl font-black text-destructive">
            {summary.totalUnmatched}{" "}
            <span className="text-sm font-bold text-muted-foreground">ج.م</span>
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
            { id: "cancelled", label: "ملغاة ومستردة", icon: XOctagon },
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
      ) : groupedPayments.length === 0 ? (
        <div className="card-surface p-10 text-center flex flex-col items-center justify-center border border-dashed border-border/60">
          <Wallet className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-bold text-sm">
            لا توجد مدفوعات في هذا التصنيف اليوم.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedPayments.map((group) => {
            const firstPayment = group[0];
            const booking = firstPayment?.booking;
            const isCancelled = booking?.status === "cancelled";
            const isExpired = firstPayment?.status === "expired";

            // +++ استخدام بيانات الحجز الأصلية للحصول على السعر والمتبقي بدقة +++
            const totalDisplayAmt =
              booking?.totalPrice ||
              group.reduce((sum, p) => sum + (p.amountReceived || p.expectedAmount), 0);
            const price = booking?.totalPrice || 0;
            const deposit = booking?.deposit || 0;
            const remaining = booking ? Math.max(price - deposit, 0) : 0;

            return (
              <div
                key={firstPayment?._id}
                className={cn(
                  "card-surface p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden",
                  isExpired
                    ? "border-dashed border-2 border-destructive/30 bg-destructive/5 grayscale-[15%]"
                    : isCancelled
                      ? "border-2 border-gray-400/50 bg-gray-100/50"
                      : "hover:shadow-md",
                )}
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground bg-background border border-border px-2 py-1 rounded-md inline-block mb-2 shadow-sm">
                      {booking?.venue?.name || "معاملة مستقلة"} <span className="mx-1">•</span>{" "}
                      {booking?.court?.name || "---"}
                    </p>

                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "font-display text-xl font-black flex items-baseline gap-1",
                            isExpired || isCancelled
                              ? "text-muted-foreground line-through opacity-70"
                              : "text-primary",
                          )}
                        >
                          {totalDisplayAmt}{" "}
                          <span className="text-xs text-muted-foreground">ج.م</span>
                        </p>
                      </div>
                      {/* +++ مؤشر دقيق للمتبقي أو الخالص يعتمد على الحجز وليس التبويب +++ */}
                      {!isCancelled && !isExpired && booking && remaining > 0 && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md border border-destructive/20 self-start mt-1">
                          يُدفع في الملعب: {remaining} ج.م
                        </span>
                      )}
                      {!isCancelled && !isExpired && booking && remaining === 0 && (
                        <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-md border border-success/20 self-start mt-1 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> مدفوع بالكامل
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow-sm border",
                      isCancelled
                        ? "bg-gray-200 text-gray-600 border-gray-300"
                        : isExpired
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-primary/10 text-primary border-primary/20",
                    )}
                  >
                    {isCancelled ? "حجز مُلغى" : isExpired ? "ملغي (لم يُدفع)" : "حجز نشط"}
                  </span>
                </div>

                {isCancelled && (
                  <div className="mb-4 bg-gray-100 border border-gray-300 rounded-xl p-3 flex items-start gap-2 shadow-sm relative z-10">
                    <XOctagon className="size-4 text-gray-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-700 font-semibold leading-relaxed">
                      هذا الحجز تم إلغاؤه من قبل الإدارة أو العميل. تأكد من استرداد المبلغ إذا كان
                      إلكترونياً.
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm mb-4 relative z-10">
                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">العميل</span>
                    <span className="font-bold text-[11px] text-foreground">
                      {booking?.guestData?.name || booking?.user?.name || "بدون اسم"}
                    </span>
                  </p>

                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">موعد الحجز</span>
                    <span
                      className={cn(
                        "font-bold text-[11px] px-2 py-0.5 rounded-md",
                        isExpired || isCancelled
                          ? "bg-muted text-muted-foreground border border-border"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {formatDateTime(booking?.startTime)}
                    </span>
                  </p>

                  <p className="flex justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">
                      {isExpired || isCancelled ? "هاتف العميل" : "الهاتف المسجل"}
                    </span>
                    <span
                      className={cn(
                        "font-bold text-[11px]",
                        isExpired || isCancelled ? "text-muted-foreground" : "text-primary",
                      )}
                      dir="ltr"
                    >
                      {firstPayment?.senderPhone ||
                        booking?.user?.phone ||
                        booking?.guestData?.phone ||
                        "---"}
                    </span>
                  </p>
                </div>

                <div className="mt-2 flex flex-col gap-2 relative z-10 border-t border-border pt-4">
                  <h4 className="text-[11px] font-extrabold text-muted-foreground mb-1">
                    دفعات الحجز المقسمة:
                  </h4>
                  {group.map((p) => {
                    const displayedAmount = p.amountReceived || p.expectedAmount;
                    const isPaymentCancelled = isCancelled;

                    return (
                      <div
                        key={p._id}
                        className="bg-muted/40 border border-border/60 rounded-xl p-3 flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-black text-sm",
                                isPaymentCancelled
                                  ? "text-muted-foreground line-through"
                                  : p.method === "cash"
                                    ? "text-info"
                                    : "text-success",
                              )}
                            >
                              {displayedAmount} ج.م
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                              {p.method === "cash"
                                ? "كاش (باقي)"
                                : p.method === "vodafone_cash"
                                  ? "فودافون كاش (عربون)"
                                  : p.method === "instapay"
                                    ? "إنستا باي (عربون)"
                                    : p.method}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded",
                              p.status === "verified"
                                ? "bg-success/15 text-success"
                                : p.status === "expired" || isPaymentCancelled
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-warning/15 text-warning",
                            )}
                          >
                            {p.status === "verified"
                              ? "مؤكد"
                              : p.status === "expired" || isPaymentCancelled
                                ? "غير صالح"
                                : "بانتظار التأكيد"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 pb-1 border-b border-border/40 border-dashed">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" /> وقت الحركة:
                          </span>
                          <span className="font-bold text-foreground" dir="ltr">
                            {formatDateTime(p.createdAt)}
                          </span>
                        </div>

                        {p.manualTransactionId && (
                          <p className="text-[10px] text-muted-foreground flex justify-between mt-1">
                            <span>المرجع:</span>
                            <span className="font-bold text-foreground" dir="ltr">
                              {p.manualTransactionId}
                            </span>
                          </p>
                        )}

                        {p.verificationNotes && (
                          <div className="mt-1.5 rounded bg-background/60 p-2 text-[10px] text-muted-foreground border border-border/50">
                            <span className="font-bold text-primary block mb-0.5">ملاحظات:</span>
                            {p.verificationNotes}
                          </div>
                        )}

                        {p.proofImage && (
                          <a
                            href={`${BACKEND_URL}${p.proofImage}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-info/10 text-info border border-info/20 hover:bg-info hover:text-white transition py-1.5 text-[11px] font-bold"
                          >
                            <FileImage className="size-3.5" /> عرض الإثبات
                          </a>
                        )}

                        {(p.status === "pending" || p.status === "pending_verification") &&
                          p.method !== "cash" &&
                          !isCancelled && (
                            <button
                              onClick={() => handleVerify(p._id, false)}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition py-2 text-[11px] font-bold"
                            >
                              <Check className="size-3.5" /> تأكيد التحويل للإدارة
                            </button>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
