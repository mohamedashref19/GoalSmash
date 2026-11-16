import { useState, useRef, useEffect } from "react";
import { domToPng } from "modern-screenshot";
import jsPDF from "jspdf";
import {
  CalendarDays,
  ClipboardList,
  Search,
  Wallet,
  Banknote,
  TrendingUp,
  Building2,
  Printer,
  Download,
  Image as ImageIcon,
  Loader2,
  PieChart,
  CheckCircle2,
  Circle,
  Scale,
  User,
  Phone,
  Clock,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues, fetchDailyClosing, toggleVenueSettlement } from "@/api/adminApi";
import { useConfirm } from "../../components/venue/useConfirm";

interface PaymentEntry {
  _id: string;
  amount: number;
  method: string;
  isRestCash: boolean;
  typeLabel: string;
  date: string;
  reference?: string;
  notes?: string;
}

interface BookingDetailItem {
  _id: string;
  venueName?: string;
  courtName?: string;
  customerName: string;
  customerPhone: string;
  bookingType: "app" | "manual" | string;
  bookingTypeLabel: string;
  startTime: string;
  endTime: string;
  durationInHours: number;
  totalPrice: number;
  totalPaidSoFar: number;
  remainingAmount: number;
  paidTodayOnline: number;
  paidTodayManualCash: number;
  paidTodayRestCash: number;
  paidTodayTotal: number;
  calculatedCommission: number;
  hasInitialPaymentToday: number;
  hasRestPaymentToday: number;
  latestPaymentDate: string;
  payments: PaymentEntry[];
}

interface CourtDetails {
  courtId: string;
  courtName: string;
  totalOnline: number;
  totalManualCash?: number;
  totalRestCash?: number;
  totalCash: number;
  totalRevenue: number;
  totalCommission: number;
  totalRemaining?: number;
  bookingsCount: number;
  appBookingsCount?: number;
  manualBookingsCount?: number;
  restCollectionsCount?: number;
  netAmount: number;
}

interface VenueClosing {
  _id: string;
  venueName: string;
  venueTotalOnline: number;
  venueTotalManualCash?: number;
  venueTotalRestCash?: number;
  venueTotalCash: number;
  venueTotalRevenue: number;
  venueTotalCommission: number;
  venueTotalRemaining?: number;
  venueBookingsCount: number;
  venueAppBookingsCount?: number;
  venueManualBookingsCount?: number;
  venueRestCollectionsCount?: number;
  venueNetAmount: number;
  isSettled: boolean;
  courts: CourtDetails[];
  bookingsDetails?: BookingDetailItem[];
}

interface PlatformTotals {
  totalRevenue: number;
  totalCommission: number;
  totalOnline: number;
  totalManualCash?: number;
  totalRestCash?: number;
  totalCash: number;
  totalRemaining?: number;
  onlineTransactionsCount?: number;
  cashTransactionsCount?: number;
  totalBookings: number;
  appBookingsCount?: number;
  manualBookingsCount?: number;
  restCollectionsCount?: number;
}

interface ClosingData {
  date: string;
  platformTotals: PlatformTotals;
  venuesClosing: VenueClosing[];
}

