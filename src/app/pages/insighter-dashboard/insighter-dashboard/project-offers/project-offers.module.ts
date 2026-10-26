import { PendingChangesGuard } from 'src/app/guards/pending-changes.guard';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ProjectOffersComponent } from './project-offers.component';
import { ProjectOfferDetailsComponent } from './project-offer-details.component';
import { SendProposalComponent } from './send-proposal/send-proposal.component';
import { ProjectContractComponent } from './project-contract/project-contract.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule } from 'primeng/paginator';
import { SidebarModule } from 'primeng/sidebar';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { InsighterDashboardSharedModule } from '../shared/shared.module';

const routes: Routes = [
  {
    path: '',
    canDeactivate: [PendingChangesGuard],
    component: ProjectOffersComponent,
    pathMatch: 'full'
  },
  {
    path: 'details/:uuid',
    canDeactivate: [PendingChangesGuard],
    component: ProjectOfferDetailsComponent
  },
  {
    path: 'contract/:contractUuid',
    component: ProjectContractComponent
  },
  {
    path: 'edit-offer/:uuid',
    component: SendProposalComponent,
    data: { editOffer: true },
    canDeactivate: [PendingChangesGuard]
  },
  {
    path: 'send-proposal/:uuid',
    component: SendProposalComponent
  }
];

@NgModule({
  declarations: [ProjectOffersComponent, ProjectOfferDetailsComponent, SendProposalComponent, ProjectContractComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    FormsModule,
    DragDropModule,
    ProgressBarModule,
    PaginatorModule,
    SidebarModule,
    DialogModule,
    ButtonModule,
    TooltipModule,
    DropdownModule,
    InsighterDashboardSharedModule,
  ]
})
export class ProjectOffersModule { }
