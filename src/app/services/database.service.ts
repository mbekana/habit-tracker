import { Injectable, inject, signal } from '@angular/core';
import { Platform } from '@ionic/angular/standalone';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { Habit, HabitLog } from '../models/habit.model';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'habittracker.db';
const DB_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// DDL – Schema
// ─────────────────────────────────────────────────────────────────────────────

const SQL_CREATE_HABITS = `
  CREATE TABLE IF NOT EXISTS habits (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    category         TEXT NOT NULL DEFAULT 'custom',
    icon             TEXT,
    scheduled_time   TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    repeat_days      TEXT NOT NULL DEFAULT '[]',
    is_active        INTEGER NOT NULL DEFAULT 1,
    xp_reward        INTEGER NOT NULL DEFAULT 10,
    streak           INTEGER NOT NULL DEFAULT 0,
    notification_id  INTEGER,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
`;

const SQL_CREATE_HABIT_LOGS = `
  CREATE TABLE IF NOT EXISTS habit_logs (
    id               TEXT PRIMARY KEY NOT NULL,
    habit_id         TEXT NOT NULL,
    date             TEXT NOT NULL,
    start_time       TEXT,
    end_time         TEXT,
    duration_seconds INTEGER,
    status           TEXT NOT NULL DEFAULT 'pending',
    xp_earned        INTEGER NOT NULL DEFAULT 0,
    notes            TEXT,
    created_at       TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );
`;

