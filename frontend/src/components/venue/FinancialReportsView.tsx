import { useState, useRef, useMemo } from "react";
import { domToPng } from "modern-screenshot";
import jsPDF from "jspdf";
import {
  CalendarDays,
  FileText,
  Search,
  TrendingUp,
  Wallet,
  Banknote,
  ArrowRightLeft,
  Printer,
  Download,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Phone,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchFinancialReports } from "@/api/paymentApi";

import { Capacitor } from "@capacitor/core";

interface CourtBreakdown {
  _id: string;
  courtName: string;
  totalRevenue: number;
  totalOnline: number;
  totalManualCash?: number;
  totalRestCash?: number;
  totalCash: number;
  bookingsCount: number;
  appBookingsCount?: number;
  manualBookingsCount?: number;
  restCollectionsCount?: number;
  totalTouchedBookings?: number;
  totalRemaining?: number;
}

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
  paidInPeriodOnline: number;
  paidInPeriodManualCash: number;
  paidInPeriodRestCash: number;
  paidInPeriodTotal: number;
  hasInitialPaymentInPeriod: number;
  hasRestPaymentInPeriod: number;
  latestPaymentDate: string;
  payments: PaymentEntry[];
}

interface ReportData {
  dateRange: { from: string; to: string };
  totalOnline: number;
  totalManualCash?: number;
  totalRestCash?: number;
  totalCash: number;
  totalOverall: number;
  totalRemainingInVenue?: number;
  transactionsCount: {
    online: number;
    manualCash?: number;
    restCash?: number;
    cash: number;
    total: number;
  };
  bookingsSummary?: {
    newBookingsCount: number;
    appBookingsCount: number;
    manualBookingsCount: number;
    restCollectionsCount: number;
    totalTouchedBookings: number;
  };
  courtsBreakdown: CourtBreakdown[];
  bookingsDetails?: BookingDetailItem[];
}

