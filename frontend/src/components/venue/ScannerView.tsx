import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
// @ts-expect-error: API lacks TypeScript definitions
import apiClient from "@/api/axiosConfig";

export function ScannerView() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isProcessing = useRef(false);
  // نحتفظ بمرجع للـ scanner عشان نقدر نقفله برا الدورة لو حبينا
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // إعداد الماسح الضوئي
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false,
    );
    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText: string) => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      setScanResult(decodedText);
      setLoading(true);
      setSuccessMsg(null);

      // محاولة إيقاف الكاميرا مؤقتاً أثناء التحميل
      try {
        scanner.pause(true);
      } catch (err) {
        console.debug("إيقاف الكاميرا غير مدعوم في هذه الحالة", err);
      }

      try {
        const response = await apiClient.post("/bookings/confirm-qr", {
          bookingId: decodedText,
        });

        toast.success(response.data.message || "تم تأكيد الحجز بنجاح");
        setSuccessMsg("تم تأكيد الحجز واستلام المبلغ كاش بنجاح!");

        // +++ إغلاق الكاميرا نهائياً بعد التأكيد بنجاح +++
        try {
          scanner.clear();
        } catch (err) {
          console.error("فشل إغلاق الكاميرا", err);
        }
      } catch (error: unknown) {
        const apiError = error as { response?: { data?: { message?: string } } };
        toast.error(apiError.response?.data?.message || "حدث خطأ أثناء المسح أو الحجز غير موجود");
        setScanResult(null);

        // استئناف الكاميرا في حالة الفشل فقط عشان يجرب تاني
        setTimeout(() => {
          isProcessing.current = false;
          try {
            scanner.resume();
          } catch (err) {
            console.debug("استئناف الكاميرا غير مدعوم", err);
          }
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    scanner.render(onScanSuccess, () => {});

    // +++ دالة لترجمة واجهة المكتبة للعربية +++
    const translateUI = () => {
      const buttons = document.querySelectorAll("#qr-reader button");
      buttons.forEach((btn) => {
        if (btn.textContent?.includes("Request Camera Permissions")) {
          btn.textContent = "إعطاء صلاحية الكاميرا";
        }
        if (btn.textContent?.includes("Start Scanning")) {
          btn.textContent = "ابدأ الـ Scan";
        }
        if (btn.textContent?.includes("Stop Scanning")) {
          btn.textContent = "إيقاف الكاميرا";
        }
      });

      const links = document.querySelectorAll("#qr-reader a");
      links.forEach((link) => {
        if (link.textContent?.includes("Scan an Image File")) {
          link.textContent = "أو مسح صورة من المعرض";
        }
        if (link.textContent?.includes("Scan using camera directly")) {
          link.textContent = "المسح باستخدام الكاميرا مباشرة";
        }
      });

      const selects = document.querySelectorAll("#qr-reader select option");
      selects.forEach((opt) => {
        if (opt.textContent?.includes("facing back")) {
          opt.textContent = opt.textContent.replace("facing back", "الكاميرا الخلفية");
        }
        if (opt.textContent?.includes("facing front")) {
          opt.textContent = opt.textContent.replace("facing front", "الكاميرا الأمامية");
        }
      });

      const spans = document.querySelectorAll("#qr-reader span");
      spans.forEach((span) => {
        if (span.textContent?.includes("Select Camera")) {
          span.textContent = "اختر الكاميرا";
        }
      });
    };

    // تشغيل دالة الترجمة كل نصف ثانية (لأن المكتبة تعيد رسم العناصر باستمرار)
    const translationInterval = setInterval(translateUI, 500);

    return () => {
      clearInterval(translationInterval);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in p-4 pb-20">
      <div className="w-full max-w-md card-surface p-6 text-center space-y-4">
        <h2 className="font-display text-xl font-extrabold text-primary">مسح تذكرة الحجز</h2>
        <p className="text-sm text-muted-foreground">
          قم بتوجيه الكاميرا نحو الـ QR Code الموجود في هاتف العميل لتأكيد حجزه واستلام الكاش.
        </p>

        {/* حاوية الماسح الضوئي - وضعنا عليها كلاسات لضبط المظهر العام للزراير ضمناً */}
        <div
          id="qr-reader"
          className="overflow-hidden rounded-2xl border-2 border-border/50 shadow-inner bg-black/5 [&_button]:mt-3 [&_button]:rounded-lg [&_button]:bg-primary/10 [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm [&_button]:font-bold [&_button]:text-primary [&_a]:mt-2 [&_a]:inline-block [&_a]:text-sm [&_a]:font-bold [&_a]:text-primary [&_select]:mt-2 [&_select]:max-w-xs [&_select]:rounded-lg [&_select]:border [&_select]:border-border [&_select]:bg-background [&_select]:p-2 [&_select]:text-sm"
          dir="ltr"
        />

        {loading && (
          <div className="flex items-center justify-center gap-2 text-warning font-bold mt-4">
            <Loader2 className="animate-spin size-5" /> جاري التحقق من الحجز...
          </div>
        )}

        {successMsg && !loading && (
          <div className="mt-4 p-5 bg-success/10 border border-success/20 rounded-xl text-success flex flex-col items-center gap-3 animate-in zoom-in">
            <CheckCircle2 className="size-10" />
            <span className="font-bold text-lg">{successMsg}</span>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
            >
              <RefreshCcw className="size-4" /> مسح تذكرة أخرى
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
