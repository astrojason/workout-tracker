"use client";

import { useEffect, useState } from "react";

// Matches Tailwind's `lg` breakpoint, where the nav becomes a top bar (see globals.css).
const DESKTOP_QUERY = "(min-width: 64rem)";

// True at desktop widths. Used where the desktop layout loads different data than the phone one,
// so a phone never fetches what only the desktop shows. False until mounted (no window on the server).
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}
