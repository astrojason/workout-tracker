"use client";

import { useState } from "react";

interface ErrorModalProps {
  error: Error | null;
  onClose: () => void;
}

export function ErrorModal({ error, onClose }: ErrorModalProps) {
  const [copied, setCopied] = useState(false);
  if (!error) return null;

  const fullText = [error.message, error.stack ? `\n\nStack:\n${error.stack}` : ""].join("").trim();

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — selection is still possible
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-red-800 rounded-2xl p-6 max-w-lg w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-red-400 font-bold text-lg mb-1">Error</h2>
        <p className="text-gray-400 text-sm mb-3">
          Something went wrong. Copy the full details below.
        </p>
        <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 overflow-auto max-h-64 mb-4 whitespace-pre-wrap select-all">
          {fullText}
        </pre>
        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
