import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { BreadcrumbItem } from 'src/app/reusable-components/dashboard-statistics/dashboard-statistics.component';

@Component({
  selector: 'app-project-offers-statistics',
  templateUrl: './project-offers-statistics.component.html',
  styleUrls: ['./project-offers-statistics.component.scss']
})
export class ProjectOffersStatisticsComponent extends BaseComponent implements OnInit {
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Project Offers', translationKey: 'PROJECT_OFFERS.PAGE_TITLE' }
  ];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
  }
}
