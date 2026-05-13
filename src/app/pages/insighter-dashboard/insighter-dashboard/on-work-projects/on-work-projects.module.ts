import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressBarModule } from 'primeng/progressbar';
import { SidebarModule } from 'primeng/sidebar';
import { TooltipModule } from 'primeng/tooltip';
import { TranslationModule } from 'src/app/modules/i18n';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
import { OnWorkProjectsComponent } from './on-work-projects.component';

const routes: Routes = [
  {
    path: '',
    component: OnWorkProjectsComponent,
  },
];

@NgModule({
  declarations: [OnWorkProjectsComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    ProgressBarModule,
    PaginatorModule,
    SidebarModule,
    ButtonModule,
    TooltipModule,
    InsighterDashboardSharedModule,
  ],
})
export class OnWorkProjectsModule {}
