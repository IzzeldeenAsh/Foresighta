import { Component, Injector } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { BreadcrumbItem } from 'src/app/reusable-components/dashboard-statistics/dashboard-statistics.component';

@Component({
  selector: 'app-project-settings-header',
  templateUrl: './project-settings-header.component.html',
  styleUrls: ['./project-settings-header.component.scss']
})
export class ProjectSettingsHeaderComponent extends BaseComponent {
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Project Settings' }
  ];

  constructor(injector: Injector) {
    super(injector);
  }
}
