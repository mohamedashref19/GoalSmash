import { useState } from "react";

export const useConfirm = () => {
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null);
  const [message, setMessage] = useState<string>("");

  // الدالة اللي هنستدعيها في الكود وتوقف التنفيذ لحد ما المستخدم يرد
  const confirm = (msg: string) =>
    new Promise<boolean>((resolve) => {
      setMessage(msg);
      setPromise({ resolve });
    });

  const handleConfirm = () => {
    promise?.resolve(true);
    setPromise(null);
  };

  const handleCancel = () => {
    promise?.resolve(false);
    setPromise(null);
  };

  // المكون (Modal) اللي هيتعرض للمستخدم
  const ConfirmDialog = () =>
    promise !== null ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          className="w-full max-w-sm overflow-hidden rounded-3xl bg-background p-6 shadow-2xl"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">تأكيد الإجراء</h2>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{message}</p>

          <div className="mt-8 flex gap-3">
            <button
              onClick={handleConfirm}
              className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-red-600 active:scale-95"
            >
              نعم، متأكد
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
            >
              تراجع
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return { confirm, ConfirmDialog };
};
