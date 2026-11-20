const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 4;

const CAIRO_TZ = "Africa/Cairo";

const cairoPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// يحوّل openTime زي "14:00" لرقم الساعة، ولو القيمة ناقصة أو غلط يرجع للافتراضي
const parseOpenHour = (openTime) => {
  const h = parseInt(String(openTime || "").split(":")[0], 10);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : DEFAULT_OPEN_HOUR;
};

// يحوّل closeTime زي "04:00" لرقم الساعة، ولو القيمة ناقصة أو غلط يرجع للافتراضي
// بنسمح بـ 24 لأن "24:00" صيغة مفهومة لنهاية اليوم (بنفس سلوك الكود القديم)
const parseCloseHour = (closeTime) => {
  const h = parseInt(String(closeTime || "").split(":")[0], 10);
  return Number.isInteger(h) && h >= 0 && h <= 24 ? h : DEFAULT_CLOSE_HOUR;
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (t) => {
  const m = TIME_RE.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// بيتأكد إن بداية المسائي واقعة بين ميعاد الفتح وميعاد الإغلاق
// (مع اعتبار إن الإغلاق ممكن يكون بعد منتصف الليل). بيرجّع رسالة الخطأ أو null لو سليم.
const validateVenueSchedule = (openTime, eveningStartTime, closeTime) => {
  const o = toMinutes(openTime);
  const e = toMinutes(eveningStartTime);
  const c = toMinutes(closeTime);
  if (o === null || e === null || c === null) {
    return "صيغة الوقت يجب أن تكون HH:MM";
  }
  const rel = (t) => (t - o + 1440) % 1440; // الدقائق من ميعاد الفتح
  const closeRel = rel(c) === 0 ? 1440 : rel(c); // فتح = إغلاق يعني 24 ساعة
  if (rel(e) >= closeRel) {
    return "بداية الفترة المسائية لازم تكون بين ميعاد الفتح وميعاد الإغلاق";
  }
  return null;
};

// حساب فارق التوقيت (بالملي ثانية) بين توقيت القاهرة وتوقيت UTC
const getCairoOffsetMs = (utcDate) => {
  const parts = {};
  for (const p of cairoPartsFormatter.formatToParts(utcDate)) {
    parts[p.type] = p.value;
  }
  const asUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtcMs - utcDate.getTime();
};

// تحويل تاريخ (YYYY-MM-DD) وساعة محددة بتوقيت القاهرة إلى كائن Date دقيق (يعمل بدقة على سيرفر UTC أو محلي)
const cairoWallTimeToUtcDate = (
  dateStr,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const guess1 = new Date(Date.UTC(y, m - 1, d, hour, minute, second, ms));
  const offset1 = getCairoOffsetMs(guess1);
  const adjusted1 = new Date(guess1.getTime() - offset1);
  // تمريرة ثانية للتأكد من الدقة في أيام تغيير التوقيت الصيفي/الشتوي
  const offset2 = getCairoOffsetMs(adjusted1);
  return new Date(guess1.getTime() - offset2);
};

// إرجاع تاريخ اليوم الحالي بصيغة YYYY-MM-DD بتوقيت القاهرة
const getTodayCairoDateString = (now = new Date()) => {
  const parts = {};
  for (const p of cairoPartsFormatter.formatToParts(now)) {
    parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// إرجاع بداية ونهاية اليوم التقويمي الكامل بتوقيت القاهرة (12:00 ص -> 11:59:59.999 م)
const getCairoCalendarDayRange = (dateStr) => {
  const cleanDate = dateStr
    ? String(dateStr).slice(0, 10)
    : getTodayCairoDateString();
  const startOfDay = cairoWallTimeToUtcDate(cleanDate, 0, 0, 0, 0);
  const endOfDay = cairoWallTimeToUtcDate(cleanDate, 23, 59, 59, 999);
  return { dateString: cleanDate, startOfDay, endOfDay };
};

module.exports = {
  DEFAULT_OPEN_HOUR,
  DEFAULT_CLOSE_HOUR,
  parseOpenHour,
  parseCloseHour,
  validateVenueSchedule,
  getCairoOffsetMs,
  cairoWallTimeToUtcDate,
  getTodayCairoDateString,
  getCairoCalendarDayRange,
};
