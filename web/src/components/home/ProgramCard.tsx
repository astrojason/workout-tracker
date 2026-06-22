"use client";

import type { Program, Workout } from "@/lib/types";
import { WeeklyOverview } from "./WeeklyOverview";
import { useState } from "react";

function getThisWeekDates(): Record<string, string> {
  const today = new Date();
  const dayIdx = today.getDay();
  const mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const result: Record<string, string> = {};
  FULL_DAYS.forEach((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[name] = d.toLocaleDateString("en-CA");
  });
  return result;
}

interface ProgramCardProps {
  program: Program;
  week: number;
  todaysWorkout: Workout | null;
  availableDays: string[];
  completedDays: Set<string>;
  onStartWorkout: (workout: Workout) => void;
  onSelectDay: (day: string) => void;
}

export function ProgramCard({
  program, week, todaysWorkout, availableDays, completedDays,
  onStartWorkout, onSelectDay,
}: ProgramCardProps) {
  const [showDays, setShowDays] = useState(false);
  const weekDates = getThisWeekDates();
  const todayISO = new Date().toLocaleDateString("en-CA");
  const isCompleted = todaysWorkout ? completedDays.has(todayISO) : false;

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold">{program.name}</h2>
          <p className="text-sm text-gray-400">
            Week {week} of {program.totalWeeks}
          </p>
        </div>
      </div>

      {/* Weekly Overview */}
      <WeeklyOverview
        availableDays={availableDays}
        completedDays={completedDays}
      />

      {/* Today's Workout Button */}
      {todaysWorkout && (
        <button
          onClick={() => onStartWorkout(todaysWorkout)}
          disabled={isCompleted}
          className={`w-full mt-4 p-4 rounded-xl font-semibold flex items-center justify-between transition ${
            isCompleted
              ? "bg-green-700 cursor-default"
              : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          <div className="text-left">
            <div className="font-bold">
              {isCompleted ? "Today's Workout Completed" : `Start ${todaysWorkout.dayOfWeek}`}
            </div>
            <div className="text-sm opacity-80">
              {todaysWorkout.exercises.length} exercises
            </div>
          </div>
          <span className="text-2xl">
            {isCompleted ? "\u2713" : "\u25B6"}
          </span>
        </button>
      )}

      {/* Different Day */}
      <button
        onClick={() => setShowDays(!showDays)}
        className="w-full mt-2 text-sm text-gray-400 hover:text-gray-300 py-2"
      >
        {showDays ? "Hide days" : "Choose different day"}
      </button>

      {showDays && (
        <div className="mt-2 space-y-1">
          {availableDays.map((day) => (
            <button
              key={day}
              onClick={() => { onSelectDay(day); setShowDays(false); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 text-sm flex justify-between items-center"
            >
              <span>{day}</span>
              {completedDays.has(weekDates[day] ?? "") && (
                <span className="text-green-400 text-xs">Done</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
