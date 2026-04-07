import { Component, Injector, ViewChild } from '@angular/core';
import { ComponentCanDeactivate } from 'src/app/guards/pending-changes.guard';
import { BaseComponent } from 'src/app/modules/base.component';
import { ConsultingScheduleComponent } from '../consulting-schedule.component';

@Component({
  selector: 'app-consulting-schedule-page',
  templateUrl: './consulting-schedule-page.component.html'
})
export class ConsultingSchedulePageComponent extends BaseComponent implements ComponentCanDeactivate {
  @ViewChild(ConsultingScheduleComponent)
  consultingScheduleComponent?: ConsultingScheduleComponent;

  constructor(injector: Injector) {
    super(injector);
  }

  get subtitle(): string {
    return this.lang === 'ar'
      ? 'إدارة جدولة الجلسات وأوقات التوفر.'
      : 'Manage session scheduling and availability.';
  }

  canDeactivate() {
    return this.consultingScheduleComponent?.canDeactivate?.() ?? true;
  }
}
