// ─────────────────────────────────────────────────────────────────────────────
// Habit & HabitLog — Core Data Models
// ─────────────────────────────────────────────────────────────────────────────

/** Visual category of a habit, driving colour theming across the UI. */
export type HabitCategory =
  | 'health'
  | 'fitness'
  | 'mindfulness'
  | 'learning'
  | 'social'
  | 'creativity'
  | 'productivity'
  | 'custom';

/** Colour palette token tied to each category. */
export const CATEGORY_THEME: Record<HabitCategory, { bg: string; text: string; icon: string }> = {
  health: { bg: 'bg-accent-blue/15', text: 'text-accent-blue', icon: '💧' },
  fitness: { bg: 'bg-accent-orange/15', text: 'text-accent-orange', icon: '🏋️' },
  mindfulness: { bg: 'bg-accent-purple/15', text: 'text-accent-purple', icon: '🧘' },
  learning: { bg: 'bg-accent-pink/15', text: 'text-accent-pink', icon: '📚' },
  social: { bg: 'bg-primary-muted', text: 'text-primary-dark', icon: '🤝' },
  creativity: { bg: 'bg-accent-pink/15', text: 'text-accent-pink', icon: '🎨' },
  productivity: { bg: 'bg-accent-blue/15', text: 'text-accent-blue', icon: '✅' },
  custom: { bg: 'bg-surface-card', text: 'text-ink-muted', icon: '⭐' },
};

/** Days of the week a habit is scheduled. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0 … Sat=6

// ─────────────────────────────────────────────────────────────────────────────
// Habit
// ─────────────────────────────────────────────────────────────────────────────

export interface Habit {
  /** UUID – primary key */
  id: string;

  /** Display name shown in the UI */
  name: string;

  /** Optional longer description */
  description?: string;

  /** Visual category – drives colour & icon */
  category: HabitCategory;

  /** Custom emoji icon (overrides category default when set) */
  icon?: string;

  /** 24-hour scheduled time string, e.g. "07:30" */
  scheduledTime: string;

  /** Estimated duration in minutes */
  durationMinutes: number;

  /** Days this habit repeats (empty = daily) */
  repeatDays: DayOfWeek[];

  /** Whether the habit is active/visible */
  isActive: boolean;

  /** Accumulated XP points awarded on completion */
  xpReward: number;

  /** Current streak in days */
  streak: number;

  /** ISO-8601 timestamp when the record was created */
  createdAt: string;

  /** ISO-8601 timestamp of last modification */
  updatedAt: string;

  /** ID of the scheduled local notification (for cancellation) */
  notificationId?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HabitLog – one entry per daily habit execution
// ─────────────────────────────────────────────────────────────────────────────

export type HabitLogStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface HabitLog {
  /** UUID – primary key */
  id: string;

  /** FK → Habit.id */
  habitId: string;

  /** Calendar date this log belongs to, ISO format: "YYYY-MM-DD" */
  date: string;

  /** ISO-8601 timestamp when the user tapped "Start" */
  startTime?: string;

  /** ISO-8601 timestamp when the user tapped "Done" */
  endTime?: string;

  /** Computed duration in seconds (endTime - startTime) */
  durationSeconds?: number;

  /** Lifecycle state of this log entry */
  status: HabitLogStatus;

  /** XP awarded for this specific completion */
  xpEarned: number;

  /** Free-form note the user can attach */
  notes?: string;

  /** ISO-8601 creation timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived view-model used by the Home screen
// ─────────────────────────────────────────────────────────────────────────────

export interface HabitWithLog {
  habit: Habit;
  log: HabitLog | null;
  /** True when this is the next uncompleted habit relative to now */
  isNext: boolean;
  /** True when scheduled time has already passed today */
  isPast: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** Parses a "HH:MM" time string into total minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Returns current minutes since midnight */
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Generates a UUID v4 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
