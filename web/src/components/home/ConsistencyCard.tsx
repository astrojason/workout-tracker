interface ConsistencyCardProps {
  currentStreak: number;
  completedThisWeek: number;
  plannedThisWeek: number;
}

export function ConsistencyCard({
  currentStreak,
  completedThisWeek,
  plannedThisWeek,
}: ConsistencyCardProps) {
  const progress = plannedThisWeek === 0
    ? 0
    : Math.min(100, Math.round((completedThisWeek / plannedThisWeek) * 100));

  return (
    <section className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
        Workout consistency
      </h2>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-bold text-orange-300">
            {currentStreak} day streak
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {plannedThisWeek === 0
              ? "No sessions planned this week"
              : `This week: ${completedThisWeek}/${plannedThisWeek} planned sessions`}
          </p>
        </div>
        <span className="text-3xl" aria-hidden="true">&#x1F525;</span>
      </div>
      {plannedThisWeek > 0 && (
        <div
          role="progressbar"
          aria-label="Weekly workout progress"
          aria-valuemin={0}
          aria-valuemax={plannedThisWeek}
          aria-valuenow={completedThisWeek}
          className="mt-4 h-2 overflow-hidden rounded-full bg-gray-800"
        >
          <div
            className="h-full rounded-full bg-green-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </section>
  );
}
