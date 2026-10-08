import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tigihagz.app",
  appName: "Tigi Hagz",
  webDir: ".output/public",
  // إنتاج: HTTPS فقط. cleartext + scheme "http" كانوا للتطوير على الشبكة المحلية،
  // وبيسمحوا بنقل التوكن بدون تشفير. ملحوظة: تغيير الـ scheme بيغيّر origin الـ WebView
  // (https://localhost) فالمستخدمين الحاليين هيسجلوا دخول مرة واحدة.
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000, // شاشة التحميل هتفضل ظاهرة 3 ثواني
      launchAutoHide: true,
      launchFadeOutDuration: 500, // تأثير اختفاء ناعم
      backgroundColor: "#0ad92d", // درجة اللون الأخضر الغامق اللي في اللوجو
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP", // عشان الصورة تملأ الشاشة بشكل متناسق
    },
  },
};

export default config;
