import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";
import axios from "axios";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
// @ts-expect-error axiosConfig is a JavaScript module without TypeScript declarations.
import { BACKEND_URL } from "../api/axiosConfig";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// تعديل نوع الـ error هنا ليتوافق مع TanStack Router
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    // التأكد من أن الخطأ من نوع Error قبل إرساله للتبليغ
    const errorObj = error instanceof Error ? error : new Error(String(error));
    reportLovableError(errorObj, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "لوحة إدارة الملاعب الرياضية" },
      {
        name: "description",
        content:
          "نظام إدارة ملاعب البادل والخماسي: الحجوزات، الجدول اليومي، الإيرادات والتسعير الذكي.",
      },
      { property: "og:title", content: "لوحة إدارة الملاعب الرياضية" },
      {
        property: "og:description",
        content:
          "نظام إدارة ملاعب البادل والخماسي: الحجوزات، الجدول اليومي، الإيرادات والتسعير الذكي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@500;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // حالة للتحكم في ظهور المودال وبيانات التحديث
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updateData, setUpdateData] = useState<any>(null);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        let currentVersionCode = 1;

        // +++ تم إزالة التكرار الخاطئ من هنا +++
        if (Capacitor.isNativePlatform()) {
          const appInfo = await App.getInfo();
          currentVersionCode = parseInt(appInfo.build || "1", 10);
        }

        const response = await axios.get(`${BACKEND_URL}/version.json`);
        const data = response.data;

        const skippedVersion = parseInt(localStorage.getItem("skippedUpdateVersion") || "0", 10);

        if (data.versionCode > currentVersionCode) {
          if (data.forceUpdate || data.versionCode > skippedVersion) {
            setUpdateData(data);
          }
        }
      } catch (error) {
        console.error("فشل التحقق من التحديثات:", error);
      }
    };

    checkForUpdates();
  }, []);

  // دالة زر "تحديث الآن"
  const handleUpdateNow = () => {
    if (updateData) {
      window.location.href = updateData.downloadUrl;
      // إخفاء المودال إذا لم يكن التحديث إجبارياً تحسباً لرجوع المستخدم للتطبيق
      if (!updateData.forceUpdate) setUpdateData(null);
    }
  };

  // دالة زر "تحديث لاحقاً" (إلغاء)
  const handleSkipUpdate = () => {
    if (updateData && !updateData.forceUpdate) {
      // حفظ رقم الإصدار في الهاتف حتى لا يزعج المستخدم مرة أخرى بنفس الإصدار
      localStorage.setItem("skippedUpdateVersion", updateData.versionCode.toString());
      setUpdateData(null);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      {/* نافذة التحديث الاحترافية (Modal) تظهر فقط عند وجود بيانات تحديث */}
      {updateData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-background p-6 shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl">🚀</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {updateData.forceUpdate ? "تحديث ضروري مطلوب!" : "يوجد تحديث جديد!"}
              </h2>
            </div>

            {/* عرض محتوى رسالة التحديث مع دعم أكواد الـ HTML (مثل الخط العريض والنزول لسطر) */}
            <div
              className="mt-5 text-sm leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(updateData.releaseNotes) }}
            />

            <div className="mt-8 flex gap-3">
              <button
                onClick={handleUpdateNow}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
              >
                تحديث الآن
              </button>

              {/* إخفاء زر التخطي تماماً إذا كان التحديث إجبارياً */}
              {!updateData.forceUpdate && (
                <button
                  onClick={handleSkipUpdate}
                  className="flex-1 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
                >
                  تحديث لاحقاً
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
