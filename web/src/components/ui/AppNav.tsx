"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

// The footer is part of the app shell (layout.tsx), so every view has it. The tab for the
// current section is highlighted; other routes (a session, an exercise, a program) highlight none.
function sectionFor(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

export function AppNav() {
  return <BottomNav active={sectionFor(usePathname())} />;
}
