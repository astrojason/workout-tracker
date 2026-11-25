"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DesktopEquipment } from "@/components/equipment/DesktopEquipment";

// Desktop: everything you own, what it can load and what it can't. On a phone equipment is edited
// from Settings, so this route points there.
export default function EquipmentRoute() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Sign in to manage equipment.</p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="hidden lg:block max-w-[1360px] mx-auto p-8">
        <DesktopEquipment userId={user.uid} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 lg:hidden">
      <h1 className="text-2xl font-bold mb-4">Equipment</h1>
      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        <Link href="/settings/equipment" className="block px-4 py-3 hover:bg-gray-800">Equipment you own →</Link>
        <Link href="/settings/machines" className="block px-4 py-3 hover:bg-gray-800">Gym machines →</Link>
      </div>
    </div>
  );
}
