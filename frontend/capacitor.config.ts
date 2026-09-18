import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.goalsmash.app",
  appName: "GoalSmash",
  webDir: ".output/public",
  server: {
    cleartext: true,
    androidScheme: "http",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000, // شاشة التحميل هتفضل ظاهرة 3 ثواني
      launchAutoHide: true,
      launchFadeOutDuration: 500, // تأثير اختفاء ناعم
      backgroundColor: "#3A5538", // درجة اللون الأخضر الغامق اللي في اللوجو
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP", // عشان الصورة تملأ الشاشة بشكل متناسق
    },
  },
};

export default config;
