import {
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSetupState } from "./useAdminSetup";

export function RequestsTab({ s }: { s: AdminSetupState }) {
  const { venueRequestsList, handleUpdateVenueRequestStatus, handleDeleteVenueRequest, loading } =
    s;

  if (loading && venueRequestsList.length === 0) {
    return (
      <div className="py-12 text-center text-sm font-bold text-muted-foreground">
        جاري تحميل طلبات إضافة الملاعب...
      </div>
    );
  }

  if (venueRequestsList.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
        <Building2 className="size-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm font-bold">لا توجد طلبات أو ترشيحات لإضافة ملاعب حالياً</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-2">
      {venueRequestsList.map((req) => {
        const isOwnerRequest = req.requesterRole === "owner";
        const contactPhone = req.venuePhone || req.submitterPhone || "";
        const cleanWaPhone = contactPhone.replace(/\D/g, "").replace(/^0/, "20");

        return (
          <div
            key={req._id}
            className={cn(
              "rounded-2xl border p-4 flex flex-col justify-between gap-4 transition",
              req.status === "pending"
                ? "border-primary/40 bg-card shadow-sm"
                : "border-border bg-surface/60 opacity-85",
            )}
          >
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                    isOwnerRequest
                      ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {isOwnerRequest ? (
                    <>
                      <UserCheck className="size-3.5" /> صاحب / مسؤول الملعب
                    </>
                  ) : (
                    <>
                      <Users className="size-3.5" /> ترشيح من لاعب
                    </>
                  )}
                </span>

                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-[10px] font-extrabold",
                    req.status === "added"
                      ? "bg-success/15 text-success"
                      : req.status === "contacted"
                        ? "bg-info/15 text-info"
                        : "bg-warning/15 text-warning",
                  )}
                >
                  {req.status === "added"
                    ? "تمت الإضافة"
                    : req.status === "contacted"
                      ? "تم التواصل"
                      : "طلب جديد"}
                </span>
              </div>

              <h3 className="font-display text-base font-extrabold text-foreground flex items-center gap-1.5">
                <Building2 className="size-4 text-primary shrink-0" />
                {req.venueName}
              </h3>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary shrink-0" /> المنطقة:{" "}
                  <span className="font-bold text-foreground">{req.area}</span>
                </p>

                {req.venuePhone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary shrink-0" /> تليفون الملعب:{" "}
                    <a
                      href={`tel:${req.venuePhone}`}
                      dir="ltr"
                      className="font-bold text-primary hover:underline"
                    >
                      {req.venuePhone}
                    </a>
                  </p>
                )}

                <p className="flex items-center gap-1.5">
                  <Users className="size-3.5 shrink-0" /> مرسل الطلب:{" "}
                  <span className="font-bold text-foreground">{req.submitterName}</span>{" "}
                  {req.submitterPhone && (
                    <span dir="ltr" className="text-[11px]">
                      ({req.submitterPhone})
                    </span>
                  )}
                </p>

                <p className="flex items-center gap-1.5 text-[11px]">
                  <Clock className="size-3 shrink-0" />{" "}
                  {new Date(req.createdAt).toLocaleDateString("ar-EG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              {req.notes && (
                <p className="rounded-xl bg-muted/60 p-2.5 text-xs font-medium text-foreground border border-border/60">
                  {req.notes}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5">
                {contactPhone && (
                  <a
                    href={`https://wa.me/${cleanWaPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/15 px-2.5 py-1.5 text-[11px] font-bold text-[#25D366] hover:bg-[#25D366]/25 transition"
                  >
                    <MessageCircle className="size-3.5" /> واتساب
                  </a>
                )}

                {req.status !== "contacted" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateVenueRequestStatus(req._id, "contacted")}
                    className="inline-flex items-center gap-1 rounded-lg bg-info/10 px-2.5 py-1.5 text-[11px] font-bold text-info hover:bg-info/20 transition"
                  >
                    تم التواصل
                  </button>
                )}

                {req.status !== "added" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateVenueRequestStatus(req._id, "added")}
                    className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2.5 py-1.5 text-[11px] font-bold text-success hover:bg-success/20 transition"
                  >
                    <CheckCircle2 className="size-3.5" /> تمت الإضافة
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteVenueRequest(req._id)}
                className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20 transition"
                title="حذف الطلب"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
