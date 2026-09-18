import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "fs";
import path from "path";

export default defineConfig({
  tanstackStart: {
    ssr: false,
    server: { entry: "server" },
    prerender: {
      enabled: true,
      routes: ["/"], // prerender الصفحة الرئيسية بس كـ SPA shell
      crawlLinks: false, // منمنعش زحف لينكات routes محمية بتسجيل دخول
      concurrency: 1,
    },
  },
  plugins: [
    {
      name: "fix-capacitor-html-paths",
      closeBundle() {
        try {
          const outDir = path.resolve(process.cwd(), ".output/public");
          const indexPath = path.resolve(outDir, "index.html");

          if (!fs.existsSync(indexPath)) {
            console.warn(
              "⚠️ index.html لسه مش موجود — تأكد إن prerender.enabled = true اتفعّل صح.",
            );
            return;
          }

          let html = fs.readFileSync(indexPath, "utf-8");
          html = html
            .replace(/(src|href)="\/(?!\/)/g, '$1="./')
            .replace(/(src|href)='\/(?!\/)/g, "$1='./");

          fs.writeFileSync(indexPath, html);
          console.log("✅ index.html اتولّد صح واتحولت مساراته لنسبية.");
        } catch (e) {
          console.error("Error patching index.html:", e);
        }
      },
    },
  ],
});
