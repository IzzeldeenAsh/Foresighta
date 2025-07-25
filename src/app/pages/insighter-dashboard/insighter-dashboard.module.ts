import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InsighterDashboardRoutingModule } from './insighter-dashboard-routing.module';
import { InsighterDashboardComponent } from './insighter-dashboard/insighter-dashboard.component';
import { AppFooterComponent } from 'src/app/reusable-components/app-footer/app-footer.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { ToastModule } from 'primeng/toast';
import { OverviewStatisticsComponent } from './insighter-dashboard/statistics/overview-statistics/overview-statistics.component';
import { AccountSettingsHeaderComponent } from './insighter-dashboard/statistics/account-settings-header/account-settings-header.component';
import { KnowledgeStatisticsComponent } from './insighter-dashboard/statistics/knowledge-statistics/knowledge-statistics.component';
import { RequestsStatisticsComponent } from './insighter-dashboard/statistics/requests-statistics/requests-statistics.component';
import { CountUpDirective } from 'src/app/directives/countup/count-up.directive';
import { CompanyStatisticsComponent } from './insighter-dashboard/statistics/company-statistics/company-statistics.component';
import { DownloadsStatisticsComponent } from './insighter-dashboard/statistics/downloads-statistics/downloads-statistics.component';
import { ConsultingScheduleHeaderComponent } from './insighter-dashboard/statistics/consulting-schedule-header/consulting-schedule-header.component';
import { MeetingsStatisticsComponent } from './insighter-dashboard/my-meetings/meetings-statistics/meetings-statistics.component';
import { SentMeetingsStatisticsComponent } from './insighter-dashboard/my-meetings/sent-meetings-statistics/sent-meetings-statistics.component';
import { ReadLaterStatisticsComponent } from './insighter-dashboard/statistics/read-later-statistics/read-later-statistics.component';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

@NgModule({
  declarations: [
    InsighterDashboardComponent,
    OverviewStatisticsComponent,
    RequestsStatisticsComponent,
    KnowledgeStatisticsComponent,
    AccountSettingsHeaderComponent,
    CompanyStatisticsComponent,
    DownloadsStatisticsComponent,
    ConsultingScheduleHeaderComponent,
    MeetingsStatisticsComponent,
    SentMeetingsStatisticsComponent,
    ReadLaterStatisticsComponent
  ],
  imports: [
    CommonModule,
    AppFooterComponent,
    CountUpDirective,
    InsighterDashboardRoutingModule,
    SidebarModule,
    ButtonModule,
    TooltipModule,
    TranslationModule,
    ToastModule
  ]
})
export class InsighterDashboardModule { }
