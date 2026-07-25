"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PhotoUploadWarningBannerProps {
  failed: number;
  total: number;
}

/**
 * Dismissible banner shown on the properties list after a property was created
 * but some staged photos failed to upload (see CrmPropertyFullForm create mode,
 * which redirects here with ?photoWarn=1&failed=&total=).
 */
export function PhotoUploadWarningBanner({ failed, total }: PhotoUploadWarningBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    // Drop the ?photoWarn=… query so a refresh after dismissing won't re-show it.
    router.replace("/account/properties");
  };

  return (
    <div className="mt-6 flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800">
        Объект создан, но {failed} из {total} фото не удалось загрузить. Откройте объект и
        попробуйте загрузить фото ещё раз.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-amber-700 hover:text-amber-900"
        aria-label="Закрыть"
      >
        ✕
      </button>
    </div>
  );
}
