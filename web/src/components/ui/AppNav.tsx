"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/components/providers/AuthProvider";

// The footer is part of the app shell (layout.tsx), so every view has it. The tab for the
// current section is highlighted; other routes (e.g. a session) highlight none.
function sectionFor(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/programs")) return "programs";
  if (pathname.startsWith("/exercise")) return "exercises"; // the Exercises list and each exercise's report
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/body")) return "body";
  if (pathname.startsWith("/equipment")) return "equipment";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

export function AppNav() {
  const { user } = useAuth();
  return <BottomNav active={sectionFor(usePathname())} email={user?.email} />;
}
