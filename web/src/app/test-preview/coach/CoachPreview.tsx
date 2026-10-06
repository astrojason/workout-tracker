"use client";

import { useState } from "react";
import { CoachPanel } from "@/components/workout/CoachPanel";

export function CoachPreview({ fail }: { fail: boolean }) {
  const [log, setLog] = useState("");

  return (
    <>
      <CoachPanel
        onAsk={async () => {
          if (fail) throw new Error("Anthropic API error 529: overloaded");
          return {
            feedback: "Strong session — squats moved fast.",
            adjustments: [
              { exerciseName: "Squat", field: "weight", from: 135, to: 145, reason: "Every set felt easy" },
            ],
          };
        }}
        onApply={async (s) => setLog(`${s.exerciseName}:${s.field}:${s.to}`)}
      />
      <div data-testid="applied-log">{log}</div>
    </>
  );
}
