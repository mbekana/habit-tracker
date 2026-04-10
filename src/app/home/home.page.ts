import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonToast,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  checkmarkCircle,
  timeOutline,
  ellipsisHorizontal,
  trophyOutline,
  flameOutline,
  sparklesOutline,
} from 'ionicons/icons';

import { HabitService } from '../services/habit.service';
import { CATEGORY_THEME, HabitWithLog } from '../models/habit.model';
import { AddHabitModalComponent } from './add-habit-modal/add-habit-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonToast,
    AddHabitModalComponent,
  ],
})
export class HomePage implements OnInit {

  readonly habitService = inject(HabitService);

  /** Controls the Add Habit modal */
  readonly isModalOpen = signal(false);

  /** Controls the XP toast */
  readonly toastMsg = signal('');
  readonly toastOpen = signal(false);

  /** Today's greeting based on time of day */
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  /** Expose theme helper to template */
  readonly categoryTheme = CATEGORY_THEME;

  /** Track which cards are animating (XP pop) */
  private animatingIds = new Set<string>();

  ngOnInit(): void {
    addIcons({
      addOutline,
      checkmarkCircle,
      timeOutline,
      ellipsisHorizontal,
      trophyOutline,
      flameOutline,
      sparklesOutline,
    });
  }

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.habitService.loadToday();
    (event.target as HTMLIonRefresherElement).complete();
  }

  // ── Habit interactions ──────────────────────────────────────────────────────

  async onHabitTap(item: HabitWithLog): Promise<void> {
    const { habit, log } = item;

    if (!log || log.status === 'pending') {
      await this.habitService.startHabit(habit.id);
      return;
    }

    if (log.status === 'in_progress') {
      await this.habitService.completeHabit(habit.id);
      this.showXpToast(habit.xpReward, habit.name);
      return;
    }
    // already completed — no-op
  }

  async onSkip(item: HabitWithLog, event: Event): Promise<void> {
    event.stopPropagation();
    await this.habitService.skipHabit(item.habit.id);
  }

  // ── Modal ───────────────────────────────────────────────────────────────────

  openAddModal(): void {
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private showXpToast(xp: number, name: string): void {
    this.toastMsg.set(`+${xp} XP — "${name}" complete! 🎉`);
    this.toastOpen.set(true);
    setTimeout(() => this.toastOpen.set(false), 3000);
  }

  /** Returns a CSS class string for the card border based on status */
  cardBorderClass(item: HabitWithLog): string {
    if (item.log?.status === 'completed') return 'border-primary/50 bg-primary-muted/40';
    if (item.isNext) return 'border-primary shadow-glow-green';
    if (item.isPast) return 'border-accent-orange/40 bg-accent-orange/5';
    return 'border-surface-border bg-white';
  }

  /** Action label depending on log status */
  actionLabel(item: HabitWithLog): string {
    const s = item.log?.status;
    if (!s || s === 'pending') return 'Start';
    if (s === 'in_progress') return 'Done!';
    if (s === 'completed') return '✓ Done';
    return 'Skipped';
  }

  /** Action button CSS classes */
  actionBtnClass(item: HabitWithLog): string {
    const s = item.log?.status;
    if (s === 'completed') return 'bg-primary-muted text-primary-dark cursor-default';
    if (s === 'in_progress') return 'bg-primary text-white btn-press shadow-btn';
    if (s === 'skipped') return 'bg-surface-border text-ink-muted cursor-default';
    if (item.isNext) return 'bg-primary text-white btn-press shadow-btn';
    return 'bg-surface-border text-ink-muted btn-press';
  }

  /** Elapsed time label for in-progress habits */
  elapsedLabel(item: HabitWithLog): string {
    if (item.log?.status !== 'in_progress' || !item.log?.startTime) return '';
    const secs = Math.floor((Date.now() - new Date(item.log.startTime).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** Determines if card entrance animation should play */
  isAnimating(id: string): boolean {
    return this.animatingIds.has(id);
  }

  trackById(_: number, item: HabitWithLog): string {
    return item.habit.id;
  }
}
