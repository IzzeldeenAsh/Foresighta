import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { BreadcrumbItem } from 'src/app/reusable-components/dashboard-statistics/dashboard-statistics.component';

@Component({
  selector: 'app-projects-created-statistics',
  templateUrl: './projects-created-statistics.component.html',
  styleUrls: ['./projects-created-statistics.component.scss']
})
export class ProjectsCreatedStatisticsComponent extends BaseComponent implements OnInit {
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Projects Created', translationKey: 'PROJECTS_CREATED.PAGE_TITLE' }
  ];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {}
}
