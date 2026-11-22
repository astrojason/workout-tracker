import { notFound } from "next/navigation";

export default function BottomNavTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  // The bottom nav comes from the app shell (layout.tsx); this page only needs to exist.
  return <div />;
}
