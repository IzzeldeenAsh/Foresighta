import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { PageHeaderComponent } from './page-header/page-header.component';
import { ProjectDiscussionComponent } from './project-discussion/project-discussion.component';
import { ProjectTimelineComponent } from './project-timeline/project-timeline.component';
import { DashboardNavIconComponent } from 'src/app/reusable-components/dashboard-nav-icon/dashboard-nav-icon.component';

@NgModule({
  declarations: [
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    TooltipModule,
    DashboardNavIconComponent
  ],
  exports: [
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent,
    DashboardNavIconComponent
  ]
})
export class InsighterDashboardSharedModule { }
