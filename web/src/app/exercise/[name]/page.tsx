"use client";

import { use, useState, useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExerciseHistory } from "@/hooks/useHistory";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DesktopExerciseReport } from "@/components/exercise/DesktopExerciseReport";
import { cleanWeight, formatTimeValue } from "@/lib/types";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// A stat tile on phones; a flat, left-aligned block with a top divider on desktop.
const STAT_CLASS = "desk-flat bg-gray-900 rounded-xl p-3 text-center border border-gray-800 lg:py-4 lg:text-left lg:flex lg:flex-col lg:justify-center";

// Desktop: a full report for the exercise (DesktopExerciseReport). Phones: the progress view below.
export default function ExerciseProgressPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const exerciseName = decodeURIComponent(name);
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const { definitions, loading } = useExerciseDefinitions(user?.uid ?? null);
  // Current name -> definition, so history stays correct even if this exercise
  // gets renamed later (matched by id, not the name in the URL).
  const definition = useMemo(() => {
    const target = exerciseName.trim().toLowerCase();
    return Object.values(definitions).find((d) => d.name.trim().toLowerCase() === target) ?? null;
  }, [definitions, exerciseName]);

  if (isDesktop && user) {
    return (
      <div className="hidden lg:block max-w-[1360px] mx-auto p-8">
        {loading ? (
          <div role="status" className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" aria-hidden="true" />
          </div>
        ) : (
          <DesktopExerciseReport key={definition?.id ?? exerciseName} userId={user.uid} name={exerciseName} definition={definition} />
        )}
      </div>
    );
  }
  // Signed in: hidden at desktop width until the width is known, so the phone view never flashes there.
  return (
    <div className={user ? "lg:hidden" : ""}>
      <PhoneExerciseProgress exerciseName={exerciseName} definitionId={definition?.id ?? null} />
    </div>
  );
}

function PhoneExerciseProgress({ exerciseName, definitionId }: { exerciseName: string; definitionId: string | null }) {
  const { user } = useAuth();
  const { history, isTimeBased, isBodyweight, loading } = useExerciseHistory(user?.uid ?? null, exerciseName, definitionId);
  const [mode, setMode] = useState<"weight" | "volume">("weight");

  const chartData = history.map((h) => ({
    date: h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weight: h.weight,
    volume: h.volume,
    reps: h.reps,
  }));

  const maxWeight = history.length > 0 ? Math.max(...history.map((h) => h.weight)) : 0;
  const maxVolume = history.length > 0 ? Math.max(...history.map((h) => h.volume)) : 0;
  const maxReps = history.length > 0 ? Math.max(...history.map((h) => h.reps)) : 0;

  const chartKey = isTimeBased || isBodyweight ? "reps" : mode;

  return (
    <div className="max-w-lg mx-auto p-4 lg:max-w-[1200px] lg:p-8">
      <Link href="/history" className="text-indigo-400 text-sm mb-4 inline-block">
        &larr; Back to History
      </Link>

      {/* Header: on desktop the weight/volume toggle sits beside the name */}
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-4 lg:mb-6">
      <h1 className="text-2xl font-bold mb-6 lg:mb-0 lg:text-3xl">{exerciseName}</h1>

      {/* Mode Toggle — only for weighted exercises */}
      {!isTimeBased && !isBodyweight && (
        <div className="flex bg-gray-900 rounded-xl p-1 mb-6 border border-gray-800 lg:mb-0 lg:w-[260px]">
          <button
            onClick={() => setMode("weight")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "weight" ? "bg-indigo-600" : "text-gray-400"
            }`}
          >
            Weight
          </button>
          <button
            onClick={() => setMode("volume")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "volume" ? "bg-indigo-600" : "text-gray-400"
            }`}
          >
            Volume
          </button>
        </div>
      )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No data yet. Complete workouts with this exercise to see progression.
        </div>
      ) : (
        <>
          {/* Desktop: chart with the stats stacked beside it */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6 lg:mb-8">
          {/* Chart */}
          <div className="desk-flat bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6 lg:mb-0">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#9CA3AF" }}
                />
                <Line
                  type="monotone"
                  dataKey={chartKey}
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ fill: "#6366F1", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div className={`grid gap-3 mb-6 lg:mb-0 lg:grid-cols-1 lg:auto-rows-fr ${isTimeBased || isBodyweight ? "grid-cols-2" : "grid-cols-3"}`}>
            {isTimeBased ? (
              <div className={STAT_CLASS}>
                <div className="font-bold lg:text-2xl">{formatTimeValue(maxReps)}</div>
                <div className="text-xs text-gray-400">Max Duration</div>
              </div>
            ) : isBodyweight ? (
              <div className={STAT_CLASS}>
                <div className="font-bold lg:text-2xl">{maxReps}</div>
                <div className="text-xs text-gray-400">Max Reps</div>
              </div>
            ) : (
              <>
                <div className={STAT_CLASS}>
                  <div className="font-bold lg:text-2xl">{cleanWeight(maxWeight)} lbs</div>
                  <div className="text-xs text-gray-400">Max Weight</div>
                </div>
                <div className={STAT_CLASS}>
                  <div className="font-bold lg:text-2xl">{cleanWeight(maxVolume)}</div>
                  <div className="text-xs text-gray-400">Max Volume</div>
                </div>
              </>
            )}
            <div className={STAT_CLASS}>
              <div className="font-bold lg:text-2xl">{history.length}</div>
              <div className="text-xs text-gray-400">Sessions</div>
            </div>
          </div>

          </div>

          {/* Recent Sets */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Sets</h2>
          <div className="desk-flat bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
            {history.slice(-20).reverse().map((entry, i) => (
              <div key={i} className="px-4 py-3 lg:px-0 lg:border-b lg:border-gray-800 flex justify-between text-sm">
                <span className="text-gray-400">
                  {entry.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="font-semibold">
                  {isTimeBased
                    ? formatTimeValue(entry.reps)
                    : isBodyweight
                    ? `${entry.reps} reps`
                    : `${cleanWeight(entry.weight)} lbs x ${entry.reps}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
