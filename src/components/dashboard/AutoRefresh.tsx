"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Quietly re-fetches the current route on an interval so newly-logged calls
 * appear without a manual reload — used on the client call-log page so a call
 * pops in live during a demo. Pauses when the tab is hidden to avoid needless
 * work. `router.refresh()` only re-runs the server components (no full reload),
 * so scroll position and open <details> transcripts are preserved.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
