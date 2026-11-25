"use client";

import { notFound } from "next/navigation";
import { HomeLayout } from "@/components/home/HomeLayout";

export default function HomeLayoutTestPage() {
  // Browser-test fixture only. Production builds expose no preview UI or data.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <HomeLayout
      banner={<p>Banner placeholder</p>}
      overview={<p>Overview placeholder</p>}
      training={<p>Training placeholder</p>}
    />
  );
}
