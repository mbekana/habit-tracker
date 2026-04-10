import {
  Injectable,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import {
  Habit,
  HabitLog,
  HabitWithLog,
  HabitCategory,
  DayOfWeek,
  todayIso,
  timeToMinutes,
  nowMinutes,
  uuid,
} from '../models/habit.model';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';

// ─────────────────────────────────────────────────────────────────────────────
// DTO used when creating / editing a habit
// ─────────────────────────────────────────────────────────────────────────────

export interface HabitFormData {
  name: string;
  description?: string;
  category: HabitCategory;
  icon?: string;
  scheduledTime: string;   // "HH:MM"
  durationMinutes: number;
  repeatDays?: DayOfWeek[];
  xpReward?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class HabitService {

  private readonly db = inject(DatabaseService);
  private readonly notifications = inject(NotificationService);

  // ── Raw state signals ───────────────────────────────────────────────────────

  /** All active habits ordered by scheduledTime */
  readonly habits = signal<Habit[]>([]);

  /** Today's habit logs keyed by habitId */
  readonly todayLogs = signal<Map<string, HabitLog>>(new Map());

  /** Accumulated XP for the session */
  readonly totalXp = signal<number>(0);

  /** Loading / error states */
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // ── Computed signals (derived state) ────────────────────────────────────────

  /**
   * Rich view-model for the home screen.
   * Merges each habit with its today log, and annotates which one is "next".
   */
  readonly todayJourney = computed<HabitWithLog[]>(() => {
    const habits = this.habits();
    const logsMap = this.todayLogs();
    const now = nowMinutes();

    let nextMarked = false;

    return habits.map(habit => {
      const log = logsMap.get(habit.id) ?? null;
      const isCompleted = log?.status === 'completed';
      const scheduled = timeToMinutes(habit.scheduledTime);
      const isPast = scheduled < now && !isCompleted;

      // The "next" item is the first non-completed habit at or after now,
      // OR if all future habits are done — the first pending overall.
      const isNext = !isCompleted && !nextMarked && (scheduled >= now || (!nextMarked && isPast));

      if (isNext) nextMarked = true;

      return { habit, log, isNext, isPast };
    });
  });

  /** Number of habits completed today */
  readonly completedCount = computed(() =>
    [...this.todayLogs().values()].filter(l => l.status === 'completed').length
  );

  /** Total habits scheduled for today */
  readonly totalCount = computed(() => this.habits().length);

  /** Completion percentage for the progress ring */
  readonly progressPercent = computed(() =>
    this.totalCount() === 0 ? 0 :
      Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  /** True when every habit for today is done */
  readonly allDone = computed(() =>
    this.totalCount() > 0 && this.completedCount() === this.totalCount()
  );

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  /**
   * Load habits + today's logs from SQLite.
   * Must be called after DatabaseService.init() resolves.
   */
  async loadToday(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const [habits, logs, xp] = await Promise.all([
        this.db.getAllHabits(),
        this.db.getLogsForDate(todayIso()),
        this.db.getTotalXp(),
      ]);

      const logsMap = new Map(logs.map(l => [l.habitId, l]));

      this.habits.set(habits);
      this.todayLogs.set(logsMap);
      this.totalXp.set(xp);
    } catch (e: any) {
      console.error('[HabitService] loadToday:', e);
      this.error.set(e?.message ?? 'Failed to load habits');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ── Create / Update / Delete ─────────────────────────────────────────────────

  async createHabit(data: HabitFormData): Promise<Habit> {
    const now = new Date().toISOString();
    const habit: Habit = {
      id: uuid(),
      name: data.name,
      description: data.description,
      category: data.category,
      icon: data.icon,
      scheduledTime: data.scheduledTime,
      durationMinutes: data.durationMinutes,
      repeatDays: data.repeatDays ?? [],
      isActive: true,
      xpReward: data.xpReward ?? 10,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insertHabit(habit);

    // Schedule a local notification for this habit
    const notifId = await this.notifications.scheduleHabitReminder(habit);
    if (notifId !== null) {
      habit.notificationId = notifId;
      await this.db.updateHabit(habit);
    }

    // Optimistic update — no full reload needed
    this.habits.update(prev => [...prev, habit].sort(byScheduledTime));

    return habit;
  }

  async updateHabit(id: string, data: Partial<HabitFormData>): Promise<void> {
    const existing = this.habits().find(h => h.id === id);
    if (!existing) throw new Error(`Habit ${id} not found`);

    const updated: Habit = {
      ...existing,
      ...data,
      repeatDays: data.repeatDays ?? existing.repeatDays,
      updatedAt: new Date().toISOString(),
    };

    await this.db.updateHabit(updated);

    // Re-schedule notification if time changed
    if (data.scheduledTime && data.scheduledTime !== existing.scheduledTime) {
      if (existing.notificationId !== undefined) {
        await this.notifications.cancelNotification(existing.notificationId);
      }
      const notifId = await this.notifications.scheduleHabitReminder(updated);
      if (notifId !== null) {
        updated.notificationId = notifId;
        await this.db.updateHabit(updated);
      }
    }

    this.habits.update(prev =>
      prev.map(h => (h.id === id ? updated : h)).sort(byScheduledTime)
    );
  }

  async deleteHabit(id: string): Promise<void> {
    const existing = this.habits().find(h => h.id === id);
    if (existing?.notificationId !== undefined) {
      await this.notifications.cancelNotification(existing.notificationId);
    }

    await this.db.deleteHabit(id);

    this.habits.update(prev => prev.filter(h => h.id !== id));
    this.todayLogs.update(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  // ── Habit Lifecycle (Start / Complete / Skip) ────────────────────────────────

  /**
   * Called when the user taps "Start" on a habit.
   * Creates (or reuses) a HabitLog and stamps startTime.
   */
  async startHabit(habitId: string): Promise<HabitLog> {
    const existing = this.todayLogs().get(habitId);
    const now = new Date().toISOString();

    if (existing && existing.status === 'in_progress') return existing;

    const log: HabitLog = existing
      ? { ...existing, status: 'in_progress', startTime: now }
      : {
        id: uuid(),
        habitId,
        date: todayIso(),
        startTime: now,
        status: 'in_progress',
        xpEarned: 0,
        createdAt: now,
      };

    if (existing) {
      await this.db.updateLog(log);
    } else {
      await this.db.insertLog(log);
    }

    this.todayLogs.update(prev => new Map(prev).set(habitId, log));
    return log;
  }

  /**
   * Called when the user taps "Done" on an in-progress habit.
   * Stamps endTime, computes duration, awards XP, and updates streak.
   */
  async completeHabit(habitId: string): Promise<void> {
    const existing = this.todayLogs().get(habitId);
    if (!existing) return;

    const habit = this.habits().find(h => h.id === habitId);
    if (!habit) return;

    const now = new Date().toISOString();
    const startMs = existing.startTime ? new Date(existing.startTime).getTime() : Date.now();
    const durationSeconds = Math.round((Date.now() - startMs) / 1000);

    const log: HabitLog = {
      ...existing,
      endTime: now,
      durationSeconds,
      status: 'completed',
      xpEarned: habit.xpReward,
    };

    await this.db.updateLog(log);

    // Update habit streak
    const newStreak = habit.streak + 1;
    const updated = { ...habit, streak: newStreak, updatedAt: now };
    await this.db.updateHabit(updated);

    // Optimistic signal updates
    this.todayLogs.update(prev => new Map(prev).set(habitId, log));
    this.habits.update(prev =>
      prev.map(h => (h.id === habitId ? updated : h))
    );
    this.totalXp.update(prev => prev + habit.xpReward);
  }

  /**
   * Marks a habit as skipped for today.
   */
  async skipHabit(habitId: string): Promise<void> {
    const existing = this.todayLogs().get(habitId);
    const now = new Date().toISOString();

    const log: HabitLog = existing
      ? { ...existing, status: 'skipped' }
      : {
        id: uuid(),
        habitId,
        date: todayIso(),
        status: 'skipped',
        xpEarned: 0,
        createdAt: now,
      };

    if (existing) {
      await this.db.updateLog(log);
    } else {
      await this.db.insertLog(log);
    }

    this.todayLogs.update(prev => new Map(prev).set(habitId, log));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function byScheduledTime(a: Habit, b: Habit): number {
  return a.scheduledTime.localeCompare(b.scheduledTime);
}
