import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from './page-header/page-header.component';
import { ProjectDiscussionComponent } from './project-discussion/project-discussion.component';

@NgModule({
  declarations: [
    PageHeaderComponent,
    ProjectDiscussionComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    PageHeaderComponent,
    ProjectDiscussionComponent
  ]
})
export class InsighterDashboardSharedModule { }