export function AdminDailyClosingView() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [venuesList, setVenuesList] = useState<{ _id: string; name: string }[]>([]);

  const [closingData, setClosingData] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [settlingVenueId, setSettlingVenueId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    fetchAllVenues()
      .then(setVenuesList)
      .catch(() => {});
  }, []);

  const handleFetchClosing = async () => {
    if (!date) {
      toast.error("يرجى اختيار التاريخ");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchDailyClosing(date, selectedVenue);
      setClosingData(data);
      toast.success("تم جلب بيانات اليومية بنجاح");
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSettlement = async (venueId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus
      ? "هل أنت متأكد من تصفية حساب هذا النادي لليوم المحدد؟"
      : "هل تريد إلغاء التصفية وفتح الحساب مرة أخرى؟";

    const isConfirmed = await confirm(confirmMsg);
    if (!isConfirmed) return;

    setSettlingVenueId(venueId);
    try {
      await toggleVenueSettlement(venueId, date, newStatus);
      toast.success(newStatus ? "تم تأكيد التصفية بنجاح" : "تم إلغاء التصفية");

      setClosingData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          venuesClosing: prev.venuesClosing.map((v) =>
            v._id === venueId ? { ...v, isSettled: newStatus } : v,
          ),
        };
      });
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setSettlingVenueId(null);
    }
  };

  const handlePrint = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }

    if (!reportRef.current) return;
    const toastId = toast.loading("جاري تجهيز ملف PDF...");
    setIsCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const dataUrl = await domToPng(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const elementWidth = reportRef.current.scrollWidth;
      const elementHeight = reportRef.current.scrollHeight;

      const pdf = new jsPDF({
        orientation: elementWidth > elementHeight ? "landscape" : "portrait",
        unit: "px",
        format: [elementWidth, elementHeight],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, elementWidth, elementHeight);
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      if (!pdfBase64) {
        throw new Error("تعذر تجهيز بيانات ملف PDF");
      }

      const fileName = `Daily_Closing_${date}.pdf`;
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache,
      });

      await Share.share({ title: "مشاركة تقفيل اليومية", url: savedFile.uri });
      toast.success("تم تجهيز الـ PDF ومشاركته بنجاح", { id: toastId });
    } catch (error: unknown) {
      toast.error("حدث خطأ أثناء إنشاء ملف PDF", { id: toastId });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    const toastId = toast.loading("جاري تجهيز الصورة...");
    setIsCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const dataUrl = await domToPng(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const fileName = `Daily_Closing_${date}.png`;

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(",")[1];
        if (!base64Data) throw new Error("Invalid image data");
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: "مشاركة صورة تقفيل اليومية",
          url: savedFile.uri,
        });
        toast.success("تمت المشاركة بنجاح", { id: toastId });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        toast.success("تم تحميل الصورة بنجاح", { id: toastId });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "حدث خطأ أثناء حفظ الملف", { id: toastId });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleExportCSV = async () => {
    if (!closingData) return;

    const pt = closingData.platformTotals;
    const netSettlement = Number((pt.totalOnline - pt.totalCommission).toFixed(2));
    const venueNetTotal = Number((pt.totalRevenue - pt.totalCommission).toFixed(2));

    let csvContent = "\uFEFF";
    csvContent += `تقرير تقفيل اليومية الشامل - تاريخ: ${date}\n\n`;

    csvContent += "--- خلاصة اليومية للمنصة ---\n";
    csvContent +=
      "إجمالي المحصل,أونلاين (مع المنصة),كاش يدوي (مع النادي),كاش باقي حجز (مع النادي),إجمالي الكاش,حق المنصة (العمولة),صافي حق الأندية,صافي التسوية\n";
    csvContent += `${pt.totalRevenue} ج.م,${pt.totalOnline} ج.م,${pt.totalManualCash ?? 0} ج.م,${pt.totalRestCash ?? 0} ج.م,${pt.totalCash} ج.م,${pt.totalCommission} ج.م,${venueNetTotal} ج.م,${Math.abs(netSettlement)} ج.م (${netSettlement >= 0 ? "تحولها المنصة للنادي" : "يحولها النادي للمنصة"})\n\n`;

    closingData.venuesClosing.forEach((v) => {
      csvContent += `=== نادي: ${v.venueName} (${v.isSettled ? "تمت التصفية" : "غير مصفى"}) ===\n`;
      csvContent +=
        "الملعب,حجوزات تطبيق,حجوزات يدوية,تحصيل باقي,أونلاين (مع المنصة),كاش (يدوي),كاش (باقي حجز),عمولة المنصة,صافي التسوية,الجهة المستحقة\n";
      v.courts.forEach((c) => {
        const isOwed = c.netAmount >= 0;
        csvContent += `"${c.courtName}",${c.appBookingsCount ?? 0},${c.manualBookingsCount ?? 0},${c.restCollectionsCount ?? 0},${c.totalOnline} ج.م,${c.totalManualCash ?? 0} ج.م,${c.totalRestCash ?? 0} ج.م,${c.totalCommission} ج.م,${Math.abs(c.netAmount)} ج.م,${isOwed ? "المنصة تحول للنادي" : "النادي يحول للمنصة"}\n`;
      });

      if (v.bookingsDetails && v.bookingsDetails.length > 0) {
        csvContent += "\nسجل حجوزات وعمليات اليومية للنادي:\n";
        csvContent +=
          "الملعب,العميل,رقم الموبايل,نوع الحجز,ميعاد اللعب,المدة,سعر الحجز الكلي,تفاصيل الدفعات اليوم,المحصل اليوم,عمولة المنصة,نسبة العمولة,المتبقي في الملعب\n";
        v.bookingsDetails.forEach((b) => {
          const playDate = new Date(b.startTime).toLocaleString("ar-EG", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const paymentsText = (b.payments || [])
            .map(
              (p) =>
                `${p.amount}ج (${p.typeLabel} - ${new Date(p.date).toLocaleString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })})`,
            )
            .join(" | ");
          const rateText =
            b.hasInitialPaymentToday === 0
              ? "محسوبة يوم الحجز"
              : b.durationInHours >= 2
                ? "10% (ساعتين)"
                : "5% (ساعة)";

          csvContent += `"${b.courtName || ""}","${b.customerName}","${b.customerPhone}","${b.bookingTypeLabel}","${playDate}","${b.durationInHours} ساعة",${b.totalPrice} ج.م,"${paymentsText}",${b.paidTodayTotal} ج.م,${Number(b.calculatedCommission || 0).toFixed(2)} ج.م,"${rateText}",${b.remainingAmount} ج.م\n`;
        });
      }
      csvContent += "\n";
    });

    const fileName = `Daily_Closing_${date}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: csvContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({ title: "مشاركة إكسيل تقفيل اليومية", url: savedFile.uri });
      } catch (error: unknown) {
        toast.error("حدث خطأ أثناء حفظ الملف");
      }
    } else {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    }
  };

  const pt = closingData?.platformTotals;
  const platformNetSettlement = pt ? Number((pt.totalOnline - pt.totalCommission).toFixed(2)) : 0;
  const venuesNetTotalRevenue = pt ? Number((pt.totalRevenue - pt.totalCommission).toFixed(2)) : 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10 mt-8 mx-4 sm:mx-8">
      {/* قواعد طباعة مخصصة لظهور الجداول كاملة بالعرض بدون قص أو شريط تمرير */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body, #root, main {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-daily-closing, #printable-daily-closing * {
            visibility: visible;
          }
          #printable-daily-closing {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          #printable-daily-closing table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
          }
          #printable-daily-closing th,
          #printable-daily-closing td {
            white-space: normal !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          #printable-daily-closing tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <ClipboardList className="size-6 text-primary" /> تقفيل اليومية الشامل
          </h2>
          <p className="text-sm text-muted-foreground font-bold bg-muted px-3 py-1.5 rounded-lg border border-border">
            إيرادات وتصفية حسابات اليوم المحاسبي
          </p>
        </div>
        <ConfirmDialog />
        <div className="card-surface p-5 border-b-4 border-b-primary flex flex-col lg:flex-row gap-4 items-end mt-4">
          <div className="w-full lg:w-1/3 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> تاريخ اليومية
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary"
            />
          </div>
          <div className="w-full lg:w-1/3 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-4" /> النادي
            </label>
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary"
            >
              <option value="all">-- كل الأندية --</option>
              {venuesList.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleFetchClosing}
            disabled={loading}
            className="w-full lg:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition disabled:opacity-50 hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Search className="size-4" /> عرض اليومية
              </>
            )}
          </button>
        </div>
      </div>

      {closingData && pt && (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden justify-end mt-2">
            <button
              onClick={handleDownloadImage}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-500/20 px-4 py-2 rounded-xl text-sm font-bold transition"
            >
              <ImageIcon className="size-4" /> حفظ كصورة
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 px-4 py-2 rounded-xl text-sm font-bold transition"
            >
              <Download className="size-4" /> إكسيل شامل
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-card text-foreground hover:bg-muted border border-border px-4 py-2 rounded-xl text-sm font-bold transition"
            >
              <Printer className="size-4" /> طباعة / PDF
            </button>
          </div>

          <div className="animate-in slide-in-from-bottom-4">
            <div
              id="printable-daily-closing"
              ref={reportRef}
              dir="rtl"
              className={cn(
                "space-y-6 bg-background print:bg-white rounded-2xl p-4",
                isCapturing ? "w-[1150px] max-w-none bg-white p-6" : "",
              )}
            >
              <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-lg text-foreground print:text-black">
                    تقرير اليومية الشامل وتصفية المستحقات
                  </h3>
                  <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                    تاريخ اليومية: <span className="font-bold">{date}</span>
                  </p>
                </div>
                <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1.5 rounded-xl w-fit">
                  قاعدة العمولة الثابتة: 5% للساعة | 10% للساعتين
                </span>
              </div>

              {/* 1. الكروت العلوية المفصلة للمنصة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
                <div className="card-surface p-4 border-b-4 border-b-primary print:border print:border-gray-300 print:shadow-none">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> إجمالي المحصل اليوم
                  </p>
                  <p className="font-display text-2xl font-black text-primary mt-1">
                    {pt.totalRevenue} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      تطبيق: {pt.appBookingsCount ?? 0}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      يدوي: {pt.manualBookingsCount ?? 0}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      تحصيل باقي: {pt.restCollectionsCount ?? 0}
                    </span>
                  </div>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-success print:border print:border-gray-300 print:shadow-none">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-success" /> أونلاين (مع المنصة)
                  </p>
                  <p className="font-display text-2xl font-black text-success mt-1">
                    {pt.totalOnline} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    في محافظ المنصة ({pt.onlineTransactionsCount ?? 0} تحويل مؤكد)
                  </p>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-info print:border print:border-gray-300 print:shadow-none">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> كاش (مع النادي بالدرج)
                  </p>
                  <p className="font-display text-2xl font-black text-info mt-1">
                    {pt.totalCash} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                    <span className="rounded bg-info/10 px-1.5 py-0.5 text-info border border-info/20">
                      حجز يدوي: {pt.totalManualCash ?? 0} ج.م
                    </span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-amber-700 dark:text-warning border border-warning/30">
                      باقي الحجز: {pt.totalRestCash ?? 0} ج.م
                    </span>
                  </div>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-warning print:border print:border-gray-300 print:shadow-none">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <PieChart className="size-4 text-warning" /> حق المنصة (العمولة)
                  </p>
                  <p className="font-display text-2xl font-black text-warning mt-1">
                    {pt.totalCommission} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    متبقي بالملاعب لم يُحصل:{" "}
                    <span className="font-bold text-destructive">{pt.totalRemaining ?? 0} ج.م</span>
                  </p>
                </div>
              </div>

              {/* 2. صندوق خلاصة تصفية اليومية (المنصة ليها كام والنادي ليه كام بالضبط) */}
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 print:border print:border-gray-300 print:bg-gray-50">
                <h4 className="font-display text-sm sm:text-base font-extrabold text-foreground mb-3 flex items-center gap-2">
                  <Scale className="size-5 text-primary" /> خلاصة تصفية اليومية (المنصة ليها كام
                  والأندية ليها كام بالضبط):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div className="rounded-xl bg-card p-3.5 border border-border">
                    <span className="text-muted-foreground font-bold block mb-1">
                      1. صافي حق المنصة اليوم (أرباحك):
                    </span>
                    <span className="text-lg font-black text-warning">
                      {pt.totalCommission} ج.م
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-1">
                      تُخصم من الـ {pt.totalOnline} ج.م الأونلاين الموجودة مع المنصة
                    </span>
                  </div>

                  <div className="rounded-xl bg-card p-3.5 border border-border">
                    <span className="text-muted-foreground font-bold block mb-1">
                      2. صافي حق الأندية الكلي اليوم:
                    </span>
                    <span className="text-lg font-black text-primary">
                      {venuesNetTotalRevenue} ج.م
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-1">
                      منها {pt.totalCash} ج.م استلمها النادي كاش في الملعب بالفعل
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl p-3.5 border-2",
                      platformNetSettlement >= 0
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
                    )}
                  >
                    <span className="font-extrabold block mb-1">
                      3. التسوية النهائية (مين يحوّل لمين؟):
                    </span>
                    <span className="text-lg font-black block">
                      {platformNetSettlement >= 0
                        ? `المنصة تحوّل للنادي: ${Math.abs(platformNetSettlement)} ج.م`
                        : `النادي يحوّل للمنصة: ${Math.abs(platformNetSettlement)} ج.م`}
                    </span>
                    <span className="block text-[11px] font-bold opacity-85 mt-1">
                      المعادلة: أونلاين مع المنصة ({pt.totalOnline} ج) - عمولة المنصة (
                      {pt.totalCommission} ج)
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. تفاصيل وتصفية حساب كل نادي */}
              <div className="space-y-8 mt-6">
                {closingData.venuesClosing.map((venue) => {
                  const isVenueOwed = venue.venueNetAmount >= 0;
                  const venueNetShare = Number(
                    (venue.venueTotalRevenue - venue.venueTotalCommission).toFixed(2),
                  );

                  return (
                    <div
                      key={venue._id}
                      className={cn(
                        "border-2 rounded-2xl overflow-hidden print:border-gray-300 shadow-sm",
                        venue.isSettled ? "border-success/40" : "border-border",
                      )}
                    >
                      {/* هيدر النادي وزر التصفية */}
                      <div
                        className={cn(
                          "p-4 sm:p-5 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:bg-gray-100",
                          venue.isSettled
                            ? "bg-success/5 border-success/20"
                            : "bg-muted/50 border-border",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="font-display font-extrabold text-lg text-foreground">
                            {venue.venueName}
                          </h4>

                          <button
                            onClick={() => handleToggleSettlement(venue._id, venue.isSettled)}
                            disabled={settlingVenueId === venue._id}
                            className={cn(
                              "flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-1.5 rounded-xl border transition-all duration-300 print:hidden",
                              venue.isSettled
                                ? "bg-success/20 text-success border-success/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                : "bg-background text-muted-foreground border-border hover:border-success/40 hover:text-success",
                              settlingVenueId === venue._id && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            {settlingVenueId === venue._id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : venue.isSettled ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <Circle className="size-4" />
                            )}
                            {venue.isSettled ? "تمت تصفية الحساب" : "تأكيد التصفية"}
                          </button>

                          <span className="hidden print:inline-block text-xs font-bold">
                            [{venue.isSettled ? "حساب مُصفى" : "حساب غير مُصفى"}]
                          </span>
                        </div>

                        {/* ملخص سريع لأرقام النادي */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                          <span className="rounded-lg bg-background px-3 py-1.5 border border-border">
                            إجمالي محصل النادي:{" "}
                            <strong className="text-foreground">
                              {venue.venueTotalRevenue} ج.م
                            </strong>
                          </span>
                          <span className="rounded-lg bg-warning/10 text-amber-700 dark:text-warning px-3 py-1.5 border border-warning/30">
                            عمولة المنصة: <strong>{venue.venueTotalCommission} ج.م</strong>
                          </span>
                          <span className="rounded-lg bg-primary/10 text-primary px-3 py-1.5 border border-primary/20">
                            صافي نصيب النادي: <strong>{venueNetShare} ج.م</strong> (منها{" "}
                            {venue.venueTotalCash} ج كاش بيده)
                          </span>
                          <span
                            className={cn(
                              "px-3 py-1.5 rounded-lg border font-black",
                              isVenueOwed
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
                            )}
                          >
                            {isVenueOwed
                              ? `المنصة تحوّل للنادي: ${Math.abs(venue.venueNetAmount)} ج.م`
                              : `النادي يحوّل للمنصة: ${Math.abs(venue.venueNetAmount)} ج.م`}
                          </span>
                        </div>
                      </div>

                      {/* جدول تفصيل ملاعب النادي */}
                      <div
                        className={cn(
                          "p-0 print:overflow-visible",
                          !isCapturing ? "overflow-x-auto" : "overflow-visible",
                        )}
                      >
                        <table
                          className={cn(
                            "w-full text-sm text-right print:min-w-0",
                            !isCapturing ? "min-w-[750px]" : "min-w-0",
                          )}
                        >
                          <thead className="bg-background print:bg-white text-muted-foreground border-b border-border">
                            <tr>
                              <th className="px-3.5 py-3 font-bold">الملعب</th>
                              <th className="px-3.5 py-3 font-bold text-center">تفصيل الحجوزات</th>
                              <th className="px-3.5 py-3 font-bold text-success">
                                أونلاين (مع المنصة)
                              </th>
                              <th className="px-3.5 py-3 font-bold text-info">كاش (حجز يدوي)</th>
                              <th className="px-3.5 py-3 font-bold text-amber-600">
                                كاش (باقي حجز)
                              </th>
                              <th className="px-3.5 py-3 font-bold text-warning">عمولة المنصة</th>
                              <th className="px-3.5 py-3 font-bold text-primary">
                                صافي التسوية (أونلاين - العمولة)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {venue.courts.map((court) => {
                              const isOwedToVenue = court.netAmount >= 0;

                              return (
                                <tr
                                  key={court.courtId}
                                  className={cn(
                                    "border-b border-border/50 last:border-0 print:border-gray-200",
                                    venue.isSettled ? "bg-success/5" : "",
                                  )}
                                >
                                  <td className="px-3.5 py-3 font-extrabold text-foreground">
                                    {court.courtName}
                                  </td>
                                  <td className="px-3.5 py-3 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-black text-xs text-foreground">
                                        {court.bookingsCount} حجز جديد
                                      </span>
                                      <div className="flex flex-wrap justify-center gap-1 text-[10px] font-bold">
                                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
                                          تطبيق: {court.appBookingsCount ?? 0}
                                        </span>
                                        <span className="rounded bg-info/10 px-1.5 py-0.5 text-info">
                                          يدوي: {court.manualBookingsCount ?? 0}
                                        </span>
                                        {(court.restCollectionsCount ?? 0) > 0 && (
                                          <span className="rounded bg-warning/15 px-1.5 py-0.5 text-amber-700 dark:text-warning">
                                            +{court.restCollectionsCount} باقي
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-3 font-bold text-success">
                                    {Number(court.totalOnline || 0).toFixed(2)} ج.م
                                  </td>
                                  <td className="px-3.5 py-3 font-bold text-info">
                                    {Number(court.totalManualCash || 0).toFixed(2)} ج.م
                                  </td>
                                  <td className="px-3.5 py-3 font-bold text-amber-600">
                                    {Number(court.totalRestCash || 0).toFixed(2)} ج.م
                                  </td>
                                  <td className="px-3.5 py-3 font-black text-warning">
                                    <div className="flex flex-col">
                                      <span>
                                        {Number(court.totalCommission || 0).toFixed(2)} ج.م
                                      </span>
                                      <span className="text-[10px] font-bold text-muted-foreground">
                                        (5% للساعة | 10% للساعتين)
                                      </span>
                                    </div>
                                  </td>
                                  <td
                                    className={cn(
                                      "px-3.5 py-3 font-black",
                                      isOwedToVenue ? "text-emerald-600" : "text-red-500",
                                    )}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground print:border print:border-gray-200">
                                          {isOwedToVenue
                                            ? "المنصة تحوّل للنادي"
                                            : "النادي يحوّل للمنصة"}
                                        </span>
                                        <span>{Math.abs(court.netAmount)} ج.م</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-muted-foreground">
                                        ({court.totalOnline} أونلاين - {court.totalCommission}{" "}
                                        عمولة)
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* جدول سجل الحجوزات والعمليات التفصيلي لهذا النادي */}
                      {venue.bookingsDetails && venue.bookingsDetails.length > 0 && (
                        <div className="border-t border-border bg-surface/40 p-4 space-y-2.5">
                          <h5 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5">
                            <ListFilter className="size-4 text-primary" /> سجل حجوزات وعمليات
                            اليومية في {venue.venueName} ({venue.bookingsDetails.length})
                          </h5>

                          <div
                            className={cn(
                              "rounded-xl border border-border bg-card print:border-gray-300 print:overflow-visible",
                              !isCapturing ? "overflow-x-auto" : "overflow-visible",
                            )}
                          >
                            <table
                              className={cn(
                                "w-full text-xs text-right print:min-w-0",
                                !isCapturing ? "min-w-[750px]" : "min-w-0",
                              )}
                            >
                              <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                                <tr>
                                  <th className="px-3 py-2.5 font-bold">الملعب ونوع الحجز</th>
                                  <th className="px-3 py-2.5 font-bold">العميل والموبايل</th>
                                  <th className="px-3 py-2.5 font-bold">ميعاد اللعب والمدة</th>
                                  <th className="px-3 py-2.5 font-bold">سعر الحجز الكلي</th>
                                  <th className="px-3 py-2.5 font-bold">تفاصيل الدفعات اليوم</th>
                                  <th className="px-3 py-2.5 font-bold text-warning">
                                    عمولة المنصة
                                  </th>
                                  <th className="px-3 py-2.5 font-bold">حالة باقي الحجز</th>
                                </tr>
                              </thead>
                              <tbody>
                                {venue.bookingsDetails.map((b) => {
                                  const playStart = new Date(b.startTime);
                                  const playDateStr = playStart.toLocaleDateString("ar-EG", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  });
                                  const playTimeStr = playStart.toLocaleTimeString("ar-EG", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                  const isManual = b.bookingType === "manual";
                                  const ratePercent = b.durationInHours >= 2 ? 10 : 5;

                                  return (
                                    <tr
                                      key={b._id}
                                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 print:border-gray-200 align-top"
                                    >
                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col items-start gap-1">
                                          <span className="font-bold text-foreground">
                                            {b.courtName || "---"}
                                          </span>
                                          <span
                                            className={cn(
                                              "rounded px-1.5 py-0.5 text-[10px] font-extrabold border",
                                              isManual
                                                ? "bg-info/15 text-info border-info/30"
                                                : "bg-success/15 text-success border-success/30",
                                            )}
                                          >
                                            {b.bookingTypeLabel}
                                          </span>
                                        </div>
                                      </td>

                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-extrabold text-foreground flex items-center gap-1">
                                            <User className="size-3 text-primary shrink-0" />
                                            {b.customerName}
                                          </span>
                                          <span
                                            className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"
                                            dir="ltr"
                                          >
                                            <Phone className="size-3 shrink-0" />
                                            {b.customerPhone}
                                          </span>
                                        </div>
                                      </td>

                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-bold text-foreground">
                                            {playDateStr}
                                          </span>
                                          <span className="text-[11px] font-bold text-primary">
                                            الساعة {playTimeStr} ({b.durationInHours} ساعة)
                                          </span>
                                        </div>
                                      </td>

                                      <td className="px-3 py-2.5 font-extrabold text-foreground">
                                        {b.totalPrice} ج.م
                                      </td>

                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col gap-1.5">
                                          {(b.payments || []).map((p) => (
                                            <div
                                              key={p._id}
                                              className="flex flex-col rounded-lg border border-border/70 bg-muted/40 p-2 text-[11px]"
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span
                                                  className={cn(
                                                    "font-extrabold",
                                                    p.method !== "cash"
                                                      ? "text-success"
                                                      : p.isRestCash
                                                        ? "text-amber-600"
                                                        : "text-info",
                                                  )}
                                                >
                                                  {p.typeLabel}
                                                </span>
                                                <span className="font-black text-foreground">
                                                  {p.amount} ج.م
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                                <Clock className="size-2.5 shrink-0" />
                                                <span>
                                                  {new Date(p.date).toLocaleString("ar-EG", {
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  })}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </td>

                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col items-start gap-1">
                                          <span className="font-black text-warning">
                                            {Number(b.calculatedCommission || 0).toFixed(2)} ج.م
                                          </span>
                                          {b.hasInitialPaymentToday === 0 ? (
                                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                              محسوبة يوم الحجز
                                            </span>
                                          ) : (
                                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-warning">
                                              {ratePercent}% ({b.durationInHours} س × {b.totalPrice}{" "}
                                              ج)
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-col items-start gap-1">
                                          {b.remainingAmount > 0 ? (
                                            <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[11px] font-black text-destructive border border-destructive/20">
                                              باقي: {b.remainingAmount} ج.م
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-0.5 text-[11px] font-black text-success border border-success/20">
                                              <CheckCircle2 className="size-3" /> خالص بالكامل
                                            </span>
                                          )}
                                          <span className="text-[10px] font-bold text-muted-foreground">
                                            المدفوع: {b.totalPaidSoFar} من {b.totalPrice} ج.م
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {closingData.venuesClosing.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 font-bold">
                    لا توجد إيرادات مسجلة لهذا اليوم.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
