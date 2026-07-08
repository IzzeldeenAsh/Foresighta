import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from './page-header/page-header.component';
import { ProjectDiscussionComponent } from './project-discussion/project-discussion.component';
import { ProjectTimelineComponent } from './project-timeline/project-timeline.component';

@NgModule({
  declarations: [
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent
  ]
})
export class InsighterDashboardSharedModule { }
