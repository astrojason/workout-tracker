"use client";

import type { ReactNode } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// Home is two different pages: on a phone it's workout-first (program cards, today's workout,
// custom workout); at desktop width it's the Overview report only. Each is only mounted at its own
// width, so a phone never loads the Overview's data and desktop never shows workout cards. Before
// the width is known the phone page renders, hidden by CSS at desktop width so it never flashes.
export function HomeLayout({ banner, overview, training }: { banner?: ReactNode; overview: ReactNode; training: ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <div className="max-w-lg mx-auto p-4 lg:max-w-[1360px] lg:p-8">
      {banner}
      {isDesktop ? <div className="hidden lg:block">{overview}</div> : <div className="lg:hidden">{training}</div>}
    </div>
  );
}
