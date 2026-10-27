const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 4;

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

module.exports = {
  DEFAULT_OPEN_HOUR,
  DEFAULT_CLOSE_HOUR,
  parseOpenHour,
  parseCloseHour,
  validateVenueSchedule,
};
