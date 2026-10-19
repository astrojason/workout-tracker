"use client";

import { useState } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import { formatSessionAsMarkdown } from "@/lib/week-export";
import type { WorkoutSessionDoc } from "@/lib/types";

// Copies one whole logged workout to the clipboard as a Markdown document.
export function CopySessionButton({ session }: { session: WorkoutSessionDoc }) {
  const { showError } = useError();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatSessionAsMarkdown(session));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showError(err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy workout as Markdown"
      className="shrink-0 px-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
    >
      {copied ? "Copied!" : "Copy MD"}
    </button>
  );
}
