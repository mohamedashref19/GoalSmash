export const calculateHours = (open: string, close: string) => {
  if (!open || !close) return 24;
  const [openHr] = open.split(":").map(Number);
  const [closeHr] = close.split(":").map(Number);
  let hours = (closeHr ?? 0) - (openHr ?? 0);
  if (hours <= 0) hours += 24;
  return hours;
};

export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

// نفس قاعدة الباك إند: بداية المسائي لازم تقع بين ميعاد الفتح وميعاد الإغلاق
export const getScheduleError = (open: string, evening: string, close: string): string | null => {
  const o = timeToMinutes(open);
  const e = timeToMinutes(evening);
  const c = timeToMinutes(close);
  if (o === null || e === null || c === null) return "يرجى إدخال مواعيد صحيحة";
  const rel = (t: number) => (t - o + 1440) % 1440;
  const closeRel = rel(c) === 0 ? 1440 : rel(c);
  return rel(e) >= closeRel
    ? "بداية الفترة المسائية لازم تكون بين ميعاد الفتح وميعاد الإغلاق"
    : null;
};

// الصباحي: من الفتح لبداية المسائي — المسائي: من بداية المسائي للإغلاق
export const scheduleSummary = (open: string, evening: string, close: string) =>
  open === evening
    ? `مسائي ${evening} – ${close}`
    : `صباحي ${open} – ${evening} · مسائي ${evening} – ${close}`;

// أيام الأسبوع للواجهة
export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
