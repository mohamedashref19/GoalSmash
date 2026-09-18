export type SportType = "بادل" | "خماسي";

export type Venue = {
  id: string;
  name: string;
  sport: SportType;
  location: string;
  pricePerHour: number;
  rating: number;
  description: string;
  amenities: string[];
  hue: string; // gradient seed for placeholder cover
};

export const MOCK_VENUES: Venue[] = [
  {
    id: "v1",
    name: "GoalSmash - بادل 1",
    sport: "بادل",
    location: "مدينة نصر، القاهرة",
    pricePerHour: 300,
    rating: 4.8,
    description:
      "ملعب بادل داخلي بأرضية زجاجية احترافية وإضاءة LED، مكيف بالكامل ومناسب للمباريات والتدريبات.",
    amenities: ["موقف سيارات", "غرف تغيير", "دش", "كافيتيريا", "واي فاي"],
    hue: "from-emerald-500 to-teal-600",
  },
  {
    id: "v2",
    name: "GoalSmash - خماسي A",
    sport: "خماسي",
    location: "مدينة نصر، القاهرة",
    pricePerHour: 500,
    rating: 4.6,
    description:
      "ملعب خماسي بعشب صناعي من الجيل الأحدث، مضاء ليلاً ومحاط بشباك حماية، مثالي لدوريات الشركات والأصدقاء.",
    amenities: ["موقف سيارات", "غرف تغيير", "دش", "كرات وليات"],
    hue: "from-teal-500 to-cyan-600",
  },
  {
    id: "v3",
    name: "بادل بوينت",
    sport: "بادل",
    location: "التجمع الخامس",
    pricePerHour: 350,
    rating: 4.9,
    description: "ثلاثة ملاعب بادل بمواصفات عالمية مع مدربين معتمدين ومتجر معدات داخل النادي.",
    amenities: ["موقف سيارات", "دش", "كافيتيريا", "مدربين"],
    hue: "from-green-500 to-emerald-600",
  },
  {
    id: "v4",
    name: "ستار أرينا",
    sport: "خماسي",
    location: "المعادي، القاهرة",
    pricePerHour: 450,
    rating: 4.4,
    description: "ملعب خماسي مفتوح بإطلالة مميزة، مناسب للحجوزات المسائية والبطولات المصغرة.",
    amenities: ["موقف سيارات", "غرف تغيير", "كافيتيريا"],
    hue: "from-emerald-600 to-green-700",
  },
  {
    id: "v5",
    name: "بادل هب 6 أكتوبر",
    sport: "بادل",
    location: "6 أكتوبر، الجيزة",
    pricePerHour: 280,
    rating: 4.5,
    description: "ملاعب بادل خارجية بأسعار اقتصادية وأجواء رائعة للمبتدئين والمحترفين.",
    amenities: ["موقف سيارات", "دش", "واي فاي"],
    hue: "from-teal-600 to-emerald-700",
  },
  {
    id: "v6",
    name: "جولدن جول",
    sport: "خماسي",
    location: "الشيخ زايد",
    pricePerHour: 550,
    rating: 4.7,
    description: "ملعب خماسي فاخر بعشب معتمد من الفيفا، مع شاشات عرض ومنطقة جلوس للمشجعين.",
    amenities: ["موقف سيارات", "غرف تغيير", "دش", "كافيتيريا", "كرات وليات"],
    hue: "from-cyan-600 to-teal-700",
  },
];

export type TimeSlot = { time: string; hour: number; booked: boolean };

// Mock availability: booked flags vary by day index so the UI feels real
export const getSlotsForDay = (dayIndex: number): TimeSlot[] => {
  const base = [
    { time: "10:00", hour: 10 },
    { time: "12:00", hour: 12 },
    { time: "14:00", hour: 14 },
    { time: "16:00", hour: 16 },
    { time: "18:00", hour: 18 },
    { time: "19:30", hour: 19.5 },
    { time: "21:00", hour: 21 },
    { time: "22:30", hour: 22.5 },
  ];
  return base.map((s, i) => ({ ...s, booked: (i + dayIndex) % 3 === 0 }));
};

export type BookingStatus = "مؤكد" | "قيد الانتظار" | "ملغي";

export type CustomerBooking = {
  id: string;
  venueName: string;
  sport: SportType;
  date: string;
  time: string;
  totalPaid: number;
  status: BookingStatus;
  upcoming: boolean;
};

export const MOCK_BOOKINGS: CustomerBooking[] = [
  {
    id: "bk1",
    venueName: "GoalSmash - بادل 1",
    sport: "بادل",
    date: "السبت، 30 أغسطس",
    time: "18:00 - 19:00",
    totalPaid: 300,
    status: "مؤكد",
    upcoming: true,
  },
  {
    id: "bk2",
    venueName: "بادل بوينت",
    sport: "بادل",
    date: "الاثنين، 1 سبتمبر",
    time: "19:30 - 20:30",
    totalPaid: 350,
    status: "قيد الانتظار",
    upcoming: true,
  },
  {
    id: "bk3",
    venueName: "GoalSmash - خماسي A",
    sport: "خماسي",
    date: "الأربعاء، 3 سبتمبر",
    time: "21:00 - 22:00",
    totalPaid: 500,
    status: "مؤكد",
    upcoming: true,
  },
  {
    id: "bk4",
    venueName: "ستار أرينا",
    sport: "خماسي",
    date: "الجمعة، 22 أغسطس",
    time: "20:00 - 21:00",
    totalPaid: 450,
    status: "مؤكد",
    upcoming: false,
  },
  {
    id: "bk5",
    venueName: "بادل هب 6 أكتوبر",
    sport: "بادل",
    date: "الأحد، 17 أغسطس",
    time: "18:00 - 19:00",
    totalPaid: 280,
    status: "ملغي",
    upcoming: false,
  },
  {
    id: "bk6",
    venueName: "جولدن جول",
    sport: "خماسي",
    date: "الخميس، 14 أغسطس",
    time: "22:30 - 23:30",
    totalPaid: 550,
    status: "مؤكد",
    upcoming: false,
  },
];
