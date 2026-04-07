import { Component, Injector } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-project-settings-page',
  templateUrl: './project-settings-page.component.html'
})
export class ProjectSettingsPageComponent extends BaseComponent {
  constructor(injector: Injector) {
    super(injector);
  }

  get subtitle(): string {
    return this.lang === 'ar'
      ? 'إدارة إعدادات المشروع وتفضيلاته.'
      : 'Manage project settings and preferences.';
  }
}
