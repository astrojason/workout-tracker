"use client";

import { use, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExerciseHistory } from "@/hooks/useHistory";
import { cleanWeight } from "@/lib/types";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ExerciseProgressPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const exerciseName = decodeURIComponent(name);
  const { user } = useAuth();
  const { history, loading } = useExerciseHistory(user?.uid ?? null, exerciseName);
  const [mode, setMode] = useState<"weight" | "volume">("weight");

  const chartData = history.map((h) => ({
    date: h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weight: h.weight,
    volume: h.volume,
    reps: h.reps,
  }));

  const maxWeight = history.length > 0 ? Math.max(...history.map((h) => h.weight)) : 0;
  const maxVolume = history.length > 0 ? Math.max(...history.map((h) => h.volume)) : 0;

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <Link href="/history" className="text-indigo-400 text-sm mb-4 inline-block">
        &larr; Back to History
      </Link>

      <h1 className="text-2xl font-bold mb-6">{exerciseName}</h1>

      {/* Mode Toggle */}
      <div className="flex bg-gray-900 rounded-xl p-1 mb-6 border border-gray-800">
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
          {/* Chart */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
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
                  dataKey={mode}
                  stroke="#6366F1"
                  strokeWidth={2}
                  dot={{ fill: "#6366F1", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
              <div className="font-bold">{cleanWeight(maxWeight)} lbs</div>
              <div className="text-xs text-gray-400">Max Weight</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
              <div className="font-bold">{cleanWeight(maxVolume)}</div>
              <div className="text-xs text-gray-400">Max Volume</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
              <div className="font-bold">{history.length}</div>
              <div className="text-xs text-gray-400">Sessions</div>
            </div>
          </div>

          {/* Recent Sets */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Sets</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {history.slice(-20).reverse().map((entry, i) => (
              <div key={i} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-400">
                  {entry.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="font-semibold">
                  {cleanWeight(entry.weight)} lbs x {entry.reps}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
