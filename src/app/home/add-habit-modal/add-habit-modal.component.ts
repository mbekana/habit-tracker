import {
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonInput,
  IonTextarea,
  IonSpinner,
} from '@ionic/angular/standalone';

import { HabitService, HabitFormData } from '../../services/habit.service';
import { HabitCategory, CATEGORY_THEME } from '../../models/habit.model';

interface CategoryOption {
  value: HabitCategory;
  label: string;
}

@Component({
  selector: 'app-add-habit-modal',
  templateUrl: 'add-habit-modal.component.html',
  styleUrls: ['add-habit-modal.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonInput, IonTextarea, IonSpinner,
  ],
})
export class AddHabitModalComponent {

  @Output() dismissed = new EventEmitter<void>();

  private readonly habitService = inject(HabitService);
  readonly categoryTheme = CATEGORY_THEME;

  // ── Form state signals ──────────────────────────────────────────────────────

  readonly name = signal('');
  readonly description = signal('');
  readonly category = signal<HabitCategory>('health');
  readonly scheduledTime = signal('07:00');
  readonly durationMinutes = signal(30);
  readonly isSaving = signal(false);
  readonly validationError = signal('');

  // ── Category list ───────────────────────────────────────────────────────────

  readonly categories: CategoryOption[] = [
    { value: 'health', label: '💧 Health' },
    { value: 'fitness', label: '🏋️ Fitness' },
    { value: 'mindfulness', label: '🧘 Mindfulness' },
    { value: 'learning', label: '📚 Learning' },
    { value: 'social', label: '🤝 Social' },
    { value: 'creativity', label: '🎨 Creativity' },
    { value: 'productivity', label: '✅ Productivity' },
    { value: 'custom', label: '⭐ Custom' },
  ];

  /** XP presets */
  readonly xpOptions = [5, 10, 15, 20, 30, 50];
  readonly selectedXp = signal(10);

  // ── Duration chips ──────────────────────────────────────────────────────────
  readonly durationOptions = [5, 10, 15, 20, 30, 45, 60];

  // ── Actions ──────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.name().trim()) {
      this.validationError.set('Please enter a habit name.');
      return;
    }
    if (!this.scheduledTime()) {
      this.validationError.set('Please set a scheduled time.');
      return;
    }

    this.validationError.set('');
    this.isSaving.set(true);

    try {
      const data: HabitFormData = {
        name: this.name().trim(),
        description: this.description().trim() || undefined,
        category: this.category(),
        scheduledTime: this.scheduledTime(),
        durationMinutes: this.durationMinutes(),
        xpReward: this.selectedXp(),
      };

      await this.habitService.createHabit(data);
      this.dismissed.emit();
    } catch (e) {
      console.error('[AddHabitModal] save error:', e);
      this.validationError.set('Something went wrong. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    this.dismissed.emit();
  }

  setCategory(cat: HabitCategory): void {
    this.category.set(cat);
  }

  setDuration(mins: number): void {
    this.durationMinutes.set(mins);
  }

  setXp(xp: number): void {
    this.selectedXp.set(xp);
  }

  onNameChange(e: Event): void {
    this.name.set((e as CustomEvent).detail.value ?? '');
  }

  onDescChange(e: Event): void {
    this.description.set((e as CustomEvent).detail.value ?? '');
  }

  onTimeChange(e: Event): void {
    this.scheduledTime.set((e as CustomEvent).detail.value ?? '07:00');
  }
}
