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
  XOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllPayments, manuallyVerifyPayment, addPaymentNote } from "@/api/paymentApi";
// @ts-expect-error: until axiosConfig.js is migrated to TypeScript or has typings.
import { BACKEND_URL } from "@/api/axiosConfig";
import { useConfirm } from "../../components/venue/useConfirm";

interface Payment {
  _id: string;
  expectedAmount: number;
  baseAmount?: number;
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
    totalPrice?: number;
    deposit?: number;
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

  const getDisplayAmount = (p: Payment) => {
    if (p.method === "cash" && p.amountReceived !== undefined) return p.amountReceived;
    if (p.baseAmount) return p.baseAmount;
    if (p.booking?.totalPrice) return p.booking.totalPrice;
    return p.expectedAmount;
  };

  const summary = useMemo(() => {
    const totalConfirmed = payments
      .filter((p) => p.status === "verified" && p.method !== "cash")
      .reduce((sum, p) => sum + getDisplayAmount(p), 0);

    const totalCash = payments
      .filter((p) => p.method === "cash")
      .reduce((sum, p) => sum + getDisplayAmount(p), 0);

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

    const isConfirmed = await confirm(msg);
    // if (!window.confirm(msg)) return;
    if (isConfirmed) return;
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
      <ConfirmDialog />
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
              booking?.totalPrice || group.reduce((sum, p) => sum + getDisplayAmount(p), 0);
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
                      هذا الحجز تم إلغاؤه.
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
                    const displayedAmount = getDisplayAmount(p);
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
                              {getMethodName(p.method)}
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

                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            placeholder="إضافة ملاحظة"
                            value={paymentNotesInput[p._id] || ""}
                            onChange={(e) =>
                              setPaymentNotesInput({
                                ...paymentNotesInput,
                                [p._id]: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => handleSavePaymentNote(p._id, p.verificationNotes)}
                            className="shrink-0 rounded-md bg-primary px-3 py-1 text-[11px] font-bold text-white transition hover:bg-primary/90"
                          >
                            حفظ
                          </button>
                        </div>

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

                        {p.method === "cash" &&
                          (p.status === "pending" || p.status === "pending_verification") &&
                          !isCancelled && (
                            <button
                              onClick={() => handleVerify(p._id, false)}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition py-2 text-[11px] font-bold"
                            >
                              <Check className="size-3.5" /> تأكيد استلام الكاش
                            </button>
                          )}

                        {p.method === "cash" && p.status === "expired" && !isCancelled && (
                          <button
                            onClick={() => handleVerify(p._id, true)}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-warning/10 text-warning border border-warning/30 hover:bg-warning hover:text-white transition py-2 text-[11px] font-bold"
                          >
                            <CheckCircle2 className="size-3.5" /> تأكيد وإحياء الحجز
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
