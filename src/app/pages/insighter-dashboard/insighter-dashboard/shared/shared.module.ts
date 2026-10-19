import { AgreementRevisionsComponent } from './agreement-revisions/agreement-revisions.component';
import { DialogModule } from 'primeng/dialog';
import { OfferOverviewComponent } from './offer-overview.component';
import { ContractPartyCardComponent } from './contract-party-card.component';
import { DefinitionModeBadgeComponent } from './definition-mode-badge.component';
import { OfferRequirementsComponent } from './offer-requirements.component';
import { OfferRequirementsEditorComponent } from './offer-requirements-editor.component';
import { ProjectDatesComponent } from './project-dates/project-dates.component';
import { ProjectServicesComponent } from './project-services/project-services.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { PageHeaderComponent } from './page-header/page-header.component';
import { ProjectDiscussionComponent } from './project-discussion/project-discussion.component';
import { ProjectTimelineComponent } from './project-timeline/project-timeline.component';
import { ProjectDeliverablesComponent } from './project-deliverables/project-deliverables.component';
import { OfferInstallmentsComponent } from './offer-installments/offer-installments.component';
import { DashboardNavIconComponent } from 'src/app/reusable-components/dashboard-nav-icon/dashboard-nav-icon.component';

@NgModule({
  declarations: [
    AgreementRevisionsComponent,
    ContractPartyCardComponent,
    DefinitionModeBadgeComponent,
    OfferOverviewComponent,
    OfferRequirementsComponent,
    OfferRequirementsEditorComponent,
    ProjectDatesComponent,
    ProjectServicesComponent,
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent,
    ProjectDeliverablesComponent,
    OfferInstallmentsComponent
  ],
  imports: [
    DialogModule,
    CommonModule,
    FormsModule,
    TooltipModule,
    DashboardNavIconComponent
  ],
  exports: [
    AgreementRevisionsComponent,
    ContractPartyCardComponent,
    DefinitionModeBadgeComponent,
    OfferOverviewComponent,
    OfferRequirementsComponent,
    OfferRequirementsEditorComponent,
    ProjectDatesComponent,
    ProjectServicesComponent,
    PageHeaderComponent,
    ProjectDiscussionComponent,
    ProjectTimelineComponent,
    ProjectDeliverablesComponent,
    OfferInstallmentsComponent,
    DashboardNavIconComponent
  ]
})
export class InsighterDashboardSharedModule { }
