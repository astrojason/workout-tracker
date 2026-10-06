"use client";

import { useState } from "react";
import { useError } from "@/components/providers/ErrorProvider";
import type { CoachSuggestion } from "@/lib/coach";

export interface CoachResult {
  feedback: string;
  adjustments: CoachSuggestion[];
}

interface CoachPanelProps {
  onAsk: () => Promise<CoachResult>;
  onApply: (suggestion: CoachSuggestion) => Promise<void>;
}

const FIELD_LABEL: Record<CoachSuggestion["field"], string> = {
  weight: "weight",
  sets: "sets",
  repMin: "min reps",
};

export function CoachPanel({ onAsk, onApply }: CoachPanelProps) {
  const { showError } = useError();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState<number | null>(null);

  async function ask() {
    setLoading(true);
    try {
      setResult(await onAsk());
      setApplied(new Set());
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  async function apply(index: number, suggestion: CoachSuggestion) {
    setApplying(index);
    try {
      await onApply(suggestion);
      setApplied((prev) => new Set(prev).add(index));
    } catch (err) {
      showError(err);
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="mb-6">
      <h2 className="font-bold mb-3">Coach</h2>
      {!result ? (
        <button
          onClick={ask}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 font-semibold transition disabled:opacity-60"
        >
          {loading ? "Coach is reviewing…" : "Ask Coach"}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-300 bg-gray-900 border border-gray-800 rounded-xl p-4">{result.feedback}</p>
          {result.adjustments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 uppercase">Suggested changes</div>
              {result.adjustments.map((a, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">
                      {a.exerciseName} <span className="text-gray-500 font-normal">{FIELD_LABEL[a.field]}</span>
                    </div>
                    <div className="text-indigo-300">{a.from ?? "?"} → {a.to}</div>
                    {a.reason && <div className="text-gray-400 mt-1">{a.reason}</div>}
                  </div>
                  {applied.has(i) ? (
                    <span className="text-xs text-green-400 font-bold shrink-0">Applied</span>
                  ) : (
                    <button
                      onClick={() => apply(i, a)}
                      disabled={applying === i}
                      aria-label={`Apply ${a.exerciseName} ${FIELD_LABEL[a.field]}`}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition disabled:opacity-60"
                    >
                      {applying === i ? "…" : "Apply"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
