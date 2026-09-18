import { useState, useRef, useEffect } from "react";
import { domToPng } from "modern-screenshot";
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
  Loader2, // +++ 1. تم إضافة Loader2 هنا +++
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues } from "@/api/adminApi";
// @ts-expect-error: API lacks TypeScript definitions // +++ 2. تم إضافة تعليق التجاهل لـ axiosConfig +++
import apiClient from "@/api/axiosConfig";

interface CourtBreakdown {
  _id: string;
  courtName: string;
  venueName: string;
  totalRevenue: number;
  totalCommission: number;
  bookingsCount: number;
}

interface ReportData {
  dateRange: { from: string; to: string };
  totalOnline: number;
  totalCash: number;
  totalOverall: number;
  totalCommission: number;
  transactionsCount: { online: number; cash: number; total: number };
  courtsBreakdown: CourtBreakdown[];
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

  const reportRef = useRef<HTMLDivElement>(null);

  // جلب قائمة الأندية للفلتر
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

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!report) return;
    let csvContent = "\uFEFFتقرير تصفية الحسابات والعمولات\n\n";
    csvContent += `من تاريخ:, ${startDate}\nإلى تاريخ:, ${endDate}\n`;
    csvContent += `النادي:, ${selectedVenue === "all" ? "جميع الأندية" : venuesList.find((v) => v._id === selectedVenue)?.name}\n\n`;

    csvContent += "--- الإجماليات ---\n";
    csvContent += "الإجمالي الكلي,إيرادات أونلاين,إيرادات الكاش,عمولة المنصة\n";
    csvContent += `${report.totalOverall} ج.م,${report.totalOnline} ج.م,${report.totalCash} ج.م,${report.totalCommission} ج.م\n\n`;

    csvContent += "--- تفصيل الملاعب ---\n";
    csvContent += "اسم النادي,اسم الملعب,عدد الحجوزات,إجمالي الإيرادات,عمولة المنصة\n";
    report.courtsBreakdown.forEach((court) => {
      csvContent += `${court.venueName || "---"},${court.courtName || "---"},${court.bookingsCount},${Number(court.totalRevenue).toFixed(2)} ج.م,${Number(court.totalCommission).toFixed(2)} ج.م\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_المنصة_${startDate}_إلى_${endDate}.csv`;
    link.click();
  };

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    const toastId = toast.loading("جاري تجهيز الصورة...");
    try {
      const dataUrl = await domToPng(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `تقرير_المنصة_${startDate}_إلى_${endDate}.png`;
      link.click();
      toast.success("تم تحميل الصورة بنجاح", { id: toastId });
    } catch {
      toast.error("حدث خطأ أثناء استخراج الصورة", { id: toastId });
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10 mt-8 mx-4 sm:mx-8">
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> تقارير وإحصائيات المنصة (ERP)
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
              className="space-y-6 bg-background print:bg-white print:p-0 print:m-0 rounded-2xl p-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground print:text-black">
                    التقرير المالي لشبكة الأندية
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
                <div className="card-surface p-5 border-b-4 border-b-primary relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> إجمالي تداول الأموال
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-primary print:text-black mt-2">
                    {report.totalOverall} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-bold">{report.transactionsCount.total}</span> عملية
                    (أونلاين وكاش)
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
                    إلكتروني مؤكد
                  </p>
                </div>

                <div className="card-surface p-5 border-b-4 border-b-warning relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <PieChart className="size-4 text-warning" /> عمولة التطبيق (الأرباح)
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-warning print:text-black mt-2">
                    {report.totalCommission} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">صافي الربح للمنصة</p>
                </div>

                <div className="card-surface p-5 border-b-4 border-b-info relative overflow-hidden print:border print:border-gray-200 print:shadow-none print:break-inside-avoid">
                  <p className="text-sm font-semibold text-muted-foreground print:text-gray-600 mb-1 flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> إيرادات الكاش
                  </p>
                  <p className="font-display text-2xl lg:text-3xl font-black text-info print:text-black mt-2">
                    {report.totalCash} <span className="text-sm font-bold">ج.م</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-bold">{report.transactionsCount.cash}</span> حجز يدوي
                    مباشر
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="font-bold text-md mb-3 text-foreground print:text-black flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> تفصيل الإيرادات والعمولات للملاعب
                </h4>
                <div className="overflow-hidden rounded-xl border border-border print:border-gray-300">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 text-muted-foreground print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="px-4 py-3 font-bold">النادي</th>
                        <th className="px-4 py-3 font-bold">الملعب</th>
                        <th className="px-4 py-3 font-bold text-center">الحجوزات</th>
                        <th className="px-4 py-3 font-bold">إجمالي الإيرادات</th>
                        <th className="px-4 py-3 font-bold text-warning">عمولة المنصة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.courtsBreakdown.map((court, index) => (
                        <tr
                          key={court._id || index}
                          className="border-b border-border/50 last:border-0 print:border-gray-200 print:text-black"
                        >
                          <td className="px-4 py-3 font-bold text-foreground print:text-black">
                            {court.venueName || "---"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-muted-foreground print:text-gray-600">
                            {court.courtName || "---"}
                          </td>
                          <td className="px-4 py-3 font-bold text-center">{court.bookingsCount}</td>
                          <td className="px-4 py-3 font-black text-primary print:text-black">
                            {Number(court.totalRevenue).toFixed(2)} ج.م
                          </td>
                          <td className="px-4 py-3 font-black text-warning print:text-black">
                            {Number(court.totalCommission).toFixed(2)} ج.م
                          </td>
                        </tr>
                      ))}
                      {report.courtsBreakdown.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
