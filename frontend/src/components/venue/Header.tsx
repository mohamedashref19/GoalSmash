import { useEffect, useState } from "react";
import { Menu, Bell, LogIn, LogOut, CalendarDays, CheckCheck, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LiveClock } from "@/components/venue/LiveClock";
// @ts-expect-error authApi is untyped module
import { logoutUser } from "@/api/authApi";
// @ts-expect-error apiClient is untyped
import apiClient from "@/api/axiosConfig";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { cn } from "@/lib/utils";
// @ts-expect-error BACKEND_URL is untyped
import { BACKEND_URL } from "@/api/axiosConfig";
interface UserData {
  id?: string;
  _id?: string;
  name: string;
  role?: string;
  [key: string]: unknown;
}

interface NotificationItem {
  _id?: string;
  title: string;
  message: string;
  isRead?: boolean;
  createdAt?: string;
}

export function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    let socket: Socket | null = null;

    const userData = localStorage.getItem("userData") || sessionStorage.getItem("userData");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        const userId = parsedUser._id || parsedUser.id;

        // 1. جلب الإشعارات القديمة من الداتا بيز
        const fetchOldNotifications = async () => {
          try {
            setLoadingNotifs(true);
            const res = await apiClient.get("/notifications"); // طلب الإشعارات من الباك إند
            setNotifications(res.data?.data?.notifications || []);

            // لو الباك إند رجع إن فيه إشعارات مش مقروءة، ننوّر الجرس
            if (res.data?.unreadCount > 0) {
              setHasNewNotification(true);
            }
          } catch (err) {
            console.error("لم يتم العثور على مسار الإشعارات في الباك إند أو حدث خطأ:", err);
          } finally {
            setLoadingNotifs(false);
          }
        };

        if (userId) {
          fetchOldNotifications();
        }

        // 2. الاتصال بالسوكيت للإشعارات اللحظية الجديدة
        socket = io(BACKEND_URL);
        if (userId) {
          socket.on(`notification-${userId}`, (notification: NotificationItem) => {
            toast.success(notification.title, {
              description: notification.message,
              duration: 6000,
            });
            // إضافة الإشعار الجديد في أول القائمة
            setNotifications((prev) => [notification, ...prev]);
            setHasNewNotification(true);
          });
        }
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // دالة فتح القائمة وتحديد الإشعارات كمقروءة
  const handleToggleNotifications = async () => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);

    // لو فتحنا القائمة والجرس منوّر، نطفي الجرس ونكلم الباك إند
    if (willOpen && hasNewNotification) {
      setHasNewNotification(false);
      try {
        await apiClient.patch("/notifications/read-all"); // نبلغ الباك إند إننا قريناهم
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("خطأ في تحديث حالة الإشعارات", err);
      }
    }
  };

  const homeLink = user?.role === "customer" ? "/explore" : "/";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={onMenu}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <Link
              to={homeLink}
              className="block max-w-[110px] truncate font-display text-sm font-extrabold transition-colors hover:text-primary sm:max-w-none sm:text-xl"
              title={title}
            >
              {title}
            </Link>
            {user && (
              <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span>مرحبًا {user.name.split(" ")[0]}، استمتع بوقتك!</span>
              </p>
            )}
          </div>
          <div className="hidden sm:block">
            <LiveClock />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {user?.role === "customer" && (
            <Link
              to="/my-bookings"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-2 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-white sm:gap-1.5 sm:px-3.5 sm:text-sm"
            >
              <CalendarDays className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" />
              حجوزاتي
            </Link>
          )}

          <div className="relative">
            <button
              onClick={handleToggleNotifications}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted sm:h-10 sm:w-10"
            >
              <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              {hasNewNotification && (
                <span className="absolute left-2.5 top-2 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="fixed left-1/2 top-[60px] w-[90vw] max-w-[320px] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-xl sm:absolute sm:left-0 sm:top-full sm:mt-3 sm:w-80 sm:-translate-x-0 z-50">
                <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-bold text-foreground">الإشعارات</h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => setNotifications([])}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> مسح الكل
                    </button>
                  )}
                </div>

                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto scrollbar-hide">
                  {loadingNotifs ? (
                    <div className="py-8 flex flex-col items-center justify-center text-sm font-bold text-muted-foreground">
                      <Clock className="h-6 w-6 animate-spin text-primary mb-2" />
                      جارٍ التحميل...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm font-bold text-muted-foreground">
                      لا توجد إشعارات حالياً
                    </div>
                  ) : (
                    notifications.map((notif, idx) => (
                      <div
                        key={notif._id || idx}
                        className={cn(
                          "flex flex-col gap-1 rounded-xl p-3 transition hover:bg-muted/80",
                          notif.isRead === false
                            ? "bg-primary/5 border border-primary/10"
                            : "bg-muted/30",
                        )}
                      >
                        <span className="text-sm font-bold text-foreground">{notif.title}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {notif.message}
                        </span>
                        {notif.createdAt && (
                          <span className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(notif.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link
                to="/profile"
                className="gradient-primary grid h-9 w-9 place-items-center rounded-xl text-xs font-bold text-primary-foreground hover:opacity-90 sm:h-10 sm:w-10 sm:text-sm"
              >
                {user.name.substring(0, 2).toUpperCase()}
              </Link>
              <button
                onClick={logoutUser}
                title="تسجيل الخروج"
                className="grid h-9 w-9 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white sm:h-10 sm:w-10"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted sm:flex"
            >
              <LogIn className="h-[18px] w-[18px]" />
              دخول
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
