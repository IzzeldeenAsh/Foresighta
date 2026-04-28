import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslationModule } from 'src/app/modules/i18n';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule } from 'primeng/paginator';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
import { ProjectsCreatedComponent } from './projects-created.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectsCreatedComponent,
  },
  {
    path: ':uuid',
    component: ProjectDetailComponent,
  }
];

@NgModule({
  declarations: [
    ProjectsCreatedComponent,
    ProjectDetailComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    FormsModule,
    ProgressBarModule,
    PaginatorModule,
    DropdownModule,
    SidebarModule,
    InsighterDashboardSharedModule,
  ]
})
export class ProjectsCreatedModule { }
