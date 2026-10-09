import { notFound } from "next/navigation";
import { BottomNav } from "@/components/ui/BottomNav";

export default function BottomNavTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return <BottomNav active="home" />;
}
