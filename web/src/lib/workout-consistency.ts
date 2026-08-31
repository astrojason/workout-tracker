import type { WorkoutSessionDoc } from "./types";

export interface ProgramSchedule {
  programId: string;
  week: number;
  days: string[];
}

export interface WorkoutConsistency {
  currentStreak: number;
  completedThisWeek: number;
  plannedThisWeek: number;
}

function sessionDate(value: WorkoutSessionDoc["date"]): Date {
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as unknown as string);
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(now: Date): Date {
  const day = startOfLocalDay(now);
  const mondayOffset = day.getDay() === 0 ? -6 : 1 - day.getDay();
  day.setDate(day.getDate() + mondayOffset);
  return day;
}

function planKey(programId: string, week: number, day: string, date?: Date): string {
  const dailyDate = day === "Daily" && date ? `|${dateKey(date)}` : "";
  return `${programId}|${week}|${day}${dailyDate}`;
}

export function calculateWorkoutConsistency(
  sessions: WorkoutSessionDoc[],
  schedules: ProgramSchedule[],
  now = new Date(),
): WorkoutConsistency {
  const completedSessions = sessions.filter((session) => session.completed);
  const completedDates = new Set(completedSessions.map((session) => dateKey(sessionDate(session.date))));

  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const cursor = completedDates.has(dateKey(today)) ? today : yesterday;
  let currentStreak = 0;
  while (completedDates.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const monday = startOfWeek(now);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const plannedSlots = new Set<string>();
  for (const schedule of schedules) {
    for (const day of schedule.days) {
      if (day === "Daily") {
        for (let offset = 0; offset < 7; offset += 1) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + offset);
          plannedSlots.add(planKey(schedule.programId, schedule.week, day, date));
        }
      } else {
        plannedSlots.add(planKey(schedule.programId, schedule.week, day));
      }
    }
  }

  const completedSlots = new Set<string>();
  for (const session of completedSessions) {
    const date = sessionDate(session.date);
    if (date < monday || date >= nextMonday) continue;
    const key = planKey(session.programId, session.week, session.dayOfWeek, date);
    if (plannedSlots.has(key)) completedSlots.add(key);
  }

  return {
    currentStreak,
    completedThisWeek: completedSlots.size,
    plannedThisWeek: plannedSlots.size,
  };
}
