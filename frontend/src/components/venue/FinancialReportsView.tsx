import { useState, useRef } from "react";
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
  totalCash: number;
  netAmount: number;
  totalCommission: number;
  bookingsCount: number;
}

interface ReportData {
  dateRange: { from: string; to: string };
  totalOnline: number;
  totalCash: number;
  totalOverall: number;
  totalCommission: number;
  transactionsCount: {
    online: number;
    cash: number;
    total: number;
  };
  courtsBreakdown: CourtBreakdown[];
}

export function FinancialReportsView({ venueId }: { venueId: string }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

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

  const handlePrint = async () => {
    if (!Capacitor.isNativePlatform()) {
      window.print();
      return;
    }

    if (!reportRef.current) return;
    const toastId = toast.loading("جاري تجهيز ملف PDF...");
    setIsCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const dataUrl = await domToPng(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const elementWidth = reportRef.current.offsetWidth;
      const elementHeight = reportRef.current.offsetHeight;

      const pdf = new jsPDF({
        orientation: "portrait",
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
    csvContent += "تقرير تصفية الحسابات\n\n";
    csvContent += `من تاريخ:, ${startDate}\n`;
    csvContent += `إلى تاريخ:, ${endDate}\n\n`;

    csvContent += "--- الإجماليات ---\n";
    csvContent += "الإجمالي الكلي,إيرادات أونلاين,إيرادات الكاش\n";
    csvContent += `${report.totalOverall} ج.م,${report.totalOnline} ج.م,${report.totalCash} ج.م\n\n`;

    csvContent += "--- تفصيل الملاعب ---\n";
    csvContent +=
      "اسم الملعب,عدد الحجوزات,إيراد الكاش,إيراد أونلاين,إجمالي الإيرادات,صافي المستحقات,الجهة المستحقة\n";
    report.courtsBreakdown.forEach((court) => {
      const isOwed = court.netAmount >= 0;
      csvContent += `${court.courtName || "غير محدد"},${court.bookingsCount},${Number(court.totalCash || 0).toFixed(2)} ج.م,${Number(court.totalOnline || 0).toFixed(2)} ج.م,${Number(court.totalRevenue).toFixed(2)} ج.م,${Math.abs(Number(court.netAmount || 0)).toFixed(2)} ج.م,${isOwed ? "لك" : "عليك"}\n`;
    });

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
    await new Promise((resolve) => setTimeout(resolve, 150));
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
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> التقارير وتصفية الحسابات
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
              <Download className="size-4" /> إكسيل
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
              ref={reportRef}
              className={`space-y-6 bg-background print:bg-white print:p-0 print:m-0 rounded-2xl p-4 ${isCapturing ? "w-max min-w-full" : ""}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground print:text-black">
                    التقرير المالي وتصفية الحسابات
                  </h3>
                  <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                    الفترة من: <span className="font-bold">{startDate}</span> إلى{" "}
                    <span className="font-bold">{endDate}</span>
                  </p>
                </div>
              </div>

              {/* ملخص إجمالي الدخل */}
              <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-4">
                <div className="card-surface p-5 border-b-4 border-b-primary relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> إجمالي الدخل
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-primary print:text-black mt-2">
                    {report.totalOverall} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    إجمالي <span className="font-bold">{report.transactionsCount.total}</span> عملية
                  </p>
                </div>

                <div className="card-surface p-5 border-b-4 border-b-success relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-success" /> إيرادات أونلاين
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-success print:text-black mt-2">
                    {report.totalOnline} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-bold">{report.transactionsCount.online}</span> تحويل
                    إلكتروني
                  </p>
                </div>

                <div className="card-surface p-5 border-b-4 border-b-info relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> إيرادات الكاش
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-info print:text-black mt-2">
                    {report.totalCash} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-bold">{report.transactionsCount.cash}</span> عملية دفع
                    يدوي
                  </p>
                </div>
              </div>

              {/* ملخص تصفية الحسابات للنادي ككل */}
              <div className="mt-6 p-4 rounded-xl border border-border bg-muted/30 print:bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h4 className="font-bold text-foreground print:text-black">
                    تصفية المستحقات المجمعة
                  </h4>
                  <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">
                    الرقم النهائي المطلوب تسويته مع المنصة بناءً على جميع حجوزات النادي.
                  </p>
                </div>
                {(() => {
                  const totalNet = report.totalOnline - report.totalCommission;
                  const isOwedToVenue = totalNet >= 0;
                  return (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border",
                        isOwedToVenue
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                          : "bg-red-500/10 border-red-500/20 text-red-600",
                      )}
                    >
                      <span className="font-bold text-sm">
                        {isOwedToVenue ? "إجمالي المستحق لك:" : "إجمالي المطلوب منك:"}
                      </span>
                      <span className="font-black text-xl">
                        {Math.abs(totalNet).toFixed(2)} ج.م
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-8">
                <h4 className="font-bold text-md mb-3 text-foreground print:text-black flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> تفصيل الإيرادات وتصفية الحسابات حسب
                  الملعب
                </h4>
                <div
                  className={`rounded-xl border border-border print:border-gray-300 ${!isCapturing ? "overflow-x-auto" : ""}`}
                >
                  <table className="w-full text-sm text-right min-w-[700px]">
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-4 py-3 font-bold whitespace-nowrap">اسم الملعب</th>
                        <th className="px-4 py-3 font-bold text-center whitespace-nowrap">
                          الحجوزات
                        </th>
                        <th className="px-4 py-3 font-bold whitespace-nowrap text-info">
                          إيراد الكاش
                        </th>
                        <th className="px-4 py-3 font-bold whitespace-nowrap text-success">
                          إيراد أونلاين
                        </th>
                        <th className="px-4 py-3 font-bold whitespace-nowrap text-primary">
                          إجمالي الإيرادات
                        </th>
                        <th className="px-4 py-3 font-bold whitespace-nowrap text-foreground print:text-black">
                          صافي المستحقات
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.courtsBreakdown.map((court, index) => {
                        const isOwedToVenue = court.netAmount >= 0;
                        return (
                          <tr
                            key={court._id || index}
                            className="border-b border-border/50 last:border-0 print:border-gray-200 print:text-black"
                          >
                            <td className="px-4 py-3 font-semibold text-foreground print:text-black whitespace-nowrap">
                              {court.courtName || "غير محدد"}
                            </td>
                            <td className="px-4 py-3 font-bold text-center whitespace-nowrap">
                              {court.bookingsCount}
                            </td>
                            <td className="px-4 py-3 font-semibold text-info whitespace-nowrap">
                              {Number(court.totalCash || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-4 py-3 font-semibold text-success whitespace-nowrap">
                              {Number(court.totalOnline || 0).toFixed(2)} ج.م
                            </td>
                            <td className="px-4 py-3 font-black text-primary print:text-black whitespace-nowrap">
                              {Number(court.totalRevenue).toFixed(2)} ج.م
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 font-black whitespace-nowrap",
                                isOwedToVenue ? "text-emerald-600" : "text-red-500",
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground print:border print:border-gray-200">
                                  {isOwedToVenue ? "لك" : "عليك"}
                                </span>
                                {Math.abs(Number(court.netAmount || 0)).toFixed(2)} ج.م
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {report.courtsBreakdown.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
