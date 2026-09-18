import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";

const PORT = process.env.CAPACITOR_PRERENDER_PORT || "4790";
const outDir = path.resolve(process.cwd(), ".output/public");
const indexPath = path.resolve(outDir, "index.html");
const serverEntry = path.resolve(process.cwd(), ".output/server/index.mjs");

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastError = new Error(`Got status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await delay(300);
  }
  throw new Error(`Server never became ready at ${url}: ${lastError}`);
}

async function main() {
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Server entry not found at ${serverEntry}. شغّل الـ build الأول.`);
  }

  console.log("⏳ بشغّل سيرفر مؤقت لتوليد الـ shell...");
  const child = spawn("node", [serverEntry], {
    env: { ...process.env, PORT, NITRO_PORT: PORT },
    stdio: "inherit",
  });

  try {
    const res = await waitForServer(`http://127.0.0.1:${PORT}/`);
    const html = await res.text();

    const relativeHtml = html
      .replace(/(src|href)="\/(?!\/)/g, '$1="./')
      .replace(/(src|href)='\/(?!\/)/g, "$1='./");

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(indexPath, relativeHtml);
    console.log(`✅ index.html اتولّد في: ${indexPath}`);
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error("❌ فشل توليد الـ shell:", err);
  process.exit(1);
});
