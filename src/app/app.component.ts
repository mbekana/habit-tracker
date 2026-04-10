import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { DatabaseService } from './services/database.service';
import { NotificationService } from './services/notification.service';
import { HabitService } from './services/habit.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private readonly platform    = inject(Platform);
  private readonly db          = inject(DatabaseService);
  private readonly notif       = inject(NotificationService);
  private readonly habitService = inject(HabitService);

  async ngOnInit(): Promise<void> {
    await this.platform.ready();

    // Initialise services in order
    await this.db.init();
    await this.notif.init();
    await this.habitService.loadToday();
  }
}
