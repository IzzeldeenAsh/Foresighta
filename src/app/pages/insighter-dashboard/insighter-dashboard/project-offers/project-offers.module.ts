import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ProjectOffersComponent } from './project-offers.component';
import { SendProposalComponent } from './send-proposal/send-proposal.component';
import { ProjectContractComponent } from './project-contract/project-contract.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { FormsModule } from '@angular/forms';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule } from 'primeng/paginator';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InsighterDashboardSharedModule } from '../shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: ProjectOffersComponent
  },
  {
    path: 'contract/:contractUuid',
    component: ProjectContractComponent
  },
  {
    path: 'send-proposal/:uuid',
    component: SendProposalComponent
  }
];

@NgModule({
  declarations: [ProjectOffersComponent, SendProposalComponent, ProjectContractComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    FormsModule,
    ProgressBarModule,
    PaginatorModule,
    SidebarModule,
    ButtonModule,
    TooltipModule,
    InsighterDashboardSharedModule,
  ]
})
export class ProjectOffersModule { }
