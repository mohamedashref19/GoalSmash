import { useEffect, useState } from "react";

function formatArabicDateTime(date: Date): string {
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];

  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "م" : "ص";
  h = h % 12;
  if (h === 0) h = 12;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");

  return `${dayName}، ${dayNum} ${monthName} - ${hh}:${mm} ${period}`;
}

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      dir="rtl"
      className="hidden items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums sm:inline-flex"
      suppressHydrationWarning
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {formatArabicDateTime(now)}
    </span>
  );
}
