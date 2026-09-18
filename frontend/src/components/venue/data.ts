export type BookingKind = "app" | "manual" | "maintenance";

export type ScheduleBooking = {
  id: string;
  court: string;
  start: number; // hour
  duration: number; // hours
  title: string;
  kind: BookingKind;
  amount?: number;
};

export const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export const COURTS = ["بادل 1", "بادل 2", "ملعب خماسي A", "ملعب خماسي B"];

export const KIND_LABEL: Record<BookingKind, string> = {
  app: "حجز التطبيق",
  manual: "حجز يدوي",
  maintenance: "صيانة",
};

export const initialBookings: ScheduleBooking[] = [
  {
    id: "b1",
    court: "بادل 1",
    start: 10,
    duration: 2,
    title: "أحمد سمير",
    kind: "app",
    amount: 600,
  },
  {
    id: "b2",
    court: "بادل 1",
    start: 18,
    duration: 2,
    title: "فريق النسر",
    kind: "manual",
    amount: 1000,
  },
  { id: "b3", court: "بادل 2", start: 12, duration: 1, title: "صيانة أرضية", kind: "maintenance" },
  {
    id: "b4",
    court: "بادل 2",
    start: 19,
    duration: 2,
    title: "منى خالد",
    kind: "app",
    amount: 1000,
  },
  {
    id: "b5",
    court: "ملعب خماسي A",
    start: 14,
    duration: 1,
    title: "فريق الصقور",
    kind: "manual",
    amount: 300,
  },
  {
    id: "b6",
    court: "ملعب خماسي A",
    start: 20,
    duration: 2,
    title: "دوري الشركات",
    kind: "app",
    amount: 1000,
  },
  {
    id: "b7",
    court: "ملعب خماسي B",
    start: 16,
    duration: 2,
    title: "أكاديمية الأمل",
    kind: "app",
    amount: 700,
  },
  {
    id: "b8",
    court: "ملعب خماسي B",
    start: 21,
    duration: 1,
    title: "صيانة إضاءة",
    kind: "maintenance",
  },
];

export type Match = {
  id: string;
  client: string;
  sport: "بادل" | "خماسي";
  court: string;
  date: string;
  time: string;
  status: "مؤكد" | "بانتظار الدفع" | "ملغي";
  amount: number;
};

export const upcomingMatches: Match[] = [
  {
    id: "m1",
    client: "فريق النسر",
    sport: "خماسي",
    court: "ملعب خماسي A",
    date: "21 أغسطس",
    time: "18:00",
    status: "مؤكد",
    amount: 500,
  },
  {
    id: "m2",
    client: "أحمد سمير",
    sport: "بادل",
    court: "بادل 1",
    date: "21 أغسطس",
    time: "19:30",
    status: "بانتظار الدفع",
    amount: 300,
  },
  {
    id: "m3",
    client: "منى خالد",
    sport: "بادل",
    court: "بادل 2",
    date: "22 أغسطس",
    time: "17:00",
    status: "مؤكد",
    amount: 350,
  },
  {
    id: "m4",
    client: "أكاديمية الأمل",
    sport: "خماسي",
    court: "ملعب خماسي B",
    date: "22 أغسطس",
    time: "20:00",
    status: "مؤكد",
    amount: 700,
  },
  {
    id: "m5",
    client: "دوري الشركات",
    sport: "خماسي",
    court: "ملعب خماسي A",
    date: "23 أغسطس",
    time: "21:00",
    status: "ملغي",
    amount: 500,
  },
];

export const weeklyRevenue = [
  { day: "السبت", revenue: 5200 },
  { day: "الأحد", revenue: 4300 },
  { day: "الاثنين", revenue: 3800 },
  { day: "الثلاثاء", revenue: 6100 },
  { day: "الأربعاء", revenue: 5600 },
  { day: "الخميس", revenue: 8200 },
  { day: "الجمعة", revenue: 9400 },
];

export const sportsRevenue = [
  { name: "البادل", value: 24500 },
  { name: "الخماسي", value: 18300 },
];

export const topCustomers = [
  { id: "c1", name: "أحمد سمير", bookings: 42, initials: "أس" },
  { id: "c2", name: "منى خالد", bookings: 37, initials: "مخ" },
  { id: "c3", name: "فريق النسر", bookings: 29, initials: "فن" },
  { id: "c4", name: "كريم عادل", bookings: 24, initials: "كع" },
  { id: "c5", name: "أكاديمية الأمل", bookings: 18, initials: "أأ" },
];
