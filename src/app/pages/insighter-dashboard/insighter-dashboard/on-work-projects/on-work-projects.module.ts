import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { SidebarModule } from 'primeng/sidebar';
import { TooltipModule } from 'primeng/tooltip';
import { TranslationModule } from 'src/app/modules/i18n';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
import { OnWorkProjectDetailsComponent } from './on-work-project-details.component';
import { OnWorkProjectsComponent } from './on-work-projects.component';

const routes: Routes = [
  {
    path: '',
    component: OnWorkProjectsComponent,
    pathMatch: 'full',
  },
  {
    path: 'details/:uuid',
    component: OnWorkProjectDetailsComponent,
  },
];

@NgModule({
  declarations: [OnWorkProjectsComponent, OnWorkProjectDetailsComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    TranslationModule,
    ProgressBarModule,
    PaginatorModule,
    SidebarModule,
    DialogModule,
    ButtonModule,
    TooltipModule,
    InsighterDashboardSharedModule,
  ],
})
export class OnWorkProjectsModule {}
