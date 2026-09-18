import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Star,
  Clock,
  AlertCircle,
  X,
  Home,
  CalendarDays,
  Sparkles,
  Trophy,
  Users,
  Target,
  ChevronRight,
  ChevronLeft,
  ShoppingBag, // +++ أيقونة المتجر +++
  Dumbbell, // +++ أيقونة الجيم والمكملات +++
} from "lucide-react";
import { Header } from "@/components/venue/Header";
import { cn } from "@/lib/utils";
// @ts-expect-error - venueApi module type definitions not available
import { fetchAllVenues } from "@/api/venueApi";

interface CourtType {
  _id: string;
  sportType: string;
  pricePerHour: number;
}

interface VenueType {
  _id: string;
  name: string;
  address?: {
    city: string;
    area: string;
  };
  courts?: CourtType[];
  image?: string;
}

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [{ title: "تصفح الملاعب | GoalSmash" }],
  }),
  component: ExplorePage,
});

// +++ مكون القائمة الجانبية المخصص للعميل +++
function CustomerMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")}>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-card p-5 shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-primary">GoalSmash</span>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            to="/explore"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
          >
            <Home className="h-5 w-5" /> الرئيسية
          </Link>
          <Link
            to="/my-bookings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-muted"
          >
            <CalendarDays className="h-5 w-5" /> حجوزاتي
          </Link>
        </nav>
      </div>
    </div>
  );
}
// +++++++++++++++++++++++++++++++++++++++++

