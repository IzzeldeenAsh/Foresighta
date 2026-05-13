import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslationModule } from 'src/app/modules/i18n';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule } from 'primeng/paginator';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { DialogModule } from 'primeng/dialog';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
import { ProjectsCreatedComponent } from './projects-created.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectContractComponent } from './project-contract/project-contract.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectsCreatedComponent,
  },
  {
    path: ':uuid/contract',
    component: ProjectContractComponent,
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
    ProjectContractComponent,
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
    DialogModule,
    InsighterDashboardSharedModule,
  ]
})
export class ProjectsCreatedModule { }
