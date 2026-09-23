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
} from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
// @ts-expect-error: API lacks TypeScript definitions
import { fetchAllVenues, fetchDailyClosing } from "@/api/adminApi";

interface CourtDetails {
  courtId: string;
  courtName: string;
  totalOnline: number;
  totalCash: number;
  totalRevenue: number;
  totalCommission: number;
  bookingsCount: number;
}

interface VenueClosing {
  _id: string;
  venueName: string;
  venueTotalOnline: number;
  venueTotalCash: number;
  venueTotalRevenue: number;
  venueTotalCommission: number;
  venueBookingsCount: number;
  courts: CourtDetails[];
}

interface PlatformTotals {
  totalRevenue: number;
  totalCommission: number;
  totalOnline: number;
  totalCash: number;
  totalBookings: number;
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
  const reportRef = useRef<HTMLDivElement>(null);

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
      const dataUrl = await domToPng(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const elementWidth = reportRef.current.offsetWidth;
      const elementHeight = reportRef.current.offsetHeight;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [elementWidth, elementHeight],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, elementWidth, elementHeight);
      const pdfBase64 = pdf.output("datauristring").split(",")[1] ?? "";

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

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-10 mt-8 mx-4 sm:mx-8">
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
            <ClipboardList className="size-6 text-primary" /> تقفيل اليومية
          </h2>
          <p className="text-sm text-muted-foreground font-bold bg-muted px-3 py-1.5 rounded-lg border border-border">
            إيرادات يومية مفصلة
          </p>
        </div>

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
                <Search className="size-4" /> عرض
              </>
            )}
          </button>
        </div>
      </div>

      {closingData && (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden justify-end mt-2">
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
              <div className="border-b border-border pb-4">
                <h3 className="font-bold text-lg text-foreground print:text-black">
                  تقرير اليومية الشامل
                </h3>
                <p className="text-sm text-muted-foreground print:text-gray-600 mt-1">
                  تاريخ اليومية: <span className="font-bold">{date}</span>
                </p>
              </div>

              {/* ملخص إجمالي المنصة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4">
                <div className="card-surface p-5 border-b-4 border-b-primary print:border print:shadow-none">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" /> الإجمالي
                  </p>
                  <p className="font-display text-2xl font-black text-primary mt-2">
                    {closingData.platformTotals.totalRevenue} ج.م
                  </p>
                </div>
                <div className="card-surface p-5 border-b-4 border-b-success print:border print:shadow-none">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="size-4 text-success" /> أونلاين
                  </p>
                  <p className="font-display text-2xl font-black text-success mt-2">
                    {closingData.platformTotals.totalOnline} ج.م
                  </p>
                </div>
                <div className="card-surface p-5 border-b-4 border-b-warning print:border print:shadow-none">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <PieChart className="size-4 text-warning" /> عمولة التطبيق
                  </p>
                  <p className="font-display text-2xl font-black text-warning mt-2">
                    {closingData.platformTotals.totalCommission} ج.م
                  </p>
                </div>
                <div className="card-surface p-5 border-b-4 border-b-info print:border print:shadow-none">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Banknote className="size-4 text-info" /> كاش (بالنادي)
                  </p>
                  <p className="font-display text-2xl font-black text-info mt-2">
                    {closingData.platformTotals.totalCash} ج.م
                  </p>
                </div>
              </div>

              {/* تفاصيل كل نادي */}
              <div className="space-y-8 mt-8">
                {closingData.venuesClosing.map((venue) => (
                  <div
                    key={venue._id}
                    className="border border-border print:border-gray-300 rounded-xl overflow-hidden"
                  >
                    <div className="bg-muted/50 print:bg-gray-100 p-4 border-b border-border flex justify-between items-center">
                      <h4 className="font-bold text-lg">{venue.venueName}</h4>
                      <p className="text-sm font-bold text-primary">
                        الإجمالي: {venue.venueTotalRevenue} ج.م
                      </p>
                    </div>
                    <div className={`p-0 ${!isCapturing ? "overflow-x-auto" : ""}`}>
                      <table className="w-full text-sm text-right min-w-[700px]">
                        <thead className="bg-background print:bg-white text-muted-foreground border-b border-border">
                          <tr>
                            <th className="px-4 py-3 font-bold whitespace-nowrap">الملعب</th>
                            <th className="px-4 py-3 font-bold text-center whitespace-nowrap">
                              الحجوزات
                            </th>
                            <th className="px-4 py-3 font-bold whitespace-nowrap text-info">
                              إيراد الكاش
                            </th>
                            <th className="px-4 py-3 font-bold whitespace-nowrap text-success">
                              إيراد أونلاين
                            </th>
                            <th className="px-4 py-3 font-bold whitespace-nowrap text-warning">
                              عمولة التطبيق
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {venue.courts.map((court) => (
                            <tr
                              key={court.courtId}
                              className="border-b border-border/50 last:border-0 print:border-gray-200"
                            >
                              <td className="px-4 py-3 font-bold whitespace-nowrap">
                                {court.courtName}
                              </td>
                              <td className="px-4 py-3 font-bold text-center whitespace-nowrap">
                                {court.bookingsCount}
                              </td>
                              <td className="px-4 py-3 font-semibold text-info whitespace-nowrap">
                                {court.totalCash} ج.م
                              </td>
                              <td className="px-4 py-3 font-semibold text-success whitespace-nowrap">
                                {court.totalOnline} ج.م
                              </td>
                              <td className="px-4 py-3 font-black text-warning whitespace-nowrap">
                                {court.totalCommission} ج.م
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
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