// =========================================
// +++ مكون الـ Slider الجديد (العروض التشويقية) +++
// =========================================
function PromoSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const slides = [
    {
      id: 1,
      title: "دوريات وبطولات",
      subtitle: "GoalSmash",
      badge: "قريباً 🚀",
      bg: "bg-slate-900",
      accent: "text-warning",
      Icon: Trophy,
    },
    {
      id: 2,
      title: "كمّل فريقك",
      subtitle: "ميزة الماتشات",
      badge: "قريباً 🚀",
      bg: "bg-emerald-950",
      accent: "text-emerald-400",
      Icon: Users,
    },
    {
      id: 3,
      title: "أكاديميات وتدريب",
      subtitle: "أفضل المدربين",
      badge: "قريباً 🚀",
      bg: "bg-indigo-950",
      accent: "text-indigo-400",
      Icon: Target,
    },
    // +++ تم إضافة خانة المتجر والتشيرتات +++
    {
      id: 4,
      title: "متجر رياضي",
      subtitle: "GoalSmash بأسعار مخفضة",
      badge: "قريباً 🚀",
      bg: "bg-rose-950",
      accent: "text-rose-400",
      Icon: ShoppingBag,
    },
    // +++ تم إضافة خانة الجيم والمكملات +++
    {
      id: 5,
      title: "جيم ومكملات",
      subtitle: "كل احتياجاتك الرياضية",
      badge: "قريباً 🚀",
      bg: "bg-amber-950",
      accent: "text-amber-400",
      Icon: Dumbbell,
    },
  ];

  // تشغيل تلقائي كل 5 ثواني
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isHovered]);

  const nextSlide = () => setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  const prevSlide = () => setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));

  // منطق سحب الشاشة (التاتش) مع حماية ضد undefined
  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.targetTouches[0]?.clientX || 0);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEndX(e.targetTouches[0]?.clientX || 0);
  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    if (distance > 50) prevSlide(); // سحب لليسار
    if (distance < -50) nextSlide(); // سحب لليمين
    setTouchStartX(0);
    setTouchEndX(0);
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl group mb-8 shadow-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out w-full"
        style={{ transform: `translateX(${currentIndex * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className={cn(
              "w-full flex-shrink-0 relative h-48 sm:h-56 flex items-center p-5 sm:p-8 overflow-hidden",
              slide.bg,
            )}
          >
            {/* تأثير الإضاءة في الخلفية */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent" />

            {/* الـ Badge */}
            <div className="absolute bottom-0 right-0 bg-warning text-black px-4 py-1.5 sm:px-6 sm:py-2 rounded-tl-2xl font-bold text-xs sm:text-sm z-20 shadow-md">
              {slide.badge}
            </div>

            <div className="relative z-10 flex flex-1 items-center justify-between">
              {/* النصوص */}
              <div className="flex flex-col items-start gap-1 sm:gap-2">
                <h2 className="text-4xl sm:text-5xl font-black text-white">{slide.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl text-white font-bold">من</span>
                  <span className={cn("text-2xl sm:text-3xl font-black", slide.accent)}>
                    {slide.subtitle}
                  </span>
                </div>
              </div>

              {/* اللوجو / الأيقونة */}
              <div className="ml-2 sm:ml-8 w-24 h-24 sm:w-32 sm:h-32 bg-black/40 rounded-full border-4 border-slate-800 flex items-center justify-center shadow-xl">
                <slide.Icon className={cn("w-12 h-12 sm:w-16 sm:h-16", slide.accent)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* أزرار التحكم (تظهر عند تمرير الماوس) */}
      <button
        onClick={nextSlide}
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-2 sm:p-3 rounded-full backdrop-blur opacity-0 group-hover:opacity-100 transition duration-300 z-30"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <button
        onClick={prevSlide}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/30 text-white p-2 sm:p-3 rounded-full backdrop-blur opacity-0 group-hover:opacity-100 transition duration-300 z-30"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* المؤشرات (Dots) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "h-1.5 sm:h-2 rounded-full transition-all duration-300 shadow-sm",
              currentIndex === idx ? "w-6 sm:w-8 bg-warning" : "w-1.5 sm:w-2 bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
// =========================================

function ExplorePage() {
  const [venues, setVenues] = useState<VenueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const getVenues = async () => {
      try {
        setLoading(true);
        const data = await fetchAllVenues();
        setVenues(data);
      } catch (err) {
        setError(err as string);
      } finally {
        setLoading(false);
      }
    };
    getVenues();
  }, []);

  // 1. استخراج المناطق المتاحة من الداتا بيز بدون تكرار
  const uniqueAreas = Array.from(
    new Set(venues.map((venue) => venue.address?.area).filter(Boolean)),
  ) as string[];

  // 2. فلترة الملاعب
  const filteredVenues = venues.filter((venue) => {
    // لو مفيش منطقة متحددة (searchQuery فاضي) هات الكل، غير كده طابق المنطقة
    const matchesSearch = searchQuery === "" || venue.address?.area === searchQuery;

    let matchesFilter = true;
    if (activeFilter !== "all" && venue.courts && venue.courts.length > 0) {
      matchesFilter = venue.courts.some((court: CourtType) => court.sportType === activeFilter);
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground overflow-x-hidden">
      <CustomerMobileMenu open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <Header title="استكشف الملاعب" onMenu={() => setIsMobileMenuOpen(true)} />

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 lg:p-8">
        <PromoSlider />

        <div className="sticky top-[68px] z-20 -mx-4 mb-6 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="relative mb-4">
            <MapPin className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border border-input bg-card pr-11 pl-4 shadow-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-ring/40"
            >
              <option value="">كل المناطق في الإسكندرية</option>
              {/* عرض المناطق المستخرجة من الباك إند تلقائياً */}
              {uniqueAreas.map((area, index) => (
                <option key={index} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: "all", label: "الكل" },
              { id: "padel", label: "بادل" },
              { id: "football", label: "خماسي" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                  activeFilter === filter.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Clock className="h-8 w-8 animate-spin" />
            <p className="mt-4 font-semibold">جارٍ تحميل الملاعب...</p>
          </div>
        )}

        {error && !loading && (
          <div className="grid place-items-center py-20 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p className="mt-4 font-semibold">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {filteredVenues.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
                <Search className="h-10 w-10 opacity-20" />
                <p className="mt-4 font-semibold">لا توجد ملاعب مطابقة لبحثك</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("all");
                  }}
                  className="mt-2 text-primary hover:underline"
                >
                  إلغاء الفلاتر
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVenues.map((venue) => (
                  <div
                    key={venue._id}
                    className="card-surface group flex flex-col overflow-hidden transition-all hover:shadow-md"
                  >
                    <div className="relative h-48 w-full bg-muted overflow-hidden">
                      {venue.image ? (
                        <img
                          src={venue.image ? venue.image.replace("127.0.0.1", "192.168.1.4") : ""}
                          alt={venue.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-emerald-900/60 mix-blend-multiply" />
                      )}

                      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-xs font-bold backdrop-blur">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        4.8
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-lg font-extrabold">{venue.name}</h3>

                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {venue.address?.city}، {venue.address?.area}
                        </span>
                      </div>

                      <div className="mt-4 mt-auto flex items-end justify-between border-t pt-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">يبدأ من</p>
                          <p className="font-display text-lg font-bold text-primary">
                            {venue.courts && venue.courts.length > 0
                              ? `${Math.min(...venue.courts.map((court) => court.pricePerHour))} ج`
                              : "--- ج"}
                            <span className="text-sm font-normal text-muted-foreground">
                              {" "}
                              / ساعة
                            </span>
                          </p>
                        </div>
                        <Link
                          to="/venue/$id"
                          params={{ id: venue._id }}
                          className="rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          احجز الآن
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
