import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    ssr: false,
    server: { entry: "server" },
    prerender: {
      enabled: false, // بنعمله يدويًا بدل الـ prerender المكسور
    },
  },
});