export function FinancialReportsView({ venueId }: { venueId: string }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "app" | "manual">("all");

  const reportRef = useRef<HTMLDivElement>(null);

  const handleFetchReport = async () => {
    if (!startDate || !endDate) {
      toast.error("يرجى اختيار تاريخ البداية والنهاية");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      toast.error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
      return;
    }

    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      toast.error("أقصى مدة لاستخراج التقرير هي 30 يوماً فقط");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchFinancialReports(startDate, endDate, venueId);
      setReport(data);
      toast.success("تم استخراج التقرير بنجاح");
    } catch (err: unknown) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookingsDetails = useMemo(() => {
    if (!report?.bookingsDetails) return [];
    return report.bookingsDetails.filter((item) => {
      const matchesType = typeFilter === "all" || item.bookingType === typeFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.customerName || "").toLowerCase().includes(q) ||
        (item.customerPhone || "").includes(q) ||
        (item.courtName || "").toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [report?.bookingsDetails, typeFilter, searchTerm]);

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
      const dataUrl = await domToPng(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const elementWidth = reportRef.current.scrollWidth;
      const elementHeight = reportRef.current.scrollHeight;

      const pdf = new jsPDF({
        orientation: elementWidth > elementHeight ? "landscape" : "portrait",
        unit: "px",
        format: [elementWidth, elementHeight],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, elementWidth, elementHeight);

      const pdfBase64 = pdf.output("datauristring").split(",")[1] ?? "";
      if (!pdfBase64) {
        throw new Error("تعذر تجهيز بيانات ملف PDF");
      }
      const fileName = `Financial_Report_${startDate}_${endDate}.pdf`;

      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: "مشاركة تقرير PDF",
        url: savedFile.uri,
      });

      toast.success("تم تجهيز الـ PDF ومشاركته بنجاح", { id: toastId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "حدث خطأ أثناء إنشاء ملف PDF", { id: toastId });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleExportCSV = async () => {
    if (!report) return;

    let csvContent = "\uFEFF";
    csvContent += "تقرير الإيرادات والحجوزات الشامل\n\n";
    csvContent += `من تاريخ:, ${startDate}\n`;
    csvContent += `إلى تاريخ:, ${endDate}\n\n`;

    csvContent += "--- ملخص الإيرادات ---\n";
    csvContent +=
      "الإجمالي المحصل,إيرادات أونلاين (عربون),كاش (حجز يدوي),كاش (باقي الحجز),إجمالي الكاش,متبقي بالملعب لم يحصل\n";
    csvContent += `${report.totalOverall} ج.م,${report.totalOnline} ج.م,${report.totalManualCash ?? 0} ج.م,${report.totalRestCash ?? 0} ج.م,${report.totalCash} ج.م,${report.totalRemainingInVenue ?? 0} ج.م\n\n`;

    csvContent += "--- تفصيل الملاعب ---\n";
    csvContent +=
      "اسم الملعب,حجوزات تطبيق,حجوزات يدوية,تحصيل باقي حجز,أونلاين,كاش (يدوي),كاش (باقي حجز),إجمالي الكاش,إجمالي المحصل,متبقي بالملعب\n";
    report.courtsBreakdown.forEach((court) => {
      csvContent += `${court.courtName || "غير محدد"},${court.appBookingsCount ?? 0},${court.manualBookingsCount ?? 0},${court.restCollectionsCount ?? 0},${Number(court.totalOnline || 0).toFixed(2)} ج.م,${Number(court.totalManualCash || 0).toFixed(2)} ج.م,${Number(court.totalRestCash || 0).toFixed(2)} ج.م,${Number(court.totalCash || 0).toFixed(2)} ج.م,${Number(court.totalRevenue).toFixed(2)} ج.م,${Number(court.totalRemaining || 0).toFixed(2)} ج.م\n`;
    });

    if (report.bookingsDetails && report.bookingsDetails.length > 0) {
      csvContent += "\n--- سجل الحجوزات والعمليات التفصيلي ---\n";
      csvContent +=
        "العميل,رقم الموبايل,الملعب,نوع الحجز,تاريخ وميعاد اللعب,سعر الحجز الكلي,تفاصيل الدفعات في الفترة,المحصل في الفترة,إجمالي المدفوع بالحجز,المتبقي في الملعب,الحالة\n";
      report.bookingsDetails.forEach((b) => {
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
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })})`,
          )
          .join(" | ");
        const statusText = b.remainingAmount > 0 ? `باقي ${b.remainingAmount} ج.م` : "خالص بالكامل";

        csvContent += `"${b.customerName}","${b.customerPhone}","${b.courtName || ""}","${b.bookingTypeLabel}","${playDate}",${b.totalPrice} ج.م,"${paymentsText}",${b.paidInPeriodTotal} ج.م,${b.totalPaidSoFar} ج.م,${b.remainingAmount} ج.م,"${statusText}"\n`;
      });
    }

    const fileName = `Financial_Report_${startDate}_${endDate}.csv`;

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
        await Share.share({
          title: "مشاركة تقرير الإكسيل",
          url: savedFile.uri,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(message || "حدث خطأ أثناء حفظ الملف");
      }
    } else {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
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
      const fileName = `Financial_Report_${startDate}_${endDate}.png`;

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid image data");
        }

        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: "مشاركة صورة التقرير",
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
      console.error("Error generating image:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "حدث خطأ أثناء حفظ الملف");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10">
      {/* قواعد طباعة مخصصة لضمان ظهور كل الأعمدة والصفوف كاملة في الـ PDF بدون قص أو شريط تمرير */}
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
          #printable-venue-report, #printable-venue-report * {
            visibility: visible;
          }
          #printable-venue-report {
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
          #printable-venue-report table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
          }
          #printable-venue-report th,
          #printable-venue-report td {
            white-space: normal !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          #printable-venue-report tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> التقارير والإيرادات الشاملة
          </h2>
          <p className="text-sm text-muted-foreground font-bold bg-muted px-3 py-1.5 rounded-lg border border-border">
            أقصى مدة للتقرير 30 يوم
          </p>
        </div>

        <div className="card-surface p-5 border-b-4 border-b-primary flex flex-col md:flex-row gap-4 items-end mt-4">
          <div className="w-full space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> من تاريخ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary"
            />
          </div>
          <div className="hidden md:flex items-center justify-center pb-3 text-muted-foreground">
            <ArrowRightLeft className="size-5" />
          </div>
          <div className="w-full space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> إلى تاريخ
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleFetchReport}
            disabled={loading}
            className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition disabled:opacity-50 hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Search className="size-4" /> استخراج التقرير
              </>
            )}
          </button>
        </div>
      </div>

      {report && (
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
              id="printable-venue-report"
              ref={reportRef}
              dir="rtl"
              className={cn(
                "space-y-6 bg-background print:bg-white rounded-2xl p-4",
                isCapturing ? "w-[1150px] max-w-none bg-white p-6" : "",
              )}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground print:text-black">
                    تقرير الإيرادات والحجوزات المفصل
                  </h3>
                  <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                    الفترة من: <span className="font-bold">{startDate}</span> إلى{" "}
                    <span className="font-bold">{endDate}</span>
                  </p>
                </div>
              </div>

              {/* 1. الكروت العلوية المفصلة (4 كروت) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
                <div className="card-surface p-4 border-b-4 border-b-primary relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> إجمالي الدخل المحصل
                  </p>
                  <p className="font-display text-2xl font-black text-primary print:text-black mt-1">
                    {report.totalOverall} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    إجمالي <span className="font-bold">{report.transactionsCount.total}</span> حركة
                    دفع ({report.bookingsSummary?.totalTouchedBookings ?? 0} حجز)
                  </p>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-success relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-success" /> محصل أونلاين (عربون)
                  </p>
                  <p className="font-display text-2xl font-black text-success print:text-black mt-1">
                    {report.totalOnline} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    <span className="font-bold">{report.transactionsCount.online}</span> تحويل
                    إلكتروني مؤكد
                  </p>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-info relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> محصل كاش في الملعب
                  </p>
                  <p className="font-display text-2xl font-black text-info print:text-black mt-1">
                    {report.totalCash} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                    <span className="rounded bg-info/10 px-1.5 py-0.5 text-info border border-info/20">
                      حجز يدوي: {report.totalManualCash ?? 0} ج.م
                    </span>
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-amber-700 dark:text-warning border border-warning/30">
                      باقي الحجز: {report.totalRestCash ?? 0} ج.م
                    </span>
                  </div>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-destructive relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="size-4 text-destructive" /> متبقي بالملعب (لم يُحصل)
                  </p>
                  <p className="font-display text-2xl font-black text-destructive print:text-black mt-1">
                    {report.totalRemainingInVenue ?? 0}{" "}
                    <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      تطبيق: {report.bookingsSummary?.appBookingsCount ?? 0}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      يدوي: {report.bookingsSummary?.manualBookingsCount ?? 0}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">
                      تحصيل باقي: {report.bookingsSummary?.restCollectionsCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. جدول تفصيل الإيرادات حسب الملعب */}
              <div className="mt-6">
                <h4 className="font-bold text-md mb-3 text-foreground print:text-black flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> تفصيل الإيرادات حسب الملعب
                </h4>
                <div
                  className={cn(
                    "rounded-xl border border-border print:border-gray-300 print:overflow-visible",
                    !isCapturing ? "overflow-x-auto" : "overflow-visible",
                  )}
                >
                  <table
                    className={cn(
                      "w-full text-sm text-right print:min-w-0",
                      !isCapturing ? "min-w-[700px]" : "min-w-0",
                    )}
                  >
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">اسم الملعب</th>
                        <th className="px-3 py-2.5 font-bold text-center">تفصيل الحجوزات</th>
                        <th className="px-3 py-2.5 font-bold text-success">أونلاين (عربون)</th>
                        <th className="px-3 py-2.5 font-bold text-info">كاش (حجز يدوي)</th>
                        <th className="px-3 py-2.5 font-bold text-amber-600">كاش (باقي الحجز)</th>
                        <th className="px-3 py-2.5 font-bold text-primary">إجمالي المحصل</th>
                        <th className="px-3 py-2.5 font-bold text-destructive">متبقي بالملعب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.courtsBreakdown.map((court, index) => {
                        return (
                          <tr
                            key={court._id || index}
                            className="border-b border-border/50 last:border-0 print:border-gray-200 print:text-black"
                          >
                            <td className="px-3 py-2.5 font-extrabold text-foreground print:text-black">
                              {court.courtName || "غير محدد"}
                            </td>
                            <td className="px-3 py-2.5 text-center">
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
                                      +{court.restCollectionsCount} تحصيل باقي
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-success">
                              {Number(court.totalOnline || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-3 py-2.5 font-bold text-info">
                              {Number(court.totalManualCash || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-3 py-2.5 font-bold text-amber-600">
                              {Number(court.totalRestCash || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-3 py-2.5 font-black text-primary print:text-black">
                              {Number(court.totalRevenue || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-3 py-2.5 font-bold text-destructive">
                              {Number(court.totalRemaining || 0) > 0
                                ? `${Number(court.totalRemaining).toFixed(2)} ج.م`
                                : "0 ج.م"}
                            </td>
                          </tr>
                        );
                      })}
                      {report.courtsBreakdown.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-muted-foreground font-bold"
                          >
                            لا توجد إيرادات مسجلة للملاعب في هذه الفترة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. جدول سجل الحجوزات والعمليات التفصيلي */}
              <div className="mt-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="font-bold text-md text-foreground print:text-black flex items-center gap-2">
                    <ListFilter className="size-4 text-primary" /> سجل الحجوزات والعمليات التفصيلي (
                    {filteredBookingsDetails.length})
                  </h4>

                  <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <div className="relative">
                      <Search className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="ابحث بالاسم أو الرقم..."
                        className="rounded-xl border border-border bg-card py-1.5 pr-8 pl-3 text-xs font-bold outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex rounded-xl border border-border bg-muted/50 p-0.5 text-xs font-bold">
                      {[
                        { id: "all", label: "الكل" },
                        { id: "app", label: "تطبيق (أونلاين)" },
                        { id: "manual", label: "حجز يدوي" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTypeFilter(tab.id as "all" | "app" | "manual")}
                          className={cn(
                            "rounded-lg px-2.5 py-1 transition",
                            typeFilter === tab.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-xl border border-border print:border-gray-300 print:overflow-visible",
                    !isCapturing ? "overflow-x-auto" : "overflow-visible",
                  )}
                >
                  <table
                    className={cn(
                      "w-full text-xs sm:text-sm text-right print:min-w-0",
                      !isCapturing ? "min-w-[780px]" : "min-w-0",
                    )}
                  >
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">العميل والموبايل</th>
                        <th className="px-3 py-2.5 font-bold">الملعب ونوع الحجز</th>
                        <th className="px-3 py-2.5 font-bold">ميعاد اللعب</th>
                        <th className="px-3 py-2.5 font-bold">إجمالي سعر الحجز</th>
                        <th className="px-3 py-2.5 font-bold">تفاصيل الدفعات في الفترة</th>
                        <th className="px-3 py-2.5 font-bold text-primary">المحصل بالفترة</th>
                        <th className="px-3 py-2.5 font-bold">حالة باقي الحجز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookingsDetails.map((b) => {
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

                        return (
                          <tr
                            key={b._id}
                            className="border-b border-border/50 last:border-0 hover:bg-muted/20 print:border-gray-200 print:text-black align-top"
                          >
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
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-bold text-foreground">
                                  {b.courtName || "---"}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-extrabold border",
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
                                <span className="font-bold text-foreground">{playDateStr}</span>
                                <span className="text-[11px] font-bold text-primary">
                                  الساعة {playTimeStr} ({b.durationInHours} س)
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
                                        وقت التسجيل:{" "}
                                        {new Date(p.date).toLocaleString("ar-EG", {
                                          day: "numeric",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    {p.notes && (
                                      <span className="text-[10px] text-muted-foreground/90 mt-0.5">
                                        ملاحظة: {p.notes}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="px-3 py-2.5 font-black text-primary">
                              {b.paidInPeriodTotal} ج.م
                            </td>

                            <td className="px-3 py-2.5">
                              <div className="flex flex-col items-start gap-1">
                                {b.remainingAmount > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[11px] font-black text-destructive border border-destructive/20">
                                    باقي بالملعب: {b.remainingAmount} ج.م
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-0.5 text-[11px] font-black text-success border border-success/20">
                                    <CheckCircle2 className="size-3" /> خالص بالكامل
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  إجمالي المدفوع: {b.totalPaidSoFar} من {b.totalPrice} ج.م
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredBookingsDetails.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-8 text-center text-muted-foreground font-bold"
                          >
                            لا توجد حركات مطابقة للبحث في هذه الفترة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
