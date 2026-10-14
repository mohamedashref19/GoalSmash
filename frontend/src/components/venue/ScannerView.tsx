import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
// @ts-expect-error: API lacks TypeScript definitions
import apiClient from "@/api/axiosConfig";

export function ScannerView() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // استخدمنا Ref لمنع إرسال نفس الطلب مرتين في نفس اللحظة
  const isProcessing = useRef(false);

  useEffect(() => {
    // إعداد الماسح الضوئي
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false,
    );

    const onScanSuccess = async (decodedText: string) => {
      // لو في طلب شغال حالياً، متعملش حاجة
      if (isProcessing.current) return;
      isProcessing.current = true;

      // محاولة إيقاف الكاميرا (هتنجح مع الكاميرا وهتفشل مع رفع الصورة)
      try {
        scanner.pause(true);
      } catch (err) {
        // إضافة سطر برمجي لتجنب تحذير ESLint (no-empty)
        console.debug("إيقاف الكاميرا غير مدعوم في هذه الحالة", err);
      }

      setScanResult(decodedText);
      setLoading(true);
      setSuccessMsg(null);

      try {
        // إرسال الـ ID المقروء إلى الباك إند
        const response = await apiClient.post("/bookings/confirm-qr", {
          bookingId: decodedText,
        });

        toast.success(response.data.message || "تم تأكيد الحجز بنجاح");
        setSuccessMsg("تم تأكيد الحجز واستلام المبلغ كاش بنجاح!");
      } catch (error: unknown) {
        // استخدام unknown بدلاً من any لحل تحذير ESLint
        const apiError = error as { response?: { data?: { message?: string } } };
        toast.error(apiError.response?.data?.message || "حدث خطأ أثناء المسح أو الحجز غير موجود");
        setScanResult(null); // إعادة التعيين ليتمكن من المحاولة مجدداً
      } finally {
        setLoading(false);
        // استئناف عمل الماسح بعد 3 ثواني
        setTimeout(() => {
          isProcessing.current = false;
          try {
            scanner.resume();
          } catch (err) {
            // إضافة سطر برمجي لتجنب تحذير ESLint (no-empty)
            console.debug("استئناف الكاميرا غير مدعوم في هذه الحالة", err);
          }
        }, 3000);
      }
    };

    scanner.render(onScanSuccess, () => {
      // يتم استدعاؤه باستمرار عند الفشل في قراءة إطار معين، يمكن تجاهله
    });

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in p-4">
      <div className="w-full max-w-md card-surface p-6 text-center space-y-4">
        <h2 className="font-display text-xl font-extrabold text-primary">مسح تذكرة الحجز</h2>
        <p className="text-sm text-muted-foreground">
          قم بتوجيه الكاميرا نحو الـ QR Code الموجود في هاتف العميل لتأكيد حجزه واستلام الكاش.
        </p>

        {/* حاوية الماسح الضوئي */}
        <div
          id="qr-reader"
          className="overflow-hidden rounded-2xl border-2 border-border/50 shadow-inner bg-black/5"
        />

        {loading && (
          <div className="flex items-center justify-center gap-2 text-warning font-bold mt-4">
            <Loader2 className="animate-spin size-5" /> جاري التحقق من الحجز...
          </div>
        )}

        {successMsg && !loading && (
          <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-xl text-success flex flex-col items-center gap-2">
            <CheckCircle2 className="size-8" />
            <span className="font-bold text-sm">{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
