"use client";

import { useEffect } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import type { HomeSummary } from "@/lib/home-summary";
import { isNativeApp, postNative } from "@/lib/native-bridge";

// Renders nothing. Inside the iPhone app, hands the home summary to native so the Home Screen
// widget stays current; re-posts only when the summary actually changes.
export function NativeHomeSummary({ summary }: { summary: HomeSummary }) {
  const { showError } = useError();
  const serialized = JSON.stringify(summary);

  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      postNative("homeSummary", JSON.parse(serialized));
    } catch (error) {
      showError(error);
    }
  }, [serialized, showError]);

  return null;
}
