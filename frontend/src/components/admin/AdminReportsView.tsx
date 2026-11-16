import { useState, useRef, useEffect, useMemo } from "react";
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
  Building2,
  PieChart,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  Phone,
  ListFilter,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues } from "@/api/adminApi";
// @ts-expect-error: API lacks TypeScript definitions
import apiClient from "@/api/axiosConfig";

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

interface CourtBreakdown {
  _id: string;
  courtName: string;
  venueName: string;
  totalRevenue: number;
  totalOnline: number;
  totalManualCash?: number;
  totalRestCash?: number;
  totalCash: number;
  netAmount: number;
  totalCommission: number;
  bookingsCount: number;
  appBookingsCount?: number;
  manualBookingsCount?: number;
  restCollectionsCount?: number;
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
  calculatedCommission: number;
  hasInitialPaymentInPeriod: number;
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
  totalCommission: number;
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

interface VenueOption {
  _id: string;
  name: string;
}

export function AdminReportsView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [venuesList, setVenuesList] = useState<VenueOption[]>([]);

  const [report, setReport] = useState<ReportData | null>(null);

  const [loading, setLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "app" | "manual">("all");

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllVenues()
      .then(setVenuesList)
      .catch(() => {});
  }, []);

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
      const url =
        selectedVenue === "all"
          ? `/payments/reports?startDate=${startDate}&endDate=${endDate}&venue=all`
          : `/payments/reports?startDate=${startDate}&endDate=${endDate}&venue=${selectedVenue}`;

      const res = await apiClient.get(url);
      setReport(res.data.data.report);
      toast.success("تم استخراج التقرير بنجاح");
    } catch (err: unknown) {
      // @ts-expect-error axios
      toast.error(err.response?.data?.message || "حدث خطأ أثناء استخراج التقرير");
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
        (item.venueName || "").toLowerCase().includes(q) ||
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

      const pdfBase64 = pdf.output("datauristring").split(",")[1];
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

    const ownerTotalNet = Number((report.totalOverall - report.totalCommission).toFixed(2));
    const settlementDiff = Number((report.totalOnline - report.totalCommission).toFixed(2));

    let csvContent = "\uFEFF";
    csvContent += "تقرير تصفية الحسابات الشامل للمنصة\n\n";
    csvContent += `من تاريخ:, ${startDate}\n`;
    csvContent += `إلى تاريخ:, ${endDate}\n\n`;

    csvContent += "--- ملخص التصفية المالية ---\n";
    csvContent +=
      "إجمالي المحصل,أونلاين (بمحفظة المنصة),كاش (بدرج النادي),صافي عمولة المنصة,صافي نصيب النادي,التصفية النهائية\n";
    csvContent += `${report.totalOverall} ج.م,${report.totalOnline} ج.م,${report.totalCash} ج.م,${report.totalCommission} ج.م,${ownerTotalNet} ج.م,${settlementDiff >= 0 ? `المنصة تحول للنادي ${settlementDiff} ج.م` : `النادي يحول للمنصة ${Math.abs(settlementDiff)} ج.م`}\n\n`;

    csvContent += "--- تفصيل الملاعب ---\n";
    csvContent +=
      "النادي,اسم الملعب,حجوزات تطبيق,حجوزات يدوية,تحصيل باقي حجز,أونلاين (عند المنصة),كاش يدوي (عند النادي),كاش باقي (عند النادي),عمولة المنصة,صافي دخل النادي,مبلغ التصفية,الجهة المستحقة\n";
    report.courtsBreakdown.forEach((court) => {
      const isOwed = court.netAmount >= 0;
      const courtOwnerNet = Number((court.totalRevenue - court.totalCommission).toFixed(2));
      csvContent += `${court.venueName || "غير محدد"},${court.courtName || "غير محدد"},${court.appBookingsCount ?? 0},${court.manualBookingsCount ?? 0},${court.restCollectionsCount ?? 0},${Number(court.totalOnline || 0).toFixed(2)} ج.م,${Number(court.totalManualCash || 0).toFixed(2)} ج.م,${Number(court.totalRestCash || 0).toFixed(2)} ج.م,${Number(court.totalCommission).toFixed(2)} ج.م,${courtOwnerNet} ج.م,${Math.abs(Number(court.netAmount || 0)).toFixed(2)} ج.م,${isOwed ? "المنصة تحول للنادي" : "النادي يحول للمنصة"}\n`;
    });

    if (report.bookingsDetails && report.bookingsDetails.length > 0) {
      csvContent += "\n--- سجل الحجوزات والعمليات التفصيلي ---\n";
      csvContent +=
        "النادي,الملعب,العميل,رقم الموبايل,نوع الحجز,ميعاد اللعب,المدة,سعر الحجز الكلي,تفاصيل الدفعات في الفترة,المحصل في الفترة,نسبة العمولة,قيمة العمولة,المتبقي في الملعب\n";
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
        const rateText =
          b.hasInitialPaymentInPeriod === 0
            ? "محسوبة مسبقاً"
            : b.durationInHours >= 2
              ? "10% (ساعتين)"
              : "5% (ساعة)";

        csvContent += `"${b.venueName || ""}","${b.courtName || ""}","${b.customerName}","${b.customerPhone}","${b.bookingTypeLabel}","${playDate}","${b.durationInHours} ساعة",${b.totalPrice} ج.م,"${paymentsText}",${b.paidInPeriodTotal} ج.م,"${rateText}",${Number(b.calculatedCommission || 0).toFixed(2)} ج.م,${b.remainingAmount} ج.م\n`;
      });
    }

    const fileName = `Financial_Report_${startDate}_${endDate}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
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

  // حسابات التصفية الإجمالية الواضحة بين المنصة وصاحب النادي
  const totalOwnerNetShare = report
    ? Number((report.totalOverall - report.totalCommission).toFixed(2))
    : 0;
  const totalSettlementAmount = report
    ? Number((report.totalOnline - report.totalCommission).toFixed(2))
    : 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10 mt-8 mx-4 sm:mx-8">
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
          #printable-admin-report, #printable-admin-report * {
            visibility: visible;
          }
          #printable-admin-report {
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
          #printable-admin-report table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
          }
          #printable-admin-report th,
          #printable-admin-report td {
            white-space: normal !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          #printable-admin-report tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> تقارير وإحصائيات المنصة الشاملة (ERP)
          </h2>
          <p className="text-sm text-muted-foreground font-bold bg-muted px-3 py-1.5 rounded-lg border border-border">
            أقصى مدة للتقرير 30 يوم
          </p>
        </div>

        <div className="card-surface p-5 border-b-4 border-b-primary flex flex-col lg:flex-row gap-4 items-end mt-4">
          <div className="w-full lg:w-1/3 space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-4" /> تحديد النادي
            </label>
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold outline-none focus:border-primary"
            >
              <option value="all">-- تقرير شامل لكل الأندية --</option>
              {venuesList.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-1/3 space-y-1.5">
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
          <div className="hidden lg:flex items-center justify-center pb-3 text-muted-foreground">
            <ArrowRightLeft className="size-5" />
          </div>
          <div className="w-full lg:w-1/3 space-y-1.5">
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
            className="w-full lg:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition disabled:opacity-50 hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Search className="size-4" /> استخراج
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
              id="printable-admin-report"
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
                    التقرير المالي الشامل لشبكة الأندية
                  </h3>
                  <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                    الفترة من: <span className="font-bold">{startDate}</span> إلى{" "}
                    <span className="font-bold">{endDate}</span>
                  </p>
                  <p className="text-xs font-bold text-primary mt-1">
                    النطاق:{" "}
                    {selectedVenue === "all"
                      ? "جميع الأندية والمنشآت"
                      : venuesList.find((v) => v._id === selectedVenue)?.name}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs font-bold text-muted-foreground border border-border">
                  نظام العمولة الثابت: <span className="text-primary">5% للساعة</span> |{" "}
                  <span className="text-primary">10% للساعتين فأكثر</span> (من إجمالي سعر الحجز)
                </div>
              </div>

              {/* 1. الكروت العلوية */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
                <div className="card-surface p-4 border-b-4 border-b-primary relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> إجمالي الأموال المحصلة
                  </p>
                  <p className="font-display text-2xl font-black text-primary print:text-black mt-1">
                    {report.totalOverall} <span className="text-xs font-bold">ج.م</span>
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

                <div className="card-surface p-4 border-b-4 border-b-success relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-success" /> محصل أونلاين (بمحفظة المنصة)
                  </p>
                  <p className="font-display text-2xl font-black text-success print:text-black mt-1">
                    {report.totalOnline} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    <span className="font-bold">{report.transactionsCount.online}</span> تحويل
                    إلكتروني مؤكد عند المنصة
                  </p>
                </div>

                <div className="card-surface p-4 border-b-4 border-b-info relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> محصل كاش (بدرج النادي)
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

                <div className="card-surface p-4 border-b-4 border-b-warning relative overflow-hidden print:border print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <PieChart className="size-4 text-warning" /> صافي عمولة المنصة (أرباحك)
                  </p>
                  <p className="font-display text-2xl font-black text-warning print:text-black mt-1">
                    {report.totalCommission} <span className="text-xs font-bold">ج.م</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    متبقي بالملاعب لم يُحصل:{" "}
                    <span className="font-bold text-destructive">
                      {report.totalRemainingInVenue ?? 0} ج.م
                    </span>
                  </p>
                </div>
              </div>

              {/* 2. شريط التصفية النهائية الواضح (ليك كام وصاحب النادي ليه كام بالضبط) */}
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 print:border print:border-gray-300 print:bg-gray-50">
                <h4 className="text-xs sm:text-sm font-extrabold text-primary mb-3 flex items-center gap-1.5">
                  <Calculator className="size-4" /> خلاصة التصفية المالية (ليك كام وصاحب النادي ليه
                  كام من الـ {report.totalOverall} ج.م المحصلة):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-card p-3 border border-border">
                    <span className="text-muted-foreground font-bold block">
                      1. حق المنصة الصافي (عمولتك):
                    </span>
                    <span className="text-lg font-black text-warning mt-0.5 block">
                      {report.totalCommission} ج.م
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      تُخصم من الأونلاين المحصل ({report.totalOnline} ج.م)
                    </span>
                  </div>

                  <div className="rounded-xl bg-card p-3 border border-border">
                    <span className="text-muted-foreground font-bold block">
                      2. حق صاحب النادي الصافي (بعد العمولة):
                    </span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {totalOwnerNetShare} ج.م
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      استلم منها {report.totalCash} ج.م كاش في يده بالملعب
                    </span>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl p-3 border",
                      totalSettlementAmount >= 0
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-destructive/10 border-destructive/30",
                    )}
                  >
                    <span className="font-bold block text-foreground">
                      3. التصفية النهائية (مين يحول لمين؟):
                    </span>
                    <span
                      className={cn(
                        "text-lg font-black mt-0.5 block",
                        totalSettlementAmount >= 0 ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {totalSettlementAmount >= 0
                        ? `حوّل للنادي: ${totalSettlementAmount} ج.م`
                        : `النادي يحوّل لك: ${Math.abs(totalSettlementAmount)} ج.م`}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      المعادلة: أونلاين معك ({report.totalOnline}) - عمولتك (
                      {report.totalCommission})
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. جدول تفصيل الملاعب */}
              <div className="mt-6">
                <h4 className="font-bold text-md mb-3 text-foreground print:text-black flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> تفصيل الإيرادات والعمولات والتصفية
                  للملاعب
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
                      !isCapturing ? "min-w-[820px]" : "min-w-0",
                    )}
                  >
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">النادي / الملعب</th>
                        <th className="px-3 py-2.5 font-bold text-center">تفصيل الحجوزات</th>
                        <th className="px-3 py-2.5 font-bold text-success">أونلاين (مع المنصة)</th>
                        <th className="px-3 py-2.5 font-bold text-info">كاش (بدرج النادي)</th>
                        <th className="px-3 py-2.5 font-bold text-warning">حق المنصة (العمولة)</th>
                        <th className="px-3 py-2.5 font-bold text-foreground">صافي دخل النادي</th>
                        <th className="px-3 py-2.5 font-bold text-primary">
                          التصفية (مين يحول لمين)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.courtsBreakdown.map((court, index) => {
                        const isOwedToVenue = court.netAmount >= 0;
                        const courtOwnerNet = Number(
                          ((court.totalRevenue || 0) - (court.totalCommission || 0)).toFixed(2),
                        );

                        return (
                          <tr
                            key={court._id || index}
                            className="border-b border-border/50 last:border-0 print:border-gray-200 print:text-black"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-foreground print:text-black">
                                  {court.venueName || "---"}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">
                                  {court.courtName || "---"}
                                </span>
                              </div>
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
                                      +{court.restCollectionsCount} باقي
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-success">
                              {Number(court.totalOnline || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-bold text-info">
                                  {Number(court.totalCash || 0).toFixed(2)} ج.م
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  يدوي: {court.totalManualCash ?? 0} | باقي:{" "}
                                  {court.totalRestCash ?? 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-black text-warning print:text-black">
                              <div className="flex flex-col">
                                <span>{Number(court.totalCommission).toFixed(2)} ج.م</span>
                                <span className="text-[10px] text-muted-foreground font-bold">
                                  (5% ساعة / 10% ساعتين)
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-black text-foreground">
                                  {courtOwnerNet.toFixed(2)} ج.م
                                </span>
                                <span className="text-[10px] text-muted-foreground font-bold">
                                  من إجمالي {Number(court.totalRevenue || 0).toFixed(0)} ج.م
                                </span>
                              </div>
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2.5 font-black",
                                isOwedToVenue ? "text-emerald-600" : "text-red-500",
                              )}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground print:border print:border-gray-200">
                                    {isOwedToVenue ? "حوّل للنادي" : "النادي يحوّل لك"}
                                  </span>
                                  <span>
                                    {Math.abs(Number(court.netAmount || 0)).toFixed(2)} ج.م
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  ({Number(court.totalOnline || 0).toFixed(0)} أونلاين -{" "}
                                  {Number(court.totalCommission || 0).toFixed(0)} عمولة)
                                </span>
                              </div>
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
                            لا توجد إيرادات مسجلة لهذه الفترة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. جدول سجل الحجوزات والعمليات التفصيلي للأدمن */}
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
                        placeholder="ابحث بالعميل، الرقم، النادي..."
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
                      !isCapturing ? "min-w-[800px]" : "min-w-0",
                    )}
                  >
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">النادي والملعب</th>
                        <th className="px-3 py-2.5 font-bold">العميل والموبايل</th>
                        <th className="px-3 py-2.5 font-bold">ميعاد اللعب والمدة</th>
                        <th className="px-3 py-2.5 font-bold">سعر الحجز الكلي</th>
                        <th className="px-3 py-2.5 font-bold">تفاصيل الدفعات في الفترة</th>
                        <th className="px-3 py-2.5 font-bold text-warning">عمولة المنصة</th>
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
                        const ratePercent = b.durationInHours >= 2 ? "10%" : "5%";

                        return (
                          <tr
                            key={b._id}
                            className="border-b border-border/50 last:border-0 hover:bg-muted/20 print:border-gray-200 print:text-black align-top"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col items-start gap-1">
                                <span className="font-extrabold text-foreground">
                                  {b.venueName || "---"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-muted-foreground">
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
                                <span className="font-bold text-foreground">{playDateStr}</span>
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
                              {b.hasInitialPaymentInPeriod === 0 ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-muted-foreground">0.00 ج.م</span>
                                  <span className="text-[10px] font-bold text-muted-foreground/80">
                                    محسوبة يوم الحجز
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="font-black text-warning">
                                    {Number(b.calculatedCommission || 0).toFixed(2)} ج.م
                                  </span>
                                  <span className="text-[10px] font-bold text-muted-foreground">
                                    ({ratePercent} من {b.totalPrice} ج)
                                  </span>
                                </div>
                              )}
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
