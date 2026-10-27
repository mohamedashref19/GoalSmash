import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Camera,
  CameraOff,
  ImagePlus,
  SwitchCamera,
} from "lucide-react";
// @ts-expect-error: API lacks TypeScript definitions
import apiClient from "@/api/axiosConfig";

interface CameraDevice {
  id: string;
  label: string;
}

export function ScannerView() {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const isProcessing = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // دالة تعريب اسم الكاميرا
  const formatCameraLabel = (label: string, index: number) => {
    const lower = label.toLowerCase();
    if (lower.includes("back") || lower.includes("rear") || lower.includes("environment")) {
      return `الكاميرا الخلفية (${index + 1})`;
    }
    if (lower.includes("front") || lower.includes("user")) {
      return `الكاميرا الأمامية (${index + 1})`;
    }
    return label || `كاميرا ${index + 1}`;
  };

  // جلب الكاميرات وتحديد الكاميرا الخلفية كافتراضي
  const loadCameras = async () => {
    try {
      setPermissionError(null);
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);

        // البحث عن الكاميرا الخلفية لتكون هي الـ Default
        const backCam = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment"),
        );

        const defaultCamera = backCam ?? devices[devices.length - 1];
        if (defaultCamera) {
          setSelectedCameraId(defaultCamera.id);
        }
      } else {
        setPermissionError("مفيش كاميرا متوصلة بالجهاز ده");
      }
    } catch (err) {
      console.error("Camera permission error:", err);
      setPermissionError("اسمح للتطبيق بفتح الكاميرا عشان تقدر تعمل Scan للكود");
    }
  };

  useEffect(() => {
    html5QrCodeRef.current = new Html5Qrcode("qr-reader");
    loadCameras();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current
          .stop()
          .then(() => html5QrCodeRef.current?.clear())
          .catch(console.error);
      }
    };
  }, []);

  // إيقاف الكاميرا
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.debug("خطأ أثناء إيقاف الكاميرا:", err);
      }
    }
    setIsScanning(false);
  };

  // معالجة الكود المقروء وإرساله للباك إند
  const handleDecodedText = async (decodedText: string) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    setLoading(true);
    setSuccessMsg(null);

    // إغلاق الكاميرا فوراً بمجرد قراءة الكود
    await stopScanner();

    try {
      const response = await apiClient.post("/bookings/confirm-qr", {
        bookingId: decodedText,
      });

      toast.success(response.data.message || "تمام! الحجز اتأكد بنجاح");
      setSuccessMsg("تمام! الحجز اتأكد واستلمت باقي المبلغ كاش بنجاح");
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError.response?.data?.message || "حصلت مشكلة في قراءة الكود أو الحجز ده مش موجود",
      );
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  };

  // بدء المسح بالكاميرا
  const startScanner = async (cameraIdToUse?: string) => {
    if (!html5QrCodeRef.current) return;
    setSuccessMsg(null);
    setPermissionError(null);

    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const targetCamera = cameraIdToUse || selectedCameraId;

      // إذا كان لدينا ID الكاميرا الخلفية نستخدمه، وإلا نطلب الكاميرا الخلفية مباشرة عبر facingMode: "environment"
      const cameraConfig = targetCamera ? targetCamera : { facingMode: "environment" };

      await html5QrCodeRef.current.start(
        cameraConfig,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // تجاهل أخطاء الإطارات الفارغة أثناء البحث عن QR
        },
      );

      setIsScanning(true);

      if (cameras.length === 0) {
        loadCameras();
      }
    } catch (err) {
      console.error("Failed to start scanner:", err);
      toast.error("مش قادرين نفتح الكاميرا، اتأكد إنك مدي صلاحية الكاميرا للتطبيق أو المتصفح");
      setIsScanning(false);
    }
  };

  // تغيير الكاميرا من القائمة المنسدلة
  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    if (isScanning) {
      await startScanner(newCameraId);
    }
  };

  // مسح كود من صورة مرفوعة من المعرض
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !html5QrCodeRef.current) return;

    try {
      setLoading(true);
      setSuccessMsg(null);

      if (html5QrCodeRef.current.isScanning) {
        await stopScanner();
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      await handleDecodedText(decodedText);
    } catch (err) {
      console.error("Image scan error:", err);
      toast.error("مش لاقيين كود QR واضح في الصورة دي، جرب صورة أوضح");
      setLoading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in p-4 pb-20" dir="rtl">
      <div className="w-full max-w-md card-surface p-6 text-center space-y-5">
        <div>
          <h2 className="font-display text-xl font-extrabold text-primary">مسح تذكرة الحجز</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            وجّه الكاميرا على كود الحجز (QR) اللي في موبايل العميل عشان تأكد حجزه وتستلم باقي الكاش.
          </p>
        </div>

        {/* شاشة الكاميرا */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-border/60 bg-black/5 min-h-[240px] flex flex-col items-center justify-center">
          <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />

          {!isScanning && !loading && !successMsg && (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
              <div className="rounded-full bg-primary/10 p-4 text-primary">
                <Camera className="size-10" />
              </div>
              <p className="text-xs font-bold">
                {permissionError || "الكاميرا مقفولة حالياً، دوس على (افتح الكاميرا وابدأ Scan)"}
              </p>
            </div>
          )}
        </div>

        {/* عناصر التحكم */}
        {!successMsg && (
          <div className="space-y-3 pt-1">
            {/* قائمة اختيار الكاميرا */}
            {cameras.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <SwitchCamera className="size-4 shrink-0 text-primary" />
                <span className="text-xs font-bold text-muted-foreground shrink-0">
                  نوع الكاميرا:
                </span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="w-full cursor-pointer bg-transparent text-xs font-bold text-foreground outline-none"
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {formatCameraLabel(cam.label, idx)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* زر تشغيل / إيقاف الكاميرا */}
            <div className="flex gap-2">
              {!isScanning ? (
                <button
                  type="button"
                  onClick={() => startScanner()}
                  disabled={loading}
                  className="gradient-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
                >
                  <Camera className="size-4" /> افتح الكاميرا وابدأ Scan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-destructive/90"
                >
                  <CameraOff className="size-4" /> اقفل الكاميرا
                </button>
              )}
            </div>

            {/* زر رفع صورة من الجهاز */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                <ImagePlus className="size-4 text-primary" /> أو اختار صورة التذكرة من الموبايل
              </button>
            </div>
          </div>
        )}

        {/* حالة التحميل */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-warning font-bold mt-4">
            <Loader2 className="animate-spin size-5" /> ثواني بنراجع بيانات الحجز...
          </div>
        )}

        {/* رسالة النجاح بعد التأكيد وإغلاق الكاميرا */}
        {successMsg && !loading && (
          <div className="mt-4 p-5 bg-success/10 border border-success/20 rounded-xl text-success flex flex-col items-center gap-3 animate-in zoom-in">
            <CheckCircle2 className="size-10" />
            <span className="font-bold text-base">{successMsg}</span>
            <button
              type="button"
              onClick={() => {
                setSuccessMsg(null);
                startScanner();
              }}
              className="mt-2 flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
            >
              <RefreshCcw className="size-4" /> مسح تذكرة تانية
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
