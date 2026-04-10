import { Injectable, inject, signal } from '@angular/core';
import { Platform } from '@ionic/angular/standalone';
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
  PermissionStatus,
} from '@capacitor/local-notifications';
import type { Habit } from '../models/habit.model';

// ─────────────────────────────────────────────────────────────────────────────
// NotificationService
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly platform = inject(Platform);

  /** Whether the user has granted notification permission */
  readonly hasPermission = signal<boolean>(false);

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.platform.ready();
    await this.requestPermissions();

    // Listen for tap-on-notification to foreground the right habit
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[Notifications] action performed:', action);
      // Navigation / deep link logic can be wired here
    });
  }

  // ── Permission ──────────────────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    try {
      const perm: PermissionStatus = await LocalNotifications.requestPermissions();
      const granted = perm.display === 'granted';
      this.hasPermission.set(granted);
      return granted;
    } catch {
      this.hasPermission.set(false);
      return false;
    }
  }

  // ── Schedule ────────────────────────────────────────────────────────────────

  /**
   * Schedules a daily repeating local notification for a habit.
   * Returns the notification ID so it can be persisted alongside the habit.
   */
  async scheduleHabitReminder(habit: Habit): Promise<number | null> {
    if (!this.hasPermission()) {
      const granted = await this.requestPermissions();
      if (!granted) return null;
    }

    const [h, m]    = habit.scheduledTime.split(':').map(Number);
    const notifId   = this.generateNotifId(habit.id);
    const notifDate = this.nextOccurrence(h, m);

    const notification: LocalNotificationSchema = {
      id:    notifId,
      title: `⏰ Time for: ${habit.name}`,
      body:  habit.description
        ? `${habit.description} — Let's keep your streak going! 🔥`
        : `Your habit is waiting — tap to start! 🚀`,
      schedule: {
        at:       notifDate,
        repeats:  true,    // fires daily at the same time
        allowWhileIdle: true,
      },
      extra: {
        habitId:  habit.id,
        category: habit.category,
      },
      smallIcon:       'ic_stat_habit',   // Android small icon (add to res/drawable)
      iconColor:       '#58CC02',         // primary green
      sound:           'default',
      actionTypeId:    'HABIT_REMINDER',
    };

    const options: ScheduleOptions = { notifications: [notification] };

    try {
      await LocalNotifications.schedule(options);
      return notifId;
    } catch (e) {
      console.error('[Notifications] schedule failed:', e);
      return null;
    }
  }

  /**
   * Schedules a one-shot "you're late" nudge notification.
   * Fires 15 minutes after the habit's scheduled time if not yet started.
   */
  async scheduleNudge(habit: Habit, delayMinutes = 15): Promise<void> {
    if (!this.hasPermission()) return;

    const notifDate = new Date(Date.now() + delayMinutes * 60_000);
    const nudgeId   = this.generateNotifId(habit.id) + 1_000_000;

    await LocalNotifications.schedule({
      notifications: [{
        id:    nudgeId,
        title: `👀 Still time for: ${habit.name}`,
        body:  `You're ${delayMinutes} min late — but you can still do it! 💪`,
        schedule: { at: notifDate },
        extra:  { habitId: habit.id },
        sound:  'default',
        smallIcon: 'ic_stat_habit',
      }],
    });
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  async cancelNotification(notifId: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch (e) {
      console.warn('[Notifications] cancel failed:', e);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (e) {
      console.warn('[Notifications] cancelAll failed:', e);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Returns the next Date occurrence of a given HH:MM time (today or tomorrow) */
  private nextOccurrence(hour: number, minute: number): Date {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(hour, minute);

    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1); // fire tomorrow if already past
    }

    return d;
  }

  /**
   * Derives a stable integer notification ID from a UUID.
   * Capacitor Local Notifications requires integer IDs.
   */
  private generateNotifId(habitId: string): number {
    let hash = 0;
    for (let i = 0; i < habitId.length; i++) {
      hash = (Math.imul(31, hash) + habitId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 2_147_483_647; // keep within 32-bit signed int
  }
}