const SQL_CREATE_INDEX_LOGS_DATE = `CREATE INDEX IF NOT EXISTS idx_logs_date     ON habit_logs(date);`;
const SQL_CREATE_INDEX_LOGS_HABIT_ID = `CREATE INDEX IF NOT EXISTS idx_logs_habit_id ON habit_logs(habit_id);`;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DatabaseService {

  private readonly platform = inject(Platform);

  /** True once the DB connection is open and schema is ready */
  readonly isReady = signal(false);

  private sqlite!: SQLiteConnection;
  private db!: SQLiteDBConnection;

  // ── Initialisation ─────────────────────────────────────────────────────────

  /**
   * Call this **once** from app bootstrapping (e.g. APP_INITIALIZER or
   * the root component's ngOnInit).  It is safe to await multiple times
   * because subsequent calls short-circuit on `isReady()`.
   */
  async init(): Promise<void> {
    if (this.isReady()) return;

    await this.platform.ready();

    this.sqlite = new SQLiteConnection(CapacitorSQLite);

    // Ensure the db exists / is open
    const ret = await this.sqlite.checkConnectionsConsistency();
    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

    if (ret.result && isConn) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(
        DB_NAME,
        false,        // encrypted
        'no-encryption',
        DB_VERSION,
        false         // readonly
      );
    }

    await this.db.open();
    await this.runMigrations();

    this.isReady.set(true);
  }

  // ── Migrations ──────────────────────────────────────────────────────────────

  private async runMigrations(): Promise<void> {
    const statements = [
      SQL_CREATE_HABITS,
      SQL_CREATE_HABIT_LOGS,
      SQL_CREATE_INDEX_LOGS_DATE,
      SQL_CREATE_INDEX_LOGS_HABIT_ID,
    ];

    for (const sql of statements) {
      await this.db.execute(sql);
    }
  }

  // ── Habits CRUD ─────────────────────────────────────────────────────────────

  async insertHabit(h: Habit): Promise<void> {
    const sql = `
      INSERT INTO habits
        (id, name, description, category, icon, scheduled_time,
         duration_minutes, repeat_days, is_active, xp_reward,
         streak, notification_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    await this.db.run(sql, [
      h.id, h.name, h.description ?? null, h.category,
      h.icon ?? null, h.scheduledTime, h.durationMinutes,
      JSON.stringify(h.repeatDays), h.isActive ? 1 : 0,
      h.xpReward, h.streak, h.notificationId ?? null,
      h.createdAt, h.updatedAt,
    ]);
  }

  async updateHabit(h: Habit): Promise<void> {
    const sql = `
      UPDATE habits SET
        name=?, description=?, category=?, icon=?,
        scheduled_time=?, duration_minutes=?, repeat_days=?,
        is_active=?, xp_reward=?, streak=?,
        notification_id=?, updated_at=?
      WHERE id=?
    `;
    await this.db.run(sql, [
      h.name, h.description ?? null, h.category, h.icon ?? null,
      h.scheduledTime, h.durationMinutes, JSON.stringify(h.repeatDays),
      h.isActive ? 1 : 0, h.xpReward, h.streak,
      h.notificationId ?? null, h.updatedAt, h.id,
    ]);
  }

  async deleteHabit(id: string): Promise<void> {
    await this.db.run('DELETE FROM habits WHERE id=?', [id]);
  }

  async getAllHabits(): Promise<Habit[]> {
    const res = await this.db.query('SELECT * FROM habits WHERE is_active=1 ORDER BY scheduled_time ASC');
    return (res.values ?? []).map(row => this.rowToHabit(row));
  }

  async getHabitById(id: string): Promise<Habit | null> {
    const res = await this.db.query('SELECT * FROM habits WHERE id=?', [id]);
    const rows = res.values ?? [];
    return rows.length ? this.rowToHabit(rows[0]) : null;
  }

  // ── HabitLog CRUD ───────────────────────────────────────────────────────────

  async insertLog(log: HabitLog): Promise<void> {
    const sql = `
      INSERT INTO habit_logs
        (id, habit_id, date, start_time, end_time,
         duration_seconds, status, xp_earned, notes, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `;
    await this.db.run(sql, [
      log.id, log.habitId, log.date, log.startTime ?? null,
      log.endTime ?? null, log.durationSeconds ?? null, log.status,
      log.xpEarned, log.notes ?? null, log.createdAt,
    ]);
  }

  async updateLog(log: HabitLog): Promise<void> {
    const sql = `
      UPDATE habit_logs SET
        start_time=?, end_time=?, duration_seconds=?,
        status=?, xp_earned=?, notes=?
      WHERE id=?
    `;
    await this.db.run(sql, [
      log.startTime ?? null, log.endTime ?? null,
      log.durationSeconds ?? null, log.status,
      log.xpEarned, log.notes ?? null, log.id,
    ]);
  }

  async getLogsForDate(date: string): Promise<HabitLog[]> {
    const res = await this.db.query(
      'SELECT * FROM habit_logs WHERE date=? ORDER BY created_at ASC',
      [date]
    );
    return (res.values ?? []).map(row => this.rowToLog(row));
  }

  async getLogByHabitAndDate(habitId: string, date: string): Promise<HabitLog | null> {
    const res = await this.db.query(
      'SELECT * FROM habit_logs WHERE habit_id=? AND date=?',
      [habitId, date]
    );
    const rows = res.values ?? [];
    return rows.length ? this.rowToLog(rows[0]) : null;
  }

  /** Returns total XP accumulated across all time */
  async getTotalXp(): Promise<number> {
    const res = await this.db.query(
      'SELECT COALESCE(SUM(xp_earned),0) AS total FROM habit_logs WHERE status=?',
      ['completed']
    );
    return (res.values ?? [])[0]?.total ?? 0;
  }

  /** Returns number of completions for a given habit in the last N days */
  async getStreakCount(habitId: string, days: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const res = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM habit_logs
       WHERE habit_id=? AND status='completed' AND date>=?`,
      [habitId, sinceStr]
    );
    return (res.values ?? [])[0]?.cnt ?? 0;
  }

  // ── Row mappers ─────────────────────────────────────────────────────────────

  private rowToHabit(row: any): Habit {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category,
      icon: row.icon ?? undefined,
      scheduledTime: row.scheduled_time,
      durationMinutes: row.duration_minutes,
      repeatDays: JSON.parse(row.repeat_days ?? '[]'),
      isActive: row.is_active === 1,
      xpReward: row.xp_reward,
      streak: row.streak,
      notificationId: row.notification_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToLog(row: any): HabitLog {
    return {
      id: row.id,
      habitId: row.habit_id,
      date: row.date,
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      status: row.status,
      xpEarned: row.xp_earned,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    };
  }
}
