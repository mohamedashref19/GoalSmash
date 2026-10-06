import { useEffect, useState, useCallback } from "react";
import { Star, MessageSquare, Trash2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
// @ts-expect-error APIs without TS definitions
import { fetchVenueReviews, deleteReview } from "@/api/reviewApi";
import { useConfirm } from "../../components/venue/useConfirm";

interface ReviewType {
  _id: string;
  review: string;
  rating: number;
  createdAt: string;
  user: {
    _id: string;
    name: string;
  };
}

export function ReviewsView({ venueId }: { venueId: string }) {
  const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirm();
  const [error, setError] = useState("");

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchVenueReviews(venueId);
      setReviews(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    if (venueId) loadReviews();
  }, [venueId, loadReviews]);

  const handleDelete = async (reviewId: string) => {
    const isConfirmed = await confirm(
      "هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.",
    );
    if (!isConfirmed) return;
    try {
      await deleteReview(reviewId);
      toast.success("تم حذف التقييم بنجاح");
      loadReviews(); // تحديث القائمة بعد الحذف
    } catch (err) {
      toast.error(err as string);
    }
  };

  const StarRating = ({ rating }: { rating: number }) => {
    return (
      <div className="flex items-center gap-0.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "size-4",
              star <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground/30",
            )}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Clock className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 font-semibold">جارٍ تحميل التقييمات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-64 place-items-center text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="mt-4 font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card-surface p-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" /> تقييمات وآراء العملاء
        </h2>
        <span className="text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
          إجمالي: {reviews.length}
        </span>
      </div>

      {reviews.length === 0 ? (
        <div className="card-surface grid h-64 place-items-center text-muted-foreground">
          <div className="flex flex-col items-center">
            <Star className="size-12 mb-3 opacity-20" />
            <p className="font-semibold">لا توجد تقييمات لهذا الملعب حتى الآن.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <div key={review._id} className="card-surface p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground font-bold text-sm">
                      {review.user.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{review.user.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.review && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 p-3 bg-muted/50 rounded-xl border border-border">
                    "{review.review}"
                  </p>
                )}
              </div>
              <ConfirmDialog />
              <div className="mt-4 pt-3 border-t border-border flex justify-end">
                <button
                  onClick={() => handleDelete(review._id)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition"
                >
                  <Trash2 className="size-3.5" /> حذف التقييم
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
