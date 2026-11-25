"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DesktopExercises } from "@/components/library/DesktopLibrary";

// Desktop only (a top-bar tab); on a phone this route points to where it's managed in Settings.
export default function ExercisesPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to view exercises.</p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="hidden lg:block max-w-[1360px] mx-auto p-8">
        <DesktopExercises userId={user.uid} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 lg:hidden">
      <h1 className="text-2xl font-bold mb-4">Exercises</h1>
      <Link href="/settings/exercises" className="block bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 hover:bg-gray-800">Exercise library →</Link>
    </div>
  );
}
