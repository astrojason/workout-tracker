"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayIndex(): number {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return FULL_DAYS.indexOf(today);
}

// Returns a map of full day name → ISO date (YYYY-MM-DD) for Mon–Sun of the current calendar week.
function getThisWeekDates(): Record<string, string> {
  const today = new Date();
  const dayIdx = today.getDay(); // 0=Sun
  const mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const result: Record<string, string> = {};
  FULL_DAYS.forEach((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[name] = d.toLocaleDateString("en-CA");
  });
  return result;
}

interface WeeklyOverviewProps {
  availableDays: string[];
  completedDays: Set<string>;
}

export function WeeklyOverview({ availableDays, completedDays }: WeeklyOverviewProps) {
  const currentDay = todayIndex();
  const weekDates = getThisWeekDates();

  return (
    <div className="flex gap-2 justify-between">
      {DAYS.map((day, i) => {
        const fullDay = FULL_DAYS[i];
        const isAvailable = availableDays.includes(fullDay);
        const isCompleted = completedDays.has(weekDates[fullDay] ?? "");
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
