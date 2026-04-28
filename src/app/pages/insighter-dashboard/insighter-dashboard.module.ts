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
import { MeetingsStatisticsComponent } from './insighter-dashboard/my-meetings/meetings-statistics/meetings-statistics.component';
import { SentMeetingsStatisticsComponent } from './insighter-dashboard/my-meetings/sent-meetings-statistics/sent-meetings-statistics.component';
import { ReadLaterStatisticsComponent } from './insighter-dashboard/statistics/read-later-statistics/read-later-statistics.component';
import { MyOrdersStatisticsComponent } from './insighter-dashboard/statistics/my-orders-statistics/my-orders-statistics.component';
import { PaymentSettingsHeaderComponent } from './insighter-dashboard/statistics/payment-settings-header/payment-settings-header.component';
import { WalletStatisticsComponent } from './insighter-dashboard/statistics/wallet-statistics/wallet-statistics.component';
import { SalesStatisticsComponent } from './insighter-dashboard/statistics/sales-statistics/sales-statistics.component';
import { ConsultingScheduleHeaderComponent } from './insighter-dashboard/statistics/consulting-schedule-header/consulting-schedule-header.component';
import { ProjectSettingsHeaderComponent } from './insighter-dashboard/statistics/project-settings-header/project-settings-header.component';
import { ProjectOffersStatisticsComponent } from './insighter-dashboard/statistics/project-offers-statistics/project-offers-statistics.component';
import { ProjectsCreatedStatisticsComponent } from './insighter-dashboard/statistics/projects-created-statistics/projects-created-statistics.component';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DashboardStatisticsComponent } from 'src/app/reusable-components/dashboard-statistics/dashboard-statistics.component';

@NgModule({
  declarations: [
    InsighterDashboardComponent,
    OverviewStatisticsComponent,
    RequestsStatisticsComponent,
    KnowledgeStatisticsComponent,
    AccountSettingsHeaderComponent,
    CompanyStatisticsComponent,
    DownloadsStatisticsComponent,
    MeetingsStatisticsComponent,
    SentMeetingsStatisticsComponent,
    ReadLaterStatisticsComponent,
    MyOrdersStatisticsComponent,
    PaymentSettingsHeaderComponent,
    WalletStatisticsComponent,
    SalesStatisticsComponent,
    ConsultingScheduleHeaderComponent,
    ProjectSettingsHeaderComponent,
    ProjectOffersStatisticsComponent,
    ProjectsCreatedStatisticsComponent,
  ],
  imports: [
    CommonModule,
    AppFooterComponent,
    CountUpDirective,
    DashboardStatisticsComponent,
    InsighterDashboardRoutingModule,
    SidebarModule,
    ButtonModule,
    TooltipModule,
    TranslationModule,
    ToastModule
  ]
})
export class InsighterDashboardModule { }
