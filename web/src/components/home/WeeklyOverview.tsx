"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayIndex(): number {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return FULL_DAYS.indexOf(today);
}

interface WeeklyOverviewProps {
  availableDays: string[];
  completedDays: Set<string>;
}

export function WeeklyOverview({ availableDays, completedDays }: WeeklyOverviewProps) {
  const currentDay = todayIndex();

  return (
    <div className="flex gap-2 justify-between">
      {DAYS.map((day, i) => {
        const fullDay = FULL_DAYS[i];
        const isAvailable = availableDays.includes(fullDay);
        const isCompleted = completedDays.has(fullDay);
        const isToday = i === currentDay;

        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500">{day}</span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                isCompleted
                  ? "bg-green-600 text-white"
                  : isToday
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                  : isAvailable
                  ? "bg-gray-700 text-gray-400"
                  : "bg-gray-800/50 text-gray-600"
              }`}
            >
              {isCompleted ? "\u2713" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
